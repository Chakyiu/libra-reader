"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import type { ReadingStatus } from "@/lib/generated/prisma/enums";
import { countWords, estimateReadingMinutes, makeExcerpt, noteBodyToHtml, titleFromFileName } from "@/lib/reading";
import { deleteStoredFile } from "@/lib/storage";
import { attachTags, pruneUnusedTags } from "@/lib/tags";
import type { ActionResult } from "@/lib/types";
import {
  documentDetailsSchema,
  fieldErrors,
  fileMetadataSchema,
  firstError,
  idListSchema,
  idSchema,
  noteInputSchema,
  readingStatusSchema,
  tagListSchema,
  tagNameSchema,
} from "@/lib/validation";

function refresh() {
  revalidatePath("/", "layout");
}

function noteFields(title: string, body: string) {
  const text = body.replace(/\r\n?/g, "\n").trim();
  return {
    title: title || "Untitled note",
    contentHtml: noteBodyToHtml(text),
    contentText: text,
    excerpt: text ? makeExcerpt(text) : null,
    wordCount: countWords(text),
    readingMinutes: estimateReadingMinutes(text),
  };
}

const createNoteInput = noteInputSchema.extend({
  collectionId: idSchema.optional(),
  tags: tagListSchema.default([]),
});

export async function createNote(raw: z.input<typeof createNoteInput>): Promise<ActionResult<{ id: string }>> {
  const input = createNoteInput.safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error), fieldErrors: fieldErrors(input.error) };
  const { title, body, collectionId, tags } = input.data;
  if (!title.trim() && !body.trim()) return { ok: false, error: "Write a title or a few words before saving." };

  const document = await db.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: { type: "NOTE", importStatus: "READY", ...noteFields(title.trim(), body) },
      select: { id: true },
    });
    if (collectionId) await tx.documentCollection.create({ data: { documentId: created.id, collectionId } });
    if (tags.length) await attachTags(tx, [created.id], tags);
    return created;
  });
  refresh();
  return { ok: true, data: { id: document.id } };
}

const updateNoteInput = noteInputSchema.extend({ id: idSchema });

export async function updateNote(raw: z.input<typeof updateNoteInput>): Promise<ActionResult> {
  const input = updateNoteInput.safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error), fieldErrors: fieldErrors(input.error) };
  const existing = await db.document.findUnique({ where: { id: input.data.id }, select: { type: true } });
  if (!existing) return { ok: false, error: "That note no longer exists." };
  if (existing.type !== "NOTE") return { ok: false, error: "Only notes can be edited this way." };
  await db.document.update({ where: { id: input.data.id }, data: noteFields(input.data.title.trim(), input.data.body) });
  refresh();
  return { ok: true, data: undefined };
}

export async function updateDocumentDetails(raw: z.input<typeof documentDetailsSchema>): Promise<ActionResult> {
  const input = documentDetailsSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error), fieldErrors: fieldErrors(input.error) };
  const { id, title, author, publication } = input.data;
  await db.document.update({
    where: { id },
    data: { title, author: author || null, publication: publication || null },
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function setFavorite(raw: { ids: string[]; value: boolean }): Promise<ActionResult> {
  const input = z.object({ ids: idListSchema, value: z.boolean() }).safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };
  await db.document.updateMany({ where: { id: { in: input.data.ids } }, data: { isFavorite: input.data.value } });
  refresh();
  return { ok: true, data: undefined };
}

export interface StatusSnapshot {
  id: string;
  status: ReadingStatus;
}

/**
 * Archive or restore. Returns each document's previous status so the
 * caller can offer an exact Undo. Restoring picks Reading when there's
 * progress, otherwise Inbox.
 */
export async function setStatus(raw: {
  ids: string[];
  status: ReadingStatus | "RESTORE";
}): Promise<ActionResult<{ previous: StatusSnapshot[] }>> {
  const input = z
    .object({ ids: idListSchema, status: z.union([readingStatusSchema, z.literal("RESTORE")]) })
    .safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };

  const previous = await db.document.findMany({
    where: { id: { in: input.data.ids } },
    select: { id: true, status: true, progress: true },
  });
  if (previous.length === 0) return { ok: false, error: "Those documents no longer exist." };

  await db.$transaction(
    previous.map((doc) => {
      const next: ReadingStatus =
        input.data.status === "RESTORE" ? (doc.progress > 0.01 ? "READING" : "INBOX") : input.data.status;
      return db.document.update({
        where: { id: doc.id },
        data: { status: next, archivedAt: next === "ARCHIVED" ? new Date() : null },
      });
    }),
  );
  refresh();
  return { ok: true, data: { previous: previous.map(({ id, status }) => ({ id, status })) } };
}

