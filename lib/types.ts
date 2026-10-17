import type {
  CollectionColor,
  DocumentType,
  HighlightColor,
  ImportStatus,
  ReaderFont,
  ReadingStatus,
  ThemePreference,
} from "@/lib/generated/prisma/enums";
import type { ReadingLocation } from "@/lib/validation";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export interface CollectionRef {
  id: string;
  name: string;
  color: CollectionColor;
}

export interface DocumentListItem {
  id: string;
  title: string;
  author: string | null;
  publication: string | null;
  sourceUrl: string | null;
  type: DocumentType;
  status: ReadingStatus;
  importStatus: ImportStatus;
  isFavorite: boolean;
  excerpt: string | null;
  readingMinutes: number | null;
  pageCount: number | null;
  progress: number;
  createdAt: Date;
  lastOpenedAt: Date | null;
  tags: string[];
  collections: CollectionRef[];
  highlightCount: number;
}

export interface ReaderDocument extends DocumentListItem {
  contentHtml: string | null;
  /** Plain-text body, only for notes (so they can be edited). */
  noteBody: string | null;
  headings: Array<{ id: string; text: string; level: number }>;
  importError: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  wordCount: number;
  location: ReadingLocation | null;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string;
  color: CollectionColor;
  isFavorite: boolean;
  documentCount: number;
  createdAt: Date;
}

export interface TagSummary {
  name: string;
  count: number;
}

export interface ShellCounts {
  library: number;
  inbox: number;
  reading: number;
  archived: number;
  favorites: number;
  highlights: number;
  total: number;
}

export interface ShellData {
  counts: ShellCounts;
  collections: CollectionSummary[];
  tags: TagSummary[];
}

export interface HighlightItem {
  id: string;
  documentId: string;
  quote: string;
  prefix: string;
  suffix: string;
  context: string;
  startOffset: number;
  endOffset: number;
  color: HighlightColor;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HighlightSource {
  id: string;
  title: string;
  author: string | null;
  publication: string | null;
  type: DocumentType;
  tags: string[];
}

export interface HighlightWithSource extends HighlightItem {
  document: HighlightSource;
  /** A saved explanation of this passage, when the highlights page loaded one. */
  explanation?: { answer: string; model: string } | null;
}

export interface Preferences {
  theme: ThemePreference;
  font: ReaderFont;
  fontSize: number;
  lineHeight: number;
  columnWidth: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "SYSTEM",
  font: "SERIF",
  fontSize: 19,
  lineHeight: 1.7,
  columnWidth: 66,
};

export interface SnippetSegment {
  text: string;
  hit: boolean;
}

export type AssistKindName = "SUMMARY" | "OUTLINE" | "QUESTION" | "EXPLAIN";

export const DEFAULT_ASSIST_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_ASSIST_MODEL = "gpt-4o-mini";

/** What the browser is allowed to know. The API key is never included. */
export interface AssistStatus {
  /** An endpoint and model have been saved. A key is not required. */
  configured: boolean;
  hasKey: boolean;
  baseUrl: string;
  model: string;
}

export interface AssistAnswer {
  id: string;
  kind: AssistKindName;
  question: string | null;
  answer: string;
  model: string;
  updatedAt: string;
}

export interface DocumentAssist {
  summary: AssistAnswer | null;
  outline: AssistAnswer | null;
  questions: AssistAnswer[];
  explanations: Record<string, AssistAnswer>;
}
