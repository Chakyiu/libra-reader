import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { DocumentType, ReadingStatus } from "@/lib/generated/prisma/enums";
import { headingsFromHtml } from "@/lib/sanitize";
import { makeSnippet, markTerms, searchTerms } from "@/lib/snippets";
import { storageDir, databaseUrl } from "@/lib/env";
import {
  DEFAULT_ASSIST_BASE_URL,
  DEFAULT_ASSIST_MODEL,
  DEFAULT_PREFERENCES,
  isAssistAnswerKind,
  type AssistAnswer,
  type AssistPromptItem,
  type AssistStatus,
  type CollectionSummary,
  type DocumentAssist,
  type DocumentListItem,
  type HighlightItem,
  type HighlightWithSource,
  type Preferences,
  type ReaderDocument,
  type ShellData,
  type SnippetSegment,
} from "@/lib/types";
import { parseReadingLocation, type HighlightFilters, type LibraryFilters } from "@/lib/validation";

const listSelect = {
  id: true,
  title: true,
  author: true,
  publication: true,
  sourceUrl: true,
  type: true,
  status: true,
  importStatus: true,
  isFavorite: true,
  excerpt: true,
  readingMinutes: true,
  pageCount: true,
  progress: true,
  createdAt: true,
  lastOpenedAt: true,
  tags: { select: { tag: { select: { name: true } } }, orderBy: { tag: { name: "asc" } } },
  collections: { select: { collection: { select: { id: true, name: true, color: true } } } },
  _count: { select: { highlights: true } },
} satisfies Prisma.DocumentSelect;

type ListRow = Prisma.DocumentGetPayload<{ select: typeof listSelect }>;

function toListItem(row: ListRow): DocumentListItem {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    publication: row.publication,
    sourceUrl: row.sourceUrl,
    type: row.type,
    status: row.status,
    importStatus: row.importStatus,
    isFavorite: row.isFavorite,
    excerpt: row.excerpt,
    readingMinutes: row.readingMinutes,
    pageCount: row.pageCount,
    progress: row.progress,
    createdAt: row.createdAt,
    lastOpenedAt: row.lastOpenedAt,
    tags: row.tags.map((t) => t.tag.name),
    collections: row.collections
      .map((c) => c.collection)
      .sort((a, b) => a.name.localeCompare(b.name)),
    highlightCount: row._count.highlights,
  };
}

const highlightSelect = {
  id: true,
  documentId: true,
  quote: true,
  prefix: true,
  suffix: true,
  context: true,
  startOffset: true,
  endOffset: true,
  page: true,
  cfi: true,
  color: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.HighlightSelect;

/* ------------------------------------------------------------------ shell */

export async function getShellData(): Promise<ShellData> {
  const [byStatus, favorites, highlights, collections, tags] = await Promise.all([
    db.document.groupBy({ by: ["status"], _count: { _all: true } }),
    db.document.count({ where: { isFavorite: true } }),
    db.highlight.count(),
    db.collection.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { documents: true } } },
    }),
    db.tag.findMany({
      where: { documents: { some: {} } },
      orderBy: { name: "asc" },
      include: { _count: { select: { documents: true } } },
    }),
  ]);

  const status = (s: ReadingStatus) => byStatus.find((row) => row.status === s)?._count._all ?? 0;
  const inbox = status("INBOX");
  const reading = status("READING");
  const archived = status("ARCHIVED");

  return {
    counts: { library: inbox + reading, inbox, reading, archived, favorites, highlights, total: inbox + reading + archived },
    collections: collections.map(toCollectionSummary),
    tags: tags.map((tag) => ({ name: tag.name, count: tag._count.documents })),
  };
}

function toCollectionSummary(
  row: Prisma.CollectionGetPayload<{ include: { _count: { select: { documents: true } } } }>,
): CollectionSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    isFavorite: row.isFavorite,
    documentCount: row._count.documents,
    createdAt: row.createdAt,
  };
}

