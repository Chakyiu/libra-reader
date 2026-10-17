"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/types";
import { collectionInputSchema, fieldErrors, firstError, idSchema } from "@/lib/validation";

function refresh() {
  revalidatePath("/", "layout");
}

export async function createCollection(raw: z.input<typeof collectionInputSchema>): Promise<ActionResult<{ id: string }>> {
  const input = collectionInputSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error), fieldErrors: fieldErrors(input.error) };
  const collection = await db.collection.create({ data: input.data, select: { id: true } });
  refresh();
  return { ok: true, data: { id: collection.id } };
}

const updateInput = collectionInputSchema.extend({ id: idSchema });

export async function updateCollection(raw: z.input<typeof updateInput>): Promise<ActionResult> {
  const input = updateInput.safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error), fieldErrors: fieldErrors(input.error) };
  const { id, ...data } = input.data;
  const result = await db.collection.updateMany({ where: { id }, data });
  if (result.count === 0) return { ok: false, error: "That collection no longer exists." };
  refresh();
  return { ok: true, data: undefined };
}

export async function setCollectionFavorite(raw: { id: string; value: boolean }): Promise<ActionResult> {
  const input = z.object({ id: idSchema, value: z.boolean() }).safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };
  await db.collection.updateMany({ where: { id: input.data.id }, data: { isFavorite: input.data.value } });
  refresh();
  return { ok: true, data: undefined };
}

/**
 * Deletes the collection and its membership rows only. Documents stay in
 * the library, with their highlights, tags and other collections intact.
 */
export async function deleteCollection(rawId: string): Promise<ActionResult<{ keptDocuments: number }>> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: "Unknown collection." };
  const keptDocuments = await db.documentCollection.count({ where: { collectionId: id.data } });
  const result = await db.collection.deleteMany({ where: { id: id.data } });
  if (result.count === 0) return { ok: false, error: "That collection no longer exists." };
  refresh();
  return { ok: true, data: { keptDocuments } };
}
