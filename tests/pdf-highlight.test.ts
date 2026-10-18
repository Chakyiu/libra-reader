import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { db } = await import("@/lib/db");
const { createHighlight } = await import("@/lib/actions/highlights");

const passage = {
  quote: "a grammar of shadows",
  startOffset: 0,
  endOffset: 20,
  color: "YELLOW" as const,
};

beforeEach(async () => {
  await db.highlight.deleteMany();
  await db.document.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("highlights on a PDF page", () => {
  it("stores the page for a PDF and refuses a page-less passage", async () => {
    const pdf = await db.document.create({ data: { type: "PDF", title: "A Grammar of Shadows" } });
    const epub = await db.document.create({ data: { type: "EPUB", title: "The Long Afternoon" } });

    const missing = await createHighlight({ documentId: pdf.id, ...passage });
    expect(missing).toEqual({ ok: false, error: "That passage needs a page." });

    const created = await createHighlight({ documentId: pdf.id, ...passage, page: 2 });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.page).toBe(2);
    expect(created.data.quote).toBe(passage.quote);

    const book = await createHighlight({ documentId: epub.id, ...passage, page: 1 });
    expect(book).toEqual({ ok: false, error: "That passage needs a book location." });
    expect(await db.highlight.count()).toBe(1);
  });

  it("anchors an EPUB highlight by book location", async () => {
    const epub = await db.document.create({ data: { type: "EPUB", title: "The Long Afternoon" } });
    const cfi = "epubcfi(/6/14[xchapter_003]!4/8[.s64]:/4:c64/4:cp120/8[.text5]:/4:c38)";

    const created = await createHighlight({ documentId: epub.id, ...passage, cfi });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.cfi).toBe(cfi);
    expect(created.data.page).toBeNull();

    const stray = await createHighlight({ documentId: epub.id, ...passage, cfi, page: 4 });
    expect(stray.ok).toBe(true);
    if (!stray.ok) return;
    expect(stray.data.cfi).toBe(cfi);
  });

  it("does not keep a book location on an article highlight", async () => {
    const article = await db.document.create({
      data: { type: "ARTICLE", title: "Field Notes", contentHtml: "<p>The tide tables disagree with the harbourmaster.</p>" },
    });

    const created = await createHighlight({ documentId: article.id, ...passage, cfi: "epubcfi(/6/4!/4:0)" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.cfi).toBeNull();
  });
});