export async function getPreferences(): Promise<Preferences> {
  const row = await db.preference.findUnique({ where: { id: 1 } });
  if (!row) return DEFAULT_PREFERENCES;
  return {
    theme: row.theme,
    font: row.font,
    fontSize: row.fontSize,
    lineHeight: row.lineHeight,
    columnWidth: row.columnWidth,
  };
}

export async function getAssistStatus(): Promise<AssistStatus> {
  const row = await db.assistConfig.findUnique({ where: { id: 1 }, select: { baseUrl: true, model: true, apiKey: true } });
  if (!row) return { configured: false, hasKey: false, baseUrl: DEFAULT_ASSIST_BASE_URL, model: DEFAULT_ASSIST_MODEL };
  return { configured: true, hasKey: row.apiKey.length > 0, baseUrl: row.baseUrl, model: row.model };
}

function toAssistAnswer(note: {
  id: string;
  kind: string;
  question: string | null;
  answer: string;
  model: string;
  updatedAt: Date;
}): AssistAnswer {
  if (!isAssistAnswerKind(note.kind)) throw new Error("A prompt note is stored on the highlight, not as an Assist answer.");
  return {
    id: note.id,
    kind: note.kind,
    question: note.question,
    answer: note.answer,
    model: note.model,
    updatedAt: note.updatedAt.toISOString(),
  };
}

export async function getDocumentAssist(documentId: string): Promise<DocumentAssist> {
  const notes = await db.assistNote.findMany({ where: { documentId }, orderBy: { updatedAt: "desc" } });
  const summary = notes.find((note) => note.kind === "SUMMARY") ?? null;
  const outline = notes.find((note) => note.kind === "OUTLINE") ?? null;
  const explanations: Record<string, AssistAnswer> = {};
  const promptNotes: Record<string, { answer: string; model: string }> = {};
  for (const note of notes) {
    if (note.kind === "EXPLAIN" && note.highlightId && !explanations[note.highlightId]) {
      explanations[note.highlightId] = toAssistAnswer(note);
    }
    if (note.kind === "PROMPT" && note.highlightId && !promptNotes[note.highlightId]) {
      promptNotes[note.highlightId] = { answer: note.answer, model: note.model };
    }
  }
  return {
    summary: summary ? toAssistAnswer(summary) : null,
    outline: outline ? toAssistAnswer(outline) : null,
    questions: notes.filter((note) => note.kind === "QUESTION").slice(0, 8).map(toAssistAnswer),
    explanations,
    promptNotes,
  };
}

export async function listAssistPrompts(): Promise<AssistPromptItem[]> {
  const rows = await db.assistPrompt.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  return rows.map((row) => ({ id: row.id, name: row.name, body: row.body }));
}

/* ---------------------------------------------------------------- library */

const TYPE_FROM_PARAM: Record<Exclude<LibraryFilters["type"], "all">, DocumentType> = {
  article: "ARTICLE",
  pdf: "PDF",
  epub: "EPUB",
  note: "NOTE",
};

function textMatch(terms: string[]): Prisma.DocumentWhereInput[] {
  return terms.map((term) => ({
    OR: [
      { title: { contains: term } },
      { author: { contains: term } },
      { publication: { contains: term } },
      { tags: { some: { tag: { name: { contains: term } } } } },
    ],
  }));
}

export async function listDocuments(filters: LibraryFilters): Promise<DocumentListItem[]> {
  const and: Prisma.DocumentWhereInput[] = [];

  if (filters.status === "all") and.push({ status: { not: "ARCHIVED" } });
  else if (filters.status === "favorites") and.push({ isFavorite: true });
  else and.push({ status: filters.status.toUpperCase() as ReadingStatus });

  if (filters.type !== "all") and.push({ type: TYPE_FROM_PARAM[filters.type] });
  if (filters.tag) and.push({ tags: { some: { tag: { name: filters.tag } } } });
  if (filters.collection) and.push({ collections: { some: { collectionId: filters.collection } } });
  and.push(...textMatch(searchTerms(filters.q)));

  const orderBy: Prisma.DocumentOrderByWithRelationInput[] =
    filters.sort === "progress"
      ? [{ progress: "desc" }, { createdAt: "desc" }]
      : filters.sort === "opened"
        ? [{ lastOpenedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }];

  const rows = await db.document.findMany({ where: { AND: and }, select: listSelect, orderBy, take: 1000 });
  const items = rows.map(toListItem);
  if (filters.sort === "title") items.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  return items;
}

