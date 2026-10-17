import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { db } = await import("@/lib/db");
const { createCollection, deleteCollection } = await import("@/lib/actions/collections");
const { addToCollection } = await import("@/lib/actions/documents");

async function makeDocument(title: string) {
  return db.document.create({
    data: { type: "NOTE", title, contentHtml: "<p>body</p>", contentText: "body" },
  });
}

beforeEach(async () => {
  await db.highlight.deleteMany();
  await db.documentCollection.deleteMany();
  await db.documentTag.deleteMany();
  await db.collection.deleteMany();
  await db.tag.deleteMany();
  await db.document.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("deleting a collection", () => {
  it("removes the collection and memberships but keeps every document", async () => {
    const [first, second] = await Promise.all([makeDocument("First"), makeDocument("Second")]);
    await db.highlight.create({
      data: { documentId: first.id, quote: "body", startOffset: 0, endOffset: 4, note: "keep me" },
    });

    const created = await createCollection({ name: "Field Notes", color: "SAGE" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const other = await createCollection({ name: "Other" });
    if (!other.ok) throw new Error("setup failed");

    await addToCollection({ ids: [first.id, second.id], collectionId: created.data.id });
    await addToCollection({ ids: [first.id], collectionId: other.data.id });

    const result = await deleteCollection(created.data.id);
    expect(result).toEqual({ ok: true, data: { keptDocuments: 2 } });

    expect(await db.collection.findUnique({ where: { id: created.data.id } })).toBeNull();
    expect(await db.document.count()).toBe(2);
    expect(await db.documentCollection.count({ where: { collectionId: created.data.id } })).toBe(0);
    // Other collections and highlights are untouched.
    expect(await db.documentCollection.count({ where: { collectionId: other.data.id } })).toBe(1);
    expect(await db.highlight.findFirst({ where: { documentId: first.id } })).toMatchObject({ note: "keep me" });
  });

  it("validates ids and reports missing collections", async () => {
    expect(await deleteCollection("../../etc")).toEqual({ ok: false, error: "Unknown collection." });
    expect(await deleteCollection("doesnotexist")).toEqual({ ok: false, error: "That collection no longer exists." });
  });

  it("rejects invalid collection input", async () => {
    const result = await createCollection({ name: "  " });
    expect(result.ok).toBe(false);
  });
});