/** Puts documents back exactly as they were (used by Undo). */
export async function restoreStatuses(raw: { entries: StatusSnapshot[] }): Promise<ActionResult> {
  const input = z
    .object({ entries: z.array(z.object({ id: idSchema, status: readingStatusSchema })).min(1).max(500) })
    .safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };
  await db.$transaction(
    input.data.entries.map((entry) =>
      db.document.updateMany({
        where: { id: entry.id },
        data: { status: entry.status, archivedAt: entry.status === "ARCHIVED" ? new Date() : null },
      }),
    ),
  );
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteDocuments(raw: { ids: string[] }): Promise<ActionResult<{ count: number }>> {
  const input = z.object({ ids: idListSchema }).safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };
  const files = await db.document.findMany({
    where: { id: { in: input.data.ids } },
    select: { filePath: true },
  });
  const result = await db.$transaction(async (tx) => {
    const deleted = await tx.document.deleteMany({ where: { id: { in: input.data.ids } } });
    await pruneUnusedTags(tx);
    return deleted;
  });
  await Promise.all(files.map((file) => deleteStoredFile(file.filePath)));
  refresh();
  return { ok: true, data: { count: result.count } };
}

export async function addTags(raw: { ids: string[]; tags: string[] }): Promise<ActionResult<{ tags: string[] }>> {
  const input = z.object({ ids: idListSchema, tags: tagListSchema.min(1, "Type a tag first.") }).safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };
  const tags = [...new Set(input.data.tags)];
  await db.$transaction((tx) => attachTags(tx, input.data.ids, tags));
  refresh();
  return { ok: true, data: { tags } };
}

export async function removeTag(raw: { id: string; tag: string }): Promise<ActionResult> {
  const input = z.object({ id: idSchema, tag: tagNameSchema }).safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };
  await db.$transaction(async (tx) => {
    const tag = await tx.tag.findUnique({ where: { name: input.data.tag } });
    if (!tag) return;
    await tx.documentTag.deleteMany({ where: { documentId: input.data.id, tagId: tag.id } });
    await pruneUnusedTags(tx);
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function addToCollection(raw: { ids: string[]; collectionId: string }): Promise<ActionResult<{ name: string }>> {
  const input = z.object({ ids: idListSchema, collectionId: idSchema }).safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };
  const collection = await db.collection.findUnique({ where: { id: input.data.collectionId }, select: { name: true } });
  if (!collection) return { ok: false, error: "That collection no longer exists." };
  await db.$transaction(
    input.data.ids.map((documentId) =>
      db.documentCollection.upsert({
        where: { documentId_collectionId: { documentId, collectionId: input.data.collectionId } },
        update: {},
        create: { documentId, collectionId: input.data.collectionId },
      }),
    ),
  );
  refresh();
  return { ok: true, data: { name: collection.name } };
}

export async function removeFromCollection(raw: { ids: string[]; collectionId: string }): Promise<ActionResult> {
  const input = z.object({ ids: idListSchema, collectionId: idSchema }).safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };
  await db.documentCollection.deleteMany({
    where: { collectionId: input.data.collectionId, documentId: { in: input.data.ids } },
  });
  refresh();
  return { ok: true, data: undefined };
}

/** Records what the PDF reader learns on first open; only fills gaps, never overrides user edits. */
export async function recordFileMetadata(raw: z.input<typeof fileMetadataSchema>): Promise<ActionResult> {
  const input = fileMetadataSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };
  const doc = await db.document.findUnique({
    where: { id: input.data.id },
    select: { type: true, title: true, author: true, fileName: true, pageCount: true },
  });
  if (!doc || doc.type !== "PDF") return { ok: false, error: "Unknown PDF." };

  const titleIsDefault = !doc.fileName || doc.title === titleFromFileName(doc.fileName);
  const usefulTitle =
    input.data.title && !/^(untitled|microsoft word|document\d*)\b/i.test(input.data.title) && !/\.(pdf|docx?)$/i.test(input.data.title)
      ? input.data.title
      : undefined;

  const data = {
    ...(input.data.pageCount && !doc.pageCount
      ? { pageCount: input.data.pageCount, readingMinutes: Math.max(1, Math.round(input.data.pageCount * 2)) }
      : {}),
    ...(titleIsDefault && usefulTitle ? { title: usefulTitle } : {}),
    ...(!doc.author && input.data.author ? { author: input.data.author } : {}),
  };
  if (Object.keys(data).length === 0) return { ok: true, data: undefined };
  await db.document.update({ where: { id: input.data.id }, data });
  refresh();
  return { ok: true, data: undefined };
}