/* ------------------------------------------------------------------- home */

export interface HomeData {
  total: number;
  inProgress: number;
  continueReading: DocumentListItem | null;
  recent: DocumentListItem[];
  revisit: HighlightWithSource | null;
  favoriteCollections: CollectionSummary[];
}

export async function getHomeData(now: Date = new Date()): Promise<HomeData> {
  const [total, inProgress, continueRow, recentRows, favoriteCollections] = await Promise.all([
    db.document.count(),
    db.document.count({ where: { status: "READING", progress: { gt: 0 } } }),
    db.document.findFirst({
      where: { status: "READING", progress: { gt: 0, lt: 0.995 } },
      orderBy: [{ lastOpenedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      select: listSelect,
    }),
    db.document.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: listSelect,
    }),
    db.collection.findMany({
      where: { isFavorite: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { documents: true } } },
    }),
  ]);

  return {
    total,
    inProgress,
    continueReading: continueRow ? toListItem(continueRow) : null,
    recent: recentRows.map(toListItem),
    revisit: await pickDailyHighlight(now),
    favoriteCollections: favoriteCollections.map(toCollectionSummary),
  };
}

/** One highlight per day, preferring ones that carry a note; stable within a day. */
async function pickDailyHighlight(now: Date): Promise<HighlightWithSource | null> {
  const day = Math.floor(now.getTime() / 86_400_000);
  const withNotes = await db.highlight.count({ where: { note: { not: null } } });
  const where: Prisma.HighlightWhereInput = withNotes > 0 ? { note: { not: null } } : {};
  const count = withNotes > 0 ? withNotes : await db.highlight.count();
  if (count === 0) return null;
  const row = await db.highlight.findFirst({
    where,
    orderBy: { createdAt: "asc" },
    skip: day % count,
    select: { ...highlightSelect, document: { select: highlightSourceSelect } },
  });
  return row ? toHighlightWithSource(row) : null;
}

/* ----------------------------------------------------------------- reader */

export interface ReaderData {
  document: ReaderDocument;
  highlights: HighlightItem[];
}

export async function getReaderData(id: string): Promise<ReaderData | null> {
  const row = await db.document.findUnique({
    where: { id },
    select: {
      ...listSelect,
      contentHtml: true,
      contentText: true,
      importError: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      wordCount: true,
      readingLocation: true,
      highlights: { select: highlightSelect, orderBy: { startOffset: "asc" } },
    },
  });
  if (!row) return null;
  const {
    highlights,
    contentHtml,
    contentText,
    importError,
    fileName,
    fileSize,
    mimeType,
    wordCount,
    readingLocation,
    ...rest
  } = row;
  return {
    document: {
      ...toListItem(rest),
      contentHtml,
      noteBody: rest.type === "NOTE" ? (contentText ?? "") : null,
      headings: contentHtml ? headingsFromHtml(contentHtml) : [],
      importError,
      fileName,
      fileSize,
      mimeType,
      wordCount,
      location: parseReadingLocation(readingLocation),
    },
    highlights,
  };
}

export async function listCollectionRefs(): Promise<CollectionSummary[]> {
  const rows = await db.collection.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { documents: true } } },
  });
  return rows.map(toCollectionSummary);
}

export async function listTagNames(): Promise<string[]> {
  const rows = await db.tag.findMany({ where: { documents: { some: {} } }, orderBy: { name: "asc" } });
  return rows.map((row) => row.name);
}

