const WORDS_PER_MINUTE = 230;
const CJK_CHARS_PER_MINUTE = 500;
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;

export function countWords(text: string): number {
  const cjk = text.match(CJK)?.length ?? 0;
  const words = text.replace(CJK, " ").match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0;
  return words + Math.round(cjk / 2);
}

export function estimateReadingMinutes(text: string): number {
  const cjk = text.match(CJK)?.length ?? 0;
  const words = text.replace(CJK, " ").match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE + cjk / CJK_CHARS_PER_MINUTE));
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** A short plain-text summary that ends on a word boundary. */
export function makeExcerpt(text: string, max = 220): string {
  const clean = collapseWhitespace(text);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const sentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  if (sentenceEnd > max * 0.55) return cut.slice(0, sentenceEnd + 1);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 0 ? space : max).replace(/[,;:\s]+$/, "")}…`;
}

/** An excerpt that starts at the first substantial line, so headings don't lead it. */
export function excerptFromLines(text: string, max = 220): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const first = lines.findIndex((line) => line.length >= 60);
  return makeExcerpt((first === -1 ? lines : lines.slice(first)).join(" "), max);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Notes are plain text; blank lines become paragraphs and single newlines become line breaks. */
export function noteBodyToHtml(body: string): string {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.split("\n").map(escapeHtml).join("<br>")}</p>`)
    .join("\n");
}

/** Title for a link saved without a readable copy: the address itself, never an invented headline. */
export function linkOnlyTitle(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : decodeURIComponent(parsed.pathname).replace(/\/$/, "");
    return `${parsed.hostname.replace(/^www\./, "")}${path}`.slice(0, 200);
  } catch {
    return url.slice(0, 200);
  }
}

export function prettyHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** "a-field_guide.pdf" → "A field guide" */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!base) return "Untitled document";
  return base.charAt(0).toUpperCase() + base.slice(1);
}
