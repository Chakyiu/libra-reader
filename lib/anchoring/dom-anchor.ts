/**
 * DOM side of highlight anchoring: converting between Ranges and character
 * offsets into `root.textContent`, and painting <mark> elements across
 * however many text nodes a highlight spans.
 */

export const HIGHLIGHT_ATTR = "data-hl-id";

/** Whitespace in these containers is formatting, not content; never wrap it. */
const NON_INLINE_PARENTS = new Set([
  "ARTICLE",
  "SECTION",
  "DIV",
  "UL",
  "OL",
  "DL",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "COLGROUP",
  "BLOCKQUOTE",
  "FIGURE",
  "DETAILS",
  "BODY",
]);

function textNodesUnder(root: Node): Text[] {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
  return nodes;
}

/** Character offset of a boundary point, counted the same way as textContent. */
export function textOffsetOf(root: Node, container: Node, offset: number): number {
  const doc = root.ownerDocument ?? (root as Document);
  const range = doc.createRange();
  range.setStart(root, 0);
  range.setEnd(container, offset);
  return range.toString().length;
}

/**
 * Offsets of a selection range relative to root, clamped to root and trimmed
 * of surrounding whitespace. Null when nothing selectable remains.
 */
export function rangeToOffsets(root: Element, range: Range): { start: number; end: number } | null {
  const doc = root.ownerDocument;
  const bounds = doc.createRange();
  bounds.selectNodeContents(root);

  if (range.compareBoundaryPoints(Range.END_TO_START, bounds) >= 0) return null;
  if (range.compareBoundaryPoints(Range.START_TO_END, bounds) <= 0) return null;

  const clamped = range.cloneRange();
  if (clamped.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) {
    clamped.setStart(bounds.startContainer, bounds.startOffset);
  }
  if (clamped.compareBoundaryPoints(Range.END_TO_END, bounds) > 0) {
    clamped.setEnd(bounds.endContainer, bounds.endOffset);
  }

  const text = root.textContent ?? "";
  let start = textOffsetOf(root, clamped.startContainer, clamped.startOffset);
  let end = textOffsetOf(root, clamped.endContainer, clamped.endOffset);
  while (start < end && /\s/.test(text.charAt(start))) start += 1;
  while (end > start && /\s/.test(text.charAt(end - 1))) end -= 1;
  return end > start ? { start, end } : null;
}

/** A Range covering [start, end) of root.textContent, or null if out of bounds. */
export function offsetsToRange(root: Element, start: number, end: number): Range | null {
  if (end <= start) return null;
  const range = root.ownerDocument.createRange();
  let seen = 0;
  let started = false;
  for (const node of textNodesUnder(root)) {
    const length = node.data.length;
    if (!started && start < seen + length) {
      range.setStart(node, start - seen);
      started = true;
    }
    if (started && end <= seen + length) {
      range.setEnd(node, end - seen);
      return range;
    }
    seen += length;
  }
  return null;
}

export interface MarkOptions {
  id: string;
  color: string;
  hasNote: boolean;
  label: string;
}

/**
 * Wraps [start, end) in <mark> elements, one per text node so the result is
 * always valid markup even when the passage crosses paragraphs, links, or
 * emphasis. Returns the marks in document order.
 */
export function wrapOffsets(root: Element, start: number, end: number, options: MarkOptions): HTMLElement[] {
  const doc = root.ownerDocument;
  const pieces: Array<{ node: Text; from: number; to: number }> = [];
  let seen = 0;
  for (const node of textNodesUnder(root)) {
    const length = node.data.length;
    const nodeStart = seen;
    const nodeEnd = seen + length;
    seen = nodeEnd;
    if (nodeEnd <= start || nodeStart >= end || length === 0) continue;
    const from = Math.max(0, start - nodeStart);
    const to = Math.min(length, end - nodeStart);
    if (to <= from) continue;
    const slice = node.data.slice(from, to);
    if (!slice.trim() && node.parentElement && NON_INLINE_PARENTS.has(node.parentElement.tagName)) continue;
    pieces.push({ node, from, to });
  }

  const marks: HTMLElement[] = [];
  for (const { node, from, to } of pieces) {
    let target = node;
    if (to < target.data.length) target.splitText(to);
    if (from > 0) target = target.splitText(from);
    const mark = doc.createElement("mark");
    mark.className = "hl";
    mark.setAttribute(HIGHLIGHT_ATTR, options.id);
    mark.setAttribute("data-color", options.color);
    if (options.hasNote) mark.setAttribute("data-note", "true");
    target.parentNode?.insertBefore(mark, target);
    mark.appendChild(target);
    marks.push(mark);
  }

  const first = marks[0];
  if (first) {
    first.tabIndex = 0;
    first.setAttribute("role", "button");
    first.setAttribute("aria-label", options.label);
  }
  return marks;
}

/** Removes highlight marks (all, or one highlight's) and re-merges split text nodes. */
export function unwrapHighlights(root: Element, id?: string): void {
  const selector = id ? `mark.hl[${HIGHLIGHT_ATTR}="${CSS.escape(id)}"]` : "mark.hl";
  const marks = Array.from(root.querySelectorAll(selector));
  if (marks.length === 0) return;
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  }
  root.normalize();
}
