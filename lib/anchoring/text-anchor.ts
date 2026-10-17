/**
 * Text anchoring for highlights, modelled on the W3C Web Annotation
 * TextQuoteSelector + TextPositionSelector. Pure string functions so they
 * can be tested without a DOM and reused on the server.
 */

export const CONTEXT_LENGTH = 32;

export interface HighlightSelector {
  /** The highlighted text exactly as it appeared. */
  exact: string;
  /** Up to CONTEXT_LENGTH characters immediately before. */
  prefix: string;
  /** Up to CONTEXT_LENGTH characters immediately after. */
  suffix: string;
  /** Character offsets into the document text when the highlight was made. */
  start: number;
  end: number;
}

export type AnchorStrategy = "position" | "quote" | "normalized";

export interface AnchorMatch {
  start: number;
  end: number;
  strategy: AnchorStrategy;
}

export function describeTextRange(text: string, start: number, end: number): HighlightSelector {
  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.max(s, Math.min(end, text.length));
  return {
    exact: text.slice(s, e),
    prefix: text.slice(Math.max(0, s - CONTEXT_LENGTH), s),
    suffix: text.slice(e, e + CONTEXT_LENGTH),
    start: s,
    end: e,
  };
}

/** Shrinks [start, end) so it neither begins nor ends on whitespace. */
export function trimRange(text: string, start: number, end: number): { start: number; end: number } {
  let s = start;
  let e = end;
  while (s < e && /\s/.test(text.charAt(s))) s += 1;
  while (e > s && /\s/.test(text.charAt(e - 1))) e -= 1;
  return { start: s, end: e };
}

/** The sentence around a range, for showing a highlight outside the reader. */
export function surroundingSentence(text: string, start: number, end: number, max = 600): string {
  const boundary = /[.!?。！？]\s|\n/g;
  let from = 0;
  let to = text.length;
  for (let match = boundary.exec(text); match; match = boundary.exec(text)) {
    const at = match.index + match[0].length;
    if (at <= start) from = at;
    else if (match.index >= end) {
      to = match.index + 1;
      break;
    }
  }
  const sentence = text.slice(from, to).replace(/\s+/g, " ").trim();
  return sentence.length > max ? `${sentence.slice(0, max - 1)}…` : sentence;
}

function commonSuffixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n += 1;
  return n;
}

function commonPrefixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
}

function findAll(haystack: string, needle: string): number[] {
  const out: number[] = [];
  if (!needle) return out;
  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + 1)) {
    out.push(index);
  }
  return out;
}

/** Context agreement dominates; distance from the original offset only breaks ties. */
function bestCandidate(
  text: string,
  candidates: number[],
  length: number,
  prefix: string,
  suffix: string,
  hint: number,
): number | null {
  let best: number | null = null;
  let bestScore = -Infinity;
  for (const start of candidates) {
    const before = text.slice(Math.max(0, start - prefix.length), start);
    const after = text.slice(start + length, start + length + suffix.length);
    const context = commonSuffixLength(before, prefix) + commonPrefixLength(after, suffix);
    const score = context - Math.abs(start - hint) / (text.length + 1);
    if (score > bestScore) {
      bestScore = score;
      best = start;
    }
  }
  return best;
}

interface NormalizedText {
  text: string;
  /** map[i] = index in the original text of normalized character i */
  map: number[];
}

/** Collapses whitespace runs to one space while remembering where each character came from. */
function normalizeWithMap(input: string): NormalizedText {
  let text = "";
  const map: number[] = [];
  let inSpace = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charAt(i);
    if (/\s/.test(ch)) {
      if (!inSpace) {
        text += " ";
        map.push(i);
      }
      inSpace = true;
    } else {
      text += ch;
      map.push(i);
      inSpace = false;
    }
  }
  return { text, map };
}

const collapse = (value: string) => value.replace(/\s+/g, " ");

/**
 * Finds where a stored highlight belongs in (possibly changed) text.
 * 1. The stored offsets, if the quote is still there.
 * 2. Every exact occurrence of the quote, ranked by prefix/suffix agreement.
 * 3. The same search with whitespace collapsed, mapped back to real offsets.
 * Returns null when the passage is gone, so callers can say so honestly.
 */
export function anchorSelector(text: string, selector: HighlightSelector): AnchorMatch | null {
  const { exact, prefix, suffix, start, end } = selector;
  if (!exact) return null;

  if (start >= 0 && end <= text.length && end - start === exact.length && text.slice(start, end) === exact) {
    return { start, end, strategy: "position" };
  }

  const exactHit = bestCandidate(text, findAll(text, exact), exact.length, prefix, suffix, start);
  if (exactHit !== null) return { start: exactHit, end: exactHit + exact.length, strategy: "quote" };

  const normalized = normalizeWithMap(text);
  const needle = collapse(exact).trim();
  if (!needle) return null;
  const hint = normalized.map.findIndex((original) => original >= start);
  const normalizedHit = bestCandidate(
    normalized.text,
    findAll(normalized.text, needle),
    needle.length,
    collapse(prefix),
    collapse(suffix),
    hint === -1 ? normalized.text.length : hint,
  );
  if (normalizedHit === null) return null;

  const first = normalized.map[normalizedHit];
  const last = normalized.map[normalizedHit + needle.length - 1];
  if (first === undefined || last === undefined) return null;
  return { start: first, end: last + 1, strategy: "normalized" };
}
