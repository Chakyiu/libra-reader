"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import type { ActionResult, HighlightItem } from "@/lib/types";
import { firstError, highlightCreateSchema, highlightUpdateSchema, idSchema } from "@/lib/validation";

const select = {
  id: true,
  documentId: true,
  quote: true,
  prefix: true,
  suffix: true,
  context: true,
  startOffset: true,
  endOffset: true,
  color: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} as const;

function refresh() {
  revalidatePath("/", "layout");
}

export async function createHighlight(raw: z.input<typeof highlightCreateSchema>): Promise<ActionResult<HighlightItem>> {
  const input = highlightCreateSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };
  const doc = await db.document.findUnique({ where: { id: input.data.documentId }, select: { type: true, contentHtml: true } });
  if (!doc) return { ok: false, error: "That document no longer exists." };
  if (!doc.contentHtml || doc.type === "PDF" || doc.type === "EPUB") {
    return { ok: false, error: "Highlights are only available in articles and notes." };
  }
  const { note, ...rest } = input.data;
  const highlight = await db.highlight.create({ data: { ...rest, note: note ? note : null }, select });
  refresh();
  return { ok: true, data: highlight };
}

export async function updateHighlight(raw: z.input<typeof highlightUpdateSchema>): Promise<ActionResult<HighlightItem>> {
  const input = highlightUpdateSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };
  const { id, color, note } = input.data;
  const exists = await db.highlight.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return { ok: false, error: "That highlight no longer exists." };
  const highlight = await db.highlight.update({
    where: { id },
    data: {
      ...(color ? { color } : {}),
      ...(note !== undefined ? { note: note ? note : null } : {}),
    },
    select,
  });
  refresh();
  return { ok: true, data: highlight };
}

export async function deleteHighlight(rawId: string): Promise<ActionResult> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: "Unknown highlight." };
  await db.highlight.deleteMany({ where: { id: id.data } });
  refresh();
  return { ok: true, data: undefined };
}
