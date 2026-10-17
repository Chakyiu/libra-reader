import { describe, expect, it } from "vitest";
import { anchorSelector, describeTextRange, surroundingSentence, trimRange } from "@/lib/anchoring/text-anchor";

const TEXT =
  "So the asymmetry is not ideological. It is clerical. A street that cannot be crossed on foot is not a street; it is a wall with traffic on it. The wall is invisible in the analysis because walls are not in the units.";

describe("describeTextRange", () => {
  it("captures the quote with surrounding context", () => {
    const start = TEXT.indexOf("A street");
    const end = start + "A street that cannot be crossed".length;
    const selector = describeTextRange(TEXT, start, end);
    expect(selector.exact).toBe("A street that cannot be crossed");
    expect(selector.prefix).toBe(TEXT.slice(start - 32, start));
    expect(selector.suffix).toBe(TEXT.slice(end, end + 32));
  });

  it("clamps out-of-range offsets", () => {
    const selector = describeTextRange("short", -5, 99);
    expect(selector).toMatchObject({ exact: "short", start: 0, end: 5, prefix: "", suffix: "" });
  });
});

describe("anchorSelector", () => {
  const start = TEXT.indexOf("a wall with traffic");
  const selector = describeTextRange(TEXT, start, start + "a wall with traffic".length);

  it("uses the stored position when the text is unchanged", () => {
    expect(anchorSelector(TEXT, selector)).toEqual({ start, end: selector.end, strategy: "position" });
  });

  it("re-finds the quote after text is inserted before it", () => {
    const edited = `A new opening sentence was added later. ${TEXT}`;
    const match = anchorSelector(edited, selector);
    expect(match?.strategy).toBe("quote");
    expect(edited.slice(match!.start, match!.end)).toBe("a wall with traffic");
  });

  it("uses prefix and suffix to choose between repeated quotes", () => {
    const repeated = "The wall stood. The wall fell. The wall stood again.";
    const second = repeated.indexOf("The wall fell");
    const sel = describeTextRange(repeated, second, second + "The wall".length);
    const shifted = `Intro. ${repeated}`;
    const match = anchorSelector(shifted, { ...sel, start: 0, end: 8 });
    expect(match?.start).toBe(shifted.indexOf("The wall fell"));
  });

  it("tolerates whitespace changes", () => {
    const sel = describeTextRange(TEXT, start, start + "a wall with traffic on it".length);
    const reflowed = TEXT.replace("a wall with traffic on it", "a wall\n   with  traffic\ton it");
    const match = anchorSelector(reflowed, sel);
    expect(match?.strategy).toBe("normalized");
    expect(reflowed.slice(match!.start, match!.end).replace(/\s+/g, " ")).toBe("a wall with traffic on it");
  });

  it("reports a missing passage instead of guessing", () => {
    expect(anchorSelector("Entirely different text now.", selector)).toBeNull();
    expect(anchorSelector(TEXT, { ...selector, exact: "" })).toBeNull();
  });
});

describe("helpers", () => {
  it("trims whitespace from a range", () => {
    expect(trimRange("  hello world  ", 0, 15)).toEqual({ start: 2, end: 13 });
  });

  it("returns the sentence around a range", () => {
    const at = TEXT.indexOf("crossed");
    expect(surroundingSentence(TEXT, at, at + 7)).toBe(
      "A street that cannot be crossed on foot is not a street; it is a wall with traffic on it.",
    );
  });
});
