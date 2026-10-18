"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AssistError, buildAssistMessages, completeChat } from "@/lib/assist";
import { inspectAssistUrl, normalizeAssistBaseUrl, prepareAssistEndpoint } from "@/lib/assist-endpoint";
import { buildPromptMessages } from "@/lib/assist-prompt";
import { db } from "@/lib/db";
import type { AssistKind } from "@/lib/generated/prisma/enums";
import { BlockedDestinationError } from "@/lib/ssrf";
import {
  DEFAULT_ASSIST_BASE_URL,
  DEFAULT_ASSIST_MODEL,
  type ActionResult,
  type AssistAnswer,
  isAssistAnswerKind,
  type AssistKindName,
  type AssistPromptItem,
  type AssistStatus,
} from "@/lib/types";
import { assistConfigSchema, assistPromptRunSchema, assistPromptSaveSchema, assistRequestSchema, firstError, MAX_HIGHLIGHT_NOTE_LENGTH } from "@/lib/validation";

const QUESTION_LIMIT = 8;
const PROMPT_LIMIT = 20;

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
  if (!isAssistAnswerKind(row.kind)) throw new Error("A prompt note is stored on the highlight, not as an Assist answer.");
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

function toPrompt(row: { id: string; name: string; body: string }): AssistPromptItem {
  return { id: row.id, name: row.name, body: row.body };
}

export async function saveAssistPrompt(raw: z.input<typeof assistPromptSaveSchema>): Promise<ActionResult<AssistPromptItem>> {
  const input = assistPromptSaveSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };

  if (input.data.id) {
    const existing = await db.assistPrompt.findUnique({ where: { id: input.data.id }, select: { id: true } });
    if (!existing) return { ok: false, error: "That prompt is no longer saved." };
    const row = await db.assistPrompt.update({
      where: { id: input.data.id },
      data: { name: input.data.name, body: input.data.body },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: toPrompt(row) };
  }

  const count = await db.assistPrompt.count();
  if (count >= PROMPT_LIMIT) return { ok: false, error: "Twenty prompts is the limit. Delete one to add another." };
  const last = await db.assistPrompt.aggregate({ _max: { position: true } });
  const row = await db.assistPrompt.create({
    data: { name: input.data.name, body: input.data.body, position: (last._max.position ?? -1) + 1 },
  });
  revalidatePath("/", "layout");
  return { ok: true, data: toPrompt(row) };
}

export async function deleteAssistPrompt(rawId: string): Promise<ActionResult<{ id: string }>> {
  const id = assistPromptRunSchema.shape.promptId.safeParse(rawId);
  if (!id.success) return { ok: false, error: "Unknown prompt." };
  await db.assistPrompt.deleteMany({ where: { id: id.data } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: id.data } };
}

/** Fills the prompt with the passage, title, and author, then saves the answer as the highlight's note. */
export async function applyAssistPrompt(raw: z.input<typeof assistPromptRunSchema>): Promise<ActionResult<{ note: string; model: string }>> {
  const input = assistPromptRunSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };

  const [prompt, highlight, config] = await Promise.all([
    db.assistPrompt.findUnique({ where: { id: input.data.promptId } }),
    db.highlight.findUnique({
      where: { id: input.data.highlightId },
      select: { id: true, documentId: true, quote: true, document: { select: { title: true, author: true } } },
    }),
    db.assistConfig.findUnique({ where: { id: 1 } }),
  ]);
  if (!prompt) return { ok: false, error: "That prompt is no longer saved." };
  if (!highlight) return { ok: false, error: "That highlight is no longer saved." };
  if (!config) return { ok: false, error: "Connect a model in Settings before using Assist." };

  let endpoint: Awaited<ReturnType<typeof prepareAssistEndpoint>>;
  try {
    endpoint = await prepareAssistEndpoint(config.baseUrl);
  } catch (error) {
    if (error instanceof BlockedDestinationError) return { ok: false, error: error.message };
    return { ok: false, error: "Libra couldn't resolve the model host." };
  }

  let generated: { answer: string; model: string };
  try {
    const built = buildPromptMessages({
      template: prompt.body,
      content: highlight.quote,
      title: highlight.document.title,
      author: highlight.document.author ?? "",
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

  const note = generated.answer.slice(0, MAX_HIGHLIGHT_NOTE_LENGTH);
  await db.highlight.update({ where: { id: highlight.id }, data: { note } });
  const existing = await db.assistNote.findFirst({ where: { highlightId: highlight.id, kind: "PROMPT" } });
  if (existing) {
    await db.assistNote.update({ where: { id: existing.id }, data: { answer: note, model: generated.model, question: prompt.name } });
  } else {
    await db.assistNote.create({
      data: {
        documentId: highlight.documentId,
        highlightId: highlight.id,
        kind: "PROMPT",
        question: prompt.name,
        answer: note,
        model: generated.model,
      },
    });
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { note, model: generated.model } };
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
