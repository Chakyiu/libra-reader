import type { SnippetSegment } from "@/lib/types";

export function searchTerms(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.replace(/^["'“”‘’]+|["'“”‘’]+$/g, ""))
        .filter((term) => term.length > 0),
    ),
  ].slice(0, 8);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Splits text into plain and matching segments so matches render without innerHTML. */
export function markTerms(text: string, terms: string[]): SnippetSegment[] {
  if (terms.length === 0 || !text) return [{ text, hit: false }];
  const pattern = new RegExp(`(${terms.map(escapeRegExp).sort((a, b) => b.length - a.length).join("|")})`, "gi");
  const segments: SnippetSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: text.slice(last, index), hit: false });
    segments.push({ text: match[0], hit: true });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), hit: false });
  return segments;
}

/** A window of text around the first match, trimmed to word boundaries. */
export function makeSnippet(text: string, terms: string[], width = 220): SnippetSegment[] {
  const flat = text.replace(/\s+/g, " ").trim();
  const lower = flat.toLowerCase();
  const hits = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0);
  const first = hits.length ? Math.min(...hits) : 0;

  let start = Math.max(0, first - Math.round(width * 0.35));
  let end = Math.min(flat.length, start + width);
  if (start > 0) {
    const space = flat.indexOf(" ", start);
    if (space !== -1 && space < first) start = space + 1;
  }
  if (end < flat.length) {
    const space = flat.lastIndexOf(" ", end);
    if (space > first) end = space;
  }

  const window = `${start > 0 ? "… " : ""}${flat.slice(start, end)}${end < flat.length ? " …" : ""}`;
  return markTerms(window, terms);
}
