/**
 * Development seed. Adds an original sample library to an EMPTY database
 * only; if anything already exists it does nothing, so user data is never
 * touched. Refuses to run in production unless LIBRA_ALLOW_SEED=1.
 */
import "dotenv/config";
import { JSDOM } from "jsdom";
import { describeTextRange, surroundingSentence } from "../lib/anchoring/text-anchor";
import { readEpub } from "../lib/files";
import { createPrismaClient } from "../lib/prisma";
import { countWords, estimateReadingMinutes, excerptFromLines, makeExcerpt, noteBodyToHtml } from "../lib/reading";
import { buildSampleEpub, buildSamplePdf } from "../lib/samples";
import { htmlToPlainText, sanitizeArticleHtml } from "../lib/sanitize";
import { saveUpload } from "../lib/storage";
import type { HighlightColor } from "../lib/generated/prisma/enums";
import { SAMPLE_ARTICLES, SAMPLE_COLLECTIONS, SAMPLE_EPUB, SAMPLE_NOTE, SAMPLE_PDF } from "./sample-content";

const prisma = createPrismaClient();
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

/** Offsets must match what the browser sees: textContent of the rendered article body. */
function highlightData(html: string, spec: { quote: string; color: HighlightColor; note?: string; daysAgo: number }) {
  const text = JSDOM.fragment(html).textContent ?? "";
  const start = text.indexOf(spec.quote);
  if (start === -1) throw new Error(`Sample highlight not found in its article: ${spec.quote}`);
  const selector = describeTextRange(text, start, start + spec.quote.length);
  return {
    quote: selector.exact,
    prefix: selector.prefix,
    suffix: selector.suffix,
    context: surroundingSentence(text, selector.start, selector.end),
    startOffset: selector.start,
    endOffset: selector.end,
    color: spec.color,
    note: spec.note ?? null,
    createdAt: ago(spec.daysAgo),
  };
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.LIBRA_ALLOW_SEED !== "1") {
    console.log("[seed] NODE_ENV is production; refusing to add sample data. Set LIBRA_ALLOW_SEED=1 to override.");
    return;
  }

  const [documents, collections, highlights, tags] = await Promise.all([
    prisma.document.count(),
    prisma.collection.count(),
    prisma.highlight.count(),
    prisma.tag.count(),
  ]);
  if (documents + collections + highlights + tags > 0) {
    console.log("[seed] The library already has data, so nothing was added. Seeding only ever fills an empty database.");
    return;
  }

  const collectionIds = new Map<string, string>();
  for (const [index, collection] of SAMPLE_COLLECTIONS.entries()) {
    const created = await prisma.collection.create({
      data: {
        name: collection.name,
        description: collection.description,
        color: collection.color,
        isFavorite: collection.isFavorite,
        createdAt: ago(40 - index),
      },
    });
    collectionIds.set(collection.key, created.id);
  }

  const tagIds = new Map<string, string>();
  const tagId = async (name: string) => {
    const existing = tagIds.get(name);
    if (existing) return existing;
    const created = await prisma.tag.create({ data: { name } });
    tagIds.set(name, created.id);
    return created.id;
  };

  const link = async (documentId: string, collectionKeys: string[], tagNames: string[]) => {
    for (const key of collectionKeys) {
      const collectionId = collectionIds.get(key);
      if (collectionId) await prisma.documentCollection.create({ data: { documentId, collectionId } });
    }
    for (const name of tagNames) await prisma.documentTag.create({ data: { documentId, tagId: await tagId(name) } });
  };

  for (const article of SAMPLE_ARTICLES) {
    const contentHtml = sanitizeArticleHtml(article.html);
    const contentText = htmlToPlainText(contentHtml);
    const created = await prisma.document.create({
      data: {
        type: "ARTICLE",
        title: article.title,
        author: article.author,
        publication: article.publication,
        sourceUrl: article.sourceUrl,
        status: article.status,
        isFavorite: article.isFavorite,
        progress: article.progress,
        contentHtml,
        contentText,
        excerpt: makeExcerpt(contentText),
        wordCount: countWords(contentText),
        readingMinutes: estimateReadingMinutes(contentText),
        createdAt: ago(article.daysAgo),
        lastOpenedAt: article.progress > 0 ? ago(Math.max(0, article.daysAgo - 1)) : null,
        archivedAt: article.status === "ARCHIVED" ? ago(Math.max(0, article.daysAgo - 2)) : null,
      },
    });
    await link(created.id, article.collections, article.tags);
    for (const spec of article.highlights) {
      await prisma.highlight.create({ data: { documentId: created.id, ...highlightData(contentHtml, spec) } });
    }
  }

  const noteHtml = noteBodyToHtml(SAMPLE_NOTE.body);
  const note = await prisma.document.create({
    data: {
      type: "NOTE",
      title: SAMPLE_NOTE.title,
      contentHtml: noteHtml,
      contentText: SAMPLE_NOTE.body,
      excerpt: makeExcerpt(SAMPLE_NOTE.body),
      wordCount: countWords(SAMPLE_NOTE.body),
      readingMinutes: estimateReadingMinutes(SAMPLE_NOTE.body),
      createdAt: ago(SAMPLE_NOTE.daysAgo),
    },
  });
  await link(note.id, SAMPLE_NOTE.collections, SAMPLE_NOTE.tags);
  for (const spec of SAMPLE_NOTE.highlights) {
    await prisma.highlight.create({ data: { documentId: note.id, ...highlightData(noteHtml, spec) } });
  }

  const pdf = buildSamplePdf({ title: SAMPLE_PDF.title, author: SAMPLE_PDF.author }, SAMPLE_PDF.pages);
  const storedPdf = await saveUpload(pdf, "pdf");
  const pdfText = SAMPLE_PDF.pages.flatMap((page) => [page.heading ?? "", ...page.paragraphs]).join("\n").trim();
  const pdfDoc = await prisma.document.create({
    data: {
      type: "PDF",
      title: SAMPLE_PDF.title,
      author: SAMPLE_PDF.author,
      publication: SAMPLE_PDF.publication,
      filePath: storedPdf.relativePath,
      fileName: "a-grammar-of-shadows.pdf",
      fileSize: pdf.length,
      mimeType: "application/pdf",
      pageCount: SAMPLE_PDF.pages.length,
      contentText: pdfText,
      excerpt: excerptFromLines(pdfText),
      wordCount: countWords(pdfText),
      readingMinutes: estimateReadingMinutes(pdfText),
      createdAt: ago(SAMPLE_PDF.daysAgo),
    },
  });
  await link(pdfDoc.id, SAMPLE_PDF.collections, SAMPLE_PDF.tags);

  const epub = await buildSampleEpub(
    { title: SAMPLE_EPUB.title, author: SAMPLE_EPUB.author, publisher: SAMPLE_EPUB.publisher, id: "urn:libra:sample:long-now" },
    SAMPLE_EPUB.chapters,
  );
  const epubDetails = await readEpub(epub);
  const storedEpub = await saveUpload(epub, "epub");
  const epubText = epubDetails?.text ?? "";
  const epubDoc = await prisma.document.create({
    data: {
      type: "EPUB",
      title: SAMPLE_EPUB.title,
      author: SAMPLE_EPUB.author,
      publication: SAMPLE_EPUB.publisher,
      filePath: storedEpub.relativePath,
      fileName: "the-long-now-of-software-maintenance.epub",
      fileSize: epub.length,
      mimeType: "application/epub+zip",
      contentText: epubText || null,
      excerpt: epubText ? excerptFromLines(epubText) : null,
      wordCount: countWords(epubText),
      readingMinutes: epubText ? estimateReadingMinutes(epubText) : null,
      status: "READING",
      progress: 0.23,
      createdAt: ago(SAMPLE_EPUB.daysAgo),
      lastOpenedAt: ago(3),
    },
  });
  await link(epubDoc.id, SAMPLE_EPUB.collections, SAMPLE_EPUB.tags);

  await prisma.preference.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const total = await prisma.document.count();
  console.log(`[seed] Added ${total} sample documents, ${SAMPLE_COLLECTIONS.length} collections and their highlights.`);
}

main()
  .catch((error) => {
    console.error("[seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
