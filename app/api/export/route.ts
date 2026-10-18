import { db } from "@/lib/db";
import { getPreferences } from "@/lib/queries";
import { parseReadingLocation } from "@/lib/validation";

export const runtime = "nodejs";

/** Everything the user has made, as one portable JSON file. Original PDF/EPUB bytes stay in storage. */
export async function GET(): Promise<Response> {
  const [documents, collections, tags, highlights, preferences, assist, prompts] = await Promise.all([
    db.document.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        tags: { include: { tag: { select: { name: true } } } },
        collections: { select: { collectionId: true, addedAt: true } },
      },
    }),
    db.collection.findMany({ orderBy: { createdAt: "asc" } }),
    db.tag.findMany({ orderBy: { name: "asc" }, select: { name: true, createdAt: true } }),
    db.highlight.findMany({ orderBy: [{ documentId: "asc" }, { startOffset: "asc" }] }),
    getPreferences(),
    db.assistNote.findMany({ orderBy: [{ documentId: "asc" }, { createdAt: "asc" }] }),
    db.assistPrompt.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
  ]);

  const payload = {
    format: "libra-reader-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    preferences,
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      color: c.color,
      isFavorite: c.isFavorite,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    tags,
    documents: documents.map((d) => ({
      id: d.id,
      type: d.type,
      title: d.title,
      author: d.author,
      publication: d.publication,
      sourceUrl: d.sourceUrl,
      status: d.status,
      importStatus: d.importStatus,
      isFavorite: d.isFavorite,
      excerpt: d.excerpt,
      contentHtml: d.contentHtml,
      contentText: d.contentText,
      wordCount: d.wordCount,
      readingMinutes: d.readingMinutes,
      pageCount: d.pageCount,
      progress: d.progress,
      readingLocation: parseReadingLocation(d.readingLocation),
      file: d.filePath
        ? { name: d.fileName, size: d.fileSize, mimeType: d.mimeType, bytesIncluded: false }
        : null,
      tags: d.tags.map((t) => t.tag.name),
      collections: d.collections.map((c) => ({ id: c.collectionId, addedAt: c.addedAt })),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      lastOpenedAt: d.lastOpenedAt,
      archivedAt: d.archivedAt,
    })),
    highlights: highlights.map((h) => ({
      id: h.id,
      documentId: h.documentId,
      quote: h.quote,
      prefix: h.prefix,
      suffix: h.suffix,
      context: h.context,
      startOffset: h.startOffset,
      endOffset: h.endOffset,
      page: h.page,
      color: h.color,
      note: h.note,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
    })),
    assist: assist.map((note) => ({
      id: note.id,
      documentId: note.documentId,
      highlightId: note.highlightId,
      kind: note.kind,
      question: note.question,
      answer: note.answer,
      model: note.model,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    })),
    prompts: prompts.map((prompt) => ({
      id: prompt.id,
      name: prompt.name,
      body: prompt.body,
      position: prompt.position,
    })),
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="libra-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
