"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { fetchAndExtract, rememberExtraction, takeExtraction } from "@/lib/import-url";
import { linkOnlyTitle, prettyHost } from "@/lib/reading";
import { attachTags } from "@/lib/tags";
import type { ActionResult } from "@/lib/types";
import { firstError, idSchema, parseTagInput, urlInputSchema } from "@/lib/validation";
import type { ReadingStatus } from "@/lib/generated/prisma/enums";

export interface UrlPreview {
  title: string;
  author: string | null;
  publication: string | null;
  excerpt: string;
  readingMinutes: number;
  wordCount: number;
}

export type PreviewState =
  | { status: "ready"; url: string; finalUrl: string; token: string; preview: UrlPreview }
  | {
      status: "duplicate";
      url: string;
      existing: { id: string; title: string; status: ReadingStatus; createdAt: Date };
    }
  | { status: "error"; url: string; code: string; message: string; canSaveLink: boolean }
  | { status: "invalid"; message: string };

const previewInput = z.object({
  url: z.string(),
  allowDuplicate: z.boolean().default(false),
});

async function findDuplicate(...urls: string[]) {
  return db.document.findFirst({
    where: { sourceUrl: { in: urls } },
    select: { id: true, title: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Fetches and extracts a page for the preview step. Nothing is saved yet. */
export async function previewUrl(raw: { url: string; allowDuplicate?: boolean }): Promise<PreviewState> {
  const input = previewInput.safeParse(raw);
  if (!input.success) return { status: "invalid", message: "Paste an address first." };
  const parsed = urlInputSchema.safeParse(input.data.url);
  if (!parsed.success) return { status: "invalid", message: firstError(parsed.error) };
  const url = parsed.data;

  if (!input.data.allowDuplicate) {
    const existing = await findDuplicate(url);
    if (existing) return { status: "duplicate", url, existing };
  }

  const result = await fetchAndExtract(url);
  if (!result.ok) {
    return {
      status: "error",
      url,
      code: result.failure.code,
      message: result.failure.message,
      canSaveLink: result.failure.code !== "BLOCKED",
    };
  }

  const { extraction } = result;
  if (!input.data.allowDuplicate && extraction.finalUrl !== url) {
    const existing = await findDuplicate(extraction.finalUrl);
    if (existing) return { status: "duplicate", url, existing };
  }

  const article = extraction.article;
  if (!article) {
    return { status: "error", url, code: "UNREADABLE", message: "Libra couldn't find readable text.", canSaveLink: true };
  }

  return {
    status: "ready",
    url,
    finalUrl: extraction.finalUrl,
    token: rememberExtraction(extraction),
    preview: {
      title: article.title,
      author: article.author,
      publication: article.publication,
      excerpt: article.excerpt,
      readingMinutes: article.readingMinutes,
      wordCount: article.wordCount,
    },
  };
}

const saveInput = z.object({
  url: z.string(),
  token: z.string().max(64).optional(),
  linkOnly: z.boolean().default(false),
  collectionId: idSchema.optional(),
  tags: z.string().max(500).default(""),
});

/**
 * Saves a previewed article, or just the link. A link-only save stores the
 * address and the page's own title when one was readable, never invented text.
 */
export async function saveUrl(raw: z.input<typeof saveInput>): Promise<ActionResult<{ id: string; linkOnly: boolean }>> {
  const input = saveInput.safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };
  const parsedUrl = urlInputSchema.safeParse(input.data.url);
  if (!parsedUrl.success) return { ok: false, error: firstError(parsedUrl.error) };
  const url = parsedUrl.data;
  const tags = parseTagInput(input.data.tags);

  if (input.data.collectionId) {
    const exists = await db.collection.findUnique({ where: { id: input.data.collectionId }, select: { id: true } });
    if (!exists) return { ok: false, error: "That collection no longer exists." };
  }

  let extraction = input.data.linkOnly ? null : takeExtraction(input.data.token, url);
  if (!input.data.linkOnly && !extraction) {
    const fresh = await fetchAndExtract(url);
    if (!fresh.ok) return { ok: false, error: fresh.failure.message };
    extraction = fresh.extraction;
  }

  const article = extraction?.article ?? null;
  const document = await db.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: article
        ? {
            type: "ARTICLE",
            title: article.title,
            author: article.author,
            publication: article.publication,
            sourceUrl: extraction?.finalUrl ?? url,
            contentHtml: article.contentHtml,
            contentText: article.contentText,
            excerpt: article.excerpt,
            wordCount: article.wordCount,
            readingMinutes: article.readingMinutes,
            importStatus: "READY",
          }
        : {
            type: "ARTICLE",
            title: linkOnlyTitle(url),
            publication: prettyHost(url) || null,
            sourceUrl: url,
            importStatus: "LINK_ONLY",
            importError: "Saved without a readable copy.",
          },
      select: { id: true },
    });
    if (input.data.collectionId) {
      await tx.documentCollection.create({ data: { documentId: created.id, collectionId: input.data.collectionId } });
    }
    if (tags.length) await attachTags(tx, [created.id], tags);
    return created;
  });

  revalidatePath("/", "layout");
  return { ok: true, data: { id: document.id, linkOnly: !article } };
}

/** Tries extraction again for a link-only article; replaces its content only on success. */
export async function retryImport(rawId: string): Promise<ActionResult<{ title: string }>> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: "Unknown document." };
  const document = await db.document.findUnique({ where: { id: id.data }, select: { sourceUrl: true, type: true, title: true } });
  if (!document || document.type !== "ARTICLE" || !document.sourceUrl) {
    return { ok: false, error: "Only saved web articles can be fetched again." };
  }
  const result = await fetchAndExtract(document.sourceUrl);
  if (!result.ok) {
    await db.document.update({ where: { id: id.data }, data: { importError: result.failure.message } });
    revalidatePath(`/read/${id.data}`);
    return { ok: false, error: result.failure.message };
  }
  const article = result.extraction.article;
  if (!article) return { ok: false, error: "Libra still couldn't find readable text on that page." };
  await db.document.update({
    where: { id: id.data },
    data: {
      title: article.title,
      author: article.author,
      publication: article.publication,
      contentHtml: article.contentHtml,
      contentText: article.contentText,
      excerpt: article.excerpt,
      wordCount: article.wordCount,
      readingMinutes: article.readingMinutes,
      importStatus: "READY",
      importError: null,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { title: article.title } };
}
