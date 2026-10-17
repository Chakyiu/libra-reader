// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { offsetsToRange, rangeToOffsets, textOffsetOf, unwrapHighlights, wrapOffsets } from "@/lib/anchoring/dom-anchor";
import { anchorSelector, describeTextRange } from "@/lib/anchoring/text-anchor";

const HTML = `<p>The first paragraph has <em>emphasis</em> and a <a href="#">link</a>.</p>
<h2 id="sec-1">A heading</h2>
<p>The second paragraph ends here.</p>`;

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = `<article><header>Title outside the body</header><div class="article-body">${HTML}</div></article>`;
  root = document.querySelector(".article-body") as HTMLElement;
});

const mark = { color: "YELLOW", hasNote: false, label: "Highlight" };

describe("offsets", () => {
  it("counts boundary points the same way as textContent", () => {
    const em = root.querySelector("em")!;
    const offset = textOffsetOf(root, em.firstChild!, 3);
    expect((root.textContent ?? "").slice(0, offset).endsWith("emp")).toBe(true);
  });

  it("round-trips offsets through a Range", () => {
    const text = root.textContent ?? "";
    const start = text.indexOf("emphasis and");
    const range = offsetsToRange(root, start, start + "emphasis and".length)!;
    expect(range.toString()).toBe("emphasis and");
    expect(rangeToOffsets(root, range)).toEqual({ start, end: start + "emphasis and".length });
  });

  it("clamps selections that start outside the article body and trims whitespace", () => {
    const range = document.createRange();
    range.setStart(document.querySelector("header")!.firstChild!, 6);
    range.setEnd(root.querySelector("p")!.firstChild!, 9);
    const offsets = rangeToOffsets(root, range);
    expect(offsets).toEqual({ start: 0, end: 9 });
    expect((root.textContent ?? "").slice(offsets!.start, offsets!.end)).toBe("The first");
  });

  it("ignores selections entirely outside the body", () => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector("header")!);
    expect(rangeToOffsets(root, range)).toBeNull();
  });
});

describe("wrapOffsets", () => {
  it("wraps a passage that crosses elements and blocks in valid per-node marks", () => {
    const text = root.textContent ?? "";
    const start = text.indexOf("emphasis");
    const end = text.indexOf("second") + "second".length;
    const marks = wrapOffsets(root, start, end, { id: "h1", ...mark });

    expect(marks.length).toBeGreaterThan(3);
    expect(marks.map((m) => m.textContent).join("")).toBe(text.slice(start, end).replace(/\n/g, ""));
    for (const m of marks) expect(m.querySelector("p, h2, mark")).toBeNull();
    expect(root.querySelector("h2 mark")?.textContent).toBe("A heading");
    // The text itself never changes, so stored offsets stay valid.
    expect(root.textContent).toBe(text);
    expect(marks[0]?.getAttribute("role")).toBe("button");
    expect(marks[0]?.tabIndex).toBe(0);
  });

  it("restores the original DOM when unwrapped", () => {
    const before = root.innerHTML;
    const text = root.textContent ?? "";
    wrapOffsets(root, text.indexOf("first"), text.indexOf("link") + 4, { id: "h1", ...mark });
    wrapOffsets(root, text.indexOf("second"), text.indexOf("ends"), { id: "h2", ...mark, color: "SAGE" });
    expect(root.querySelectorAll("mark.hl").length).toBeGreaterThan(2);

    unwrapHighlights(root, "h2");
    expect(root.querySelector('mark[data-hl-id="h2"]')).toBeNull();
    expect(root.querySelector('mark[data-hl-id="h1"]')).not.toBeNull();

    unwrapHighlights(root);
    expect(root.innerHTML).toBe(before);
  });

  it("supports overlapping highlights", () => {
    const text = root.textContent ?? "";
    wrapOffsets(root, text.indexOf("first"), text.indexOf("has"), { id: "a", ...mark });
    wrapOffsets(root, text.indexOf("paragraph"), text.indexOf("emphasis"), { id: "b", ...mark });
    expect(root.textContent).toBe(text);
    unwrapHighlights(root);
    expect(root.querySelectorAll("mark").length).toBe(0);
  });

  it("re-anchors a stored selector after reload, with fresh DOM", () => {
    const text = root.textContent ?? "";
    const start = text.indexOf("A heading");
    const selector = describeTextRange(text, start, start + "A heading".length);

    document.body.innerHTML = `<div class="article-body">${HTML}</div>`;
    const fresh = document.querySelector(".article-body") as HTMLElement;
    const match = anchorSelector(fresh.textContent ?? "", selector)!;
    const marks = wrapOffsets(fresh, match.start, match.end, { id: "h", ...mark });
    expect(marks.map((m) => m.textContent).join("")).toBe("A heading");
  });
});
