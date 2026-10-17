import type { DocumentType, ReadingStatus } from "@/lib/generated/prisma/enums";

export const TYPE_LABEL: Record<DocumentType, string> = {
  ARTICLE: "Article",
  PDF: "PDF",
  EPUB: "EPUB",
  NOTE: "Note",
};

export const STATUS_LABEL: Record<ReadingStatus, string> = {
  INBOX: "Inbox",
  READING: "Reading",
  ARCHIVED: "Archived",
};

export const STATUS_CHIP: Record<ReadingStatus, string> = {
  INBOX: "In inbox",
  READING: "Reading",
  ARCHIVED: "Archived",
};

export function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h} hr ${m} min` : `${h} hr`;
  }
  return `${Math.max(1, minutes)} min`;
}

/** Reading time when known, otherwise the page count; never a guess. */
export function lengthLabel(document: { readingMinutes: number | null; pageCount: number | null }): string | null {
  if (document.readingMinutes) return formatMinutes(document.readingMinutes);
  if (document.pageCount) return `${document.pageCount} pages`;
  return null;
}

export function minutesLeft(minutes: number, progress: number): number {
  return Math.max(1, Math.round(minutes * (1 - progress)));
}

export function formatDate(value: Date | string, now: Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function formatLongDate(value: Date): string {
  return value.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function percent(progress: number): number {
  return Math.round(Math.min(1, Math.max(0, progress)) * 100);
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "for", "on", "in", "to"]);

/** Two-letter bookplate monogram from a publication or title: "Slow Transit" → "ST". */
export function monogram(...sources: Array<string | null | undefined>): string {
  const source = sources.find((s) => s && s.trim())?.trim() ?? "";
  const words = source
    .replace(/https?:\/\//, "")
    .split(/[\s./_–—-]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const meaningful = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  const pool = meaningful.length ? meaningful : words;
  if (pool.length === 0) return "Li";
  if (pool.length === 1) {
    const word = pool[0] ?? "";
    const camel = word.match(/^(\p{Lu})\p{Ll}*(\p{Lu})/u);
    if (camel?.[1] && camel[2]) return `${camel[1]}${camel[2]}`;
    return word.slice(0, 2).toUpperCase() || "LI";
  }
  return `${(pool[0] ?? "").charAt(0)}${(pool[1] ?? "").charAt(0)}`.toUpperCase();
}

export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
