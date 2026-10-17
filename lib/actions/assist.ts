"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AssistError, buildAssistMessages, completeChat } from "@/lib/assist";
import { inspectAssistUrl, normalizeAssistBaseUrl, prepareAssistEndpoint } from "@/lib/assist-endpoint";
import { db } from "@/lib/db";
import type { AssistKind } from "@/lib/generated/prisma/enums";
import { BlockedDestinationError } from "@/lib/ssrf";
import {
  DEFAULT_ASSIST_BASE_URL,
  DEFAULT_ASSIST_MODEL,
  type ActionResult,
  type AssistAnswer,
  type AssistKindName,
  type AssistStatus,
} from "@/lib/types";
import { assistConfigSchema, assistRequestSchema, firstError } from "@/lib/validation";

const QUESTION_LIMIT = 8;

function statusOf(row: { baseUrl: string; model: string; apiKey: string } | null): AssistStatus {
  if (!row) return { configured: false, hasKey: false, baseUrl: DEFAULT_ASSIST_BASE_URL, model: DEFAULT_ASSIST_MODEL };
  return { configured: true, hasKey: row.apiKey.length > 0, baseUrl: row.baseUrl, model: row.model };
}

function toAnswer(row: {
  id: string;
  kind: AssistKind;
  question: string | null;
  answer: string;
  model: string;
  updatedAt: Date;
}): AssistAnswer {
  return {
    id: row.id,
    kind: row.kind,
    question: row.question,
    answer: row.answer,
    model: row.model,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function saveAssistConfig(raw: z.input<typeof assistConfigSchema>): Promise<ActionResult<AssistStatus>> {
  const input = assistConfigSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };

  let baseUrl: string;
  try {
    baseUrl = normalizeAssistBaseUrl(inspectAssistUrl(input.data.baseUrl).url);
  } catch (error) {
    if (error instanceof BlockedDestinationError) return { ok: false, error: error.message };
    return { ok: false, error: "That isn't a valid address." };
  }

  const nextKey = (input.data.apiKey ?? "").trim();
  if (/[\r\n]/.test(nextKey)) return { ok: false, error: "The API key can't contain a line break." };

  const existing = await db.assistConfig.findUnique({ where: { id: 1 }, select: { apiKey: true } });
  const apiKey = nextKey.length > 0 ? nextKey : (existing?.apiKey ?? "");

  const row = await db.assistConfig.upsert({
    where: { id: 1 },
    update: { baseUrl, model: input.data.model, apiKey },
    create: { id: 1, baseUrl, model: input.data.model, apiKey },
  });
  revalidatePath("/", "layout");
  return { ok: true, data: statusOf(row) };
}

export async function clearAssistConfig(): Promise<ActionResult<AssistStatus>> {
  const row = await db.assistConfig.upsert({
    where: { id: 1 },
    update: { apiKey: "" },
    create: { id: 1, apiKey: "" },
  });
  revalidatePath("/", "layout");
  return { ok: true, data: statusOf(row) };
}

async function saveAnswer(input: {
  documentId: string;
  highlightId: string | null;
  kind: AssistKindName;
  question: string | null;
  answer: string;
  model: string;
}): Promise<AssistAnswer> {
  if (input.kind === "QUESTION") {
    const created = await db.assistNote.create({ data: input });
    const older = await db.assistNote.findMany({
      where: { documentId: input.documentId, kind: "QUESTION" },
      orderBy: { createdAt: "desc" },
      skip: QUESTION_LIMIT,
      select: { id: true },
    });
    if (older.length > 0) await db.assistNote.deleteMany({ where: { id: { in: older.map((row) => row.id) } } });
    return toAnswer(created);
  }

  const existing =
    input.kind === "EXPLAIN"
      ? await db.assistNote.findFirst({ where: { highlightId: input.highlightId, kind: "EXPLAIN" } })
      : await db.assistNote.findFirst({ where: { documentId: input.documentId, kind: input.kind, highlightId: null } });
  const saved = existing
    ? await db.assistNote.update({
        where: { id: existing.id },
        data: { answer: input.answer, model: input.model, question: input.question },
      })
    : await db.assistNote.create({ data: input });
  return toAnswer(saved);
}

export async function runAssist(raw: z.input<typeof assistRequestSchema>): Promise<ActionResult<AssistAnswer>> {
  const input = assistRequestSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };

  const config = await db.assistConfig.findUnique({ where: { id: 1 } });
  if (!config) return { ok: false, error: "Connect a model in Settings before using Assist." };

  const doc = await db.document.findUnique({
    where: { id: input.data.documentId },
    select: { id: true, title: true, contentText: true },
  });
  if (!doc) return { ok: false, error: "That document is no longer in the library." };
  const text = (doc.contentText ?? "").trim();
  if (input.data.kind !== "EXPLAIN" && text.length < 40) {
    return { ok: false, error: "There's no readable text to send." };
  }

  let highlightId: string | null = null;
  let quote: string | undefined;
  let context: string | undefined;
  if (input.data.kind === "EXPLAIN") {
    const highlight = await db.highlight.findFirst({
      where: { id: input.data.highlightId, documentId: doc.id },
      select: { id: true, quote: true, context: true, prefix: true, suffix: true },
    });
    if (!highlight) return { ok: false, error: "That highlight is no longer saved." };
    highlightId = highlight.id;
    quote = highlight.quote;
    context = [highlight.context, highlight.prefix, highlight.suffix].filter(Boolean).join("\n");
  }

  let endpoint: Awaited<ReturnType<typeof prepareAssistEndpoint>>;
  try {
    endpoint = await prepareAssistEndpoint(config.baseUrl);
  } catch (error) {
    if (error instanceof BlockedDestinationError) return { ok: false, error: error.message };
    return { ok: false, error: "Libra couldn't resolve the model host." };
  }

  let generated: { answer: string; model: string };
  try {
    const built = buildAssistMessages({
      kind: input.data.kind,
      title: doc.title,
      text,
      question: input.data.question,
      quote,
      context,
    });
    generated = await completeChat({
      endpoint: endpoint.url,
      hostClass: endpoint.hostClass,
      apiKey: config.apiKey,
      model: config.model,
      messages: built.messages,
    });
  } catch (error) {
    if (error instanceof AssistError || error instanceof BlockedDestinationError) return { ok: false, error: error.message };
    return { ok: false, error: "The request to the model host failed." };
  }

  const saved = await saveAnswer({
    documentId: doc.id,
    highlightId,
    kind: input.data.kind,
    question: input.data.kind === "QUESTION" ? (input.data.question ?? null) : null,
    answer: generated.answer,
    model: generated.model,
  });
  revalidatePath("/", "layout");
  return { ok: true, data: saved };
}