/* ------------------------------------------------------------- highlights */

const highlightSourceSelect = {
  id: true,
  title: true,
  author: true,
  publication: true,
  type: true,
  tags: { select: { tag: { select: { name: true } } }, orderBy: { tag: { name: "asc" } } },
} satisfies Prisma.DocumentSelect;

type HighlightRow = Prisma.HighlightGetPayload<{
  select: typeof highlightSelect & { document: { select: typeof highlightSourceSelect } };
}>;

function toHighlightWithSource(row: HighlightRow): HighlightWithSource {
  const { document, ...highlight } = row;
  return {
    ...highlight,
    document: {
      id: document.id,
      title: document.title,
      author: document.author,
      publication: document.publication,
      type: document.type,
      tags: document.tags.map((t) => t.tag.name),
    },
  };
}

export interface HighlightsPageData {
  highlights: HighlightWithSource[];
  total: number;
  sources: Array<{ id: string; title: string }>;
  tags: string[];
}

export async function listHighlights(filters: HighlightFilters): Promise<HighlightsPageData> {
  const and: Prisma.HighlightWhereInput[] = [];
  if (filters.color) and.push({ color: filters.color });
  if (filters.document) and.push({ documentId: filters.document });
  if (filters.collection) and.push({ document: { collections: { some: { collectionId: filters.collection } } } });
  if (filters.tag) and.push({ document: { tags: { some: { tag: { name: filters.tag } } } } });
  for (const term of searchTerms(filters.q)) {
    and.push({
      OR: [
        { quote: { contains: term } },
        { note: { contains: term } },
        { document: { title: { contains: term } } },
        { document: { author: { contains: term } } },
      ],
    });
  }

  const [rows, total, sources, tagRows] = await Promise.all([
    db.highlight.findMany({
      where: { AND: and },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { ...highlightSelect, document: { select: highlightSourceSelect } },
    }),
    db.highlight.count(),
    db.document.findMany({
      where: { highlights: { some: {} } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    db.tag.findMany({
      where: { documents: { some: { document: { highlights: { some: {} } } } } },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  const generated = rows.length
    ? await db.assistNote.findMany({
        where: { kind: { in: ["EXPLAIN", "PROMPT"] }, highlightId: { in: rows.map((row) => row.id) } },
        orderBy: { updatedAt: "desc" },
        select: { highlightId: true, kind: true, answer: true, model: true },
      })
    : [];
  const explanationByHighlight = new Map<string, { answer: string; model: string }>();
  const promptByHighlight = new Map<string, { answer: string; model: string }>();
  for (const note of generated) {
    if (!note.highlightId) continue;
    const target = note.kind === "EXPLAIN" ? explanationByHighlight : promptByHighlight;
    if (!target.has(note.highlightId)) target.set(note.highlightId, { answer: note.answer, model: note.model });
  }

  return {
    highlights: rows.map((row) => {
      const prompt = promptByHighlight.get(row.id);
      return {
        ...toHighlightWithSource(row),
        explanation: explanationByHighlight.get(row.id) ?? null,
        generatedModel: prompt && prompt.answer === row.note ? prompt.model : null,
      };
    }),
    total,
    sources,
    tags: tagRows.map((t) => t.name),
  };
}

/* ------------------------------------------------------------ collections */

export async function getCollection(id: string): Promise<{ collection: CollectionSummary; documents: DocumentListItem[] } | null> {
  const row = await db.collection.findUnique({
    where: { id },
    include: { _count: { select: { documents: true } } },
  });
  if (!row) return null;
  const documents = await db.document.findMany({
    where: { collections: { some: { collectionId: id } } },
    orderBy: { createdAt: "desc" },
    select: listSelect,
  });
  return { collection: toCollectionSummary(row), documents: documents.map(toListItem) };
}

/* ----------------------------------------------------------------- search */

export interface SearchDocumentHit {
  document: DocumentListItem;
  title: SnippetSegment[];
  snippet: SnippetSegment[];
}

export interface SearchHighlightHit {
  highlight: HighlightWithSource;
  quote: SnippetSegment[];
  note: SnippetSegment[] | null;
}

export interface SearchNoteHit {
  kind: "highlight" | "document";
  id: string;
  documentId: string;
  title: string;
  snippet: SnippetSegment[];
}

export interface SearchResults {
  query: string;
  documents: SearchDocumentHit[];
  text: SearchDocumentHit[];
  highlights: SearchHighlightHit[];
  notes: SearchNoteHit[];
}

const searchSelect = { ...listSelect, contentText: true } satisfies Prisma.DocumentSelect;

export async function searchLibrary(query: string): Promise<SearchResults> {
  const terms = searchTerms(query);
  const empty: SearchResults = { query, documents: [], text: [], highlights: [], notes: [] };
  if (terms.length === 0) return empty;

  const metaWhere: Prisma.DocumentWhereInput = {
    AND: terms.map((term) => ({
      OR: [{ title: { contains: term } }, { author: { contains: term } }, { publication: { contains: term } }],
    })),
  };
  const textWhere: Prisma.DocumentWhereInput = { AND: terms.map((term) => ({ contentText: { contains: term } })) };

  const [metaRows, textRows, highlightRows, noteRows] = await Promise.all([
    db.document.findMany({ where: metaWhere, select: searchSelect, orderBy: { createdAt: "desc" }, take: 25 }),
    db.document.findMany({ where: textWhere, select: searchSelect, orderBy: { createdAt: "desc" }, take: 40 }),
    db.highlight.findMany({
      where: { AND: terms.map((term) => ({ quote: { contains: term } })) },
      select: { ...highlightSelect, document: { select: highlightSourceSelect } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.highlight.findMany({
      where: { AND: terms.map((term) => ({ note: { contains: term } })) },
      select: { ...highlightSelect, document: { select: highlightSourceSelect } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const metaIds = new Set(metaRows.map((row) => row.id));
  const documents = metaRows.map((row) => {
    const { contentText, ...rest } = row;
    const description = rest.excerpt || contentText || "";
    return {
      document: toListItem(rest),
      title: markTerms(rest.title, terms),
      snippet: makeSnippet(description, terms, 200),
    };
  });

  const notes: SearchNoteHit[] = [];
  const text: SearchDocumentHit[] = [];
  for (const row of textRows) {
    if (metaIds.has(row.id)) continue;
    const { contentText, ...rest } = row;
    if (rest.type === "NOTE") {
      notes.push({
        kind: "document",
        id: rest.id,
        documentId: rest.id,
        title: rest.title,
        snippet: makeSnippet(contentText ?? "", terms),
      });
    } else {
      text.push({ document: toListItem(rest), title: markTerms(rest.title, terms), snippet: makeSnippet(contentText ?? "", terms) });
    }
  }

  for (const row of noteRows) {
    notes.push({
      kind: "highlight",
      id: row.id,
      documentId: row.documentId,
      title: row.document.title,
      snippet: makeSnippet(row.note ?? "", terms),
    });
  }

  const highlights = highlightRows.map((row) => {
    const highlight = toHighlightWithSource(row);
    return {
      highlight,
      quote: markTerms(highlight.quote, terms),
      note: highlight.note ? markTerms(highlight.note, terms) : null,
    };
  });

  return { query, documents, text: text.slice(0, 25), highlights, notes };
}

/* --------------------------------------------------------------- settings */

export interface LibraryStats {
  documents: number;
  highlights: number;
  collections: number;
  storagePath: string;
  databasePath: string;
}

export async function getLibraryStats(): Promise<LibraryStats> {
  const [documents, highlights, collections] = await Promise.all([
    db.document.count(),
    db.highlight.count(),
    db.collection.count(),
  ]);
  return {
    documents,
    highlights,
    collections,
    storagePath: storageDir(),
    databasePath: databaseUrl().replace(/^file:/, ""),
  };
}
