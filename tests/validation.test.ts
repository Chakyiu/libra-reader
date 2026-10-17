import { describe, expect, it } from "vitest";
import {
  collectionInputSchema,
  highlightCreateSchema,
  librarySearchParamsSchema,
  noteInputSchema,
  normalizeTagName,
  parseReadingLocation,
  parseTagInput,
  positionUpdateSchema,
  preferenceUpdateSchema,
  urlInputSchema,
} from "@/lib/validation";

describe("urlInputSchema", () => {
  it("adds https to bare hosts and drops fragments", () => {
    expect(urlInputSchema.parse("example.com/essay#part-2")).toBe("https://example.com/essay");
    expect(urlInputSchema.parse("  http://example.org/a?b=1  ")).toBe("http://example.org/a?b=1");
  });

  it.each([
    ["", "Paste an address first."],
    ["javascript:alert(1)", "Only http:// and https:// addresses can be saved."],
    ["file:///etc/passwd", "Only http:// and https:// addresses can be saved."],
    ["ftp://example.com/file", "Only http:// and https:// addresses can be saved."],
    ["https://user:secret@example.com", "Addresses with a username or password can't be saved."],
    ["not a url at all", "That doesn't look like a web address."],
  ])("rejects %j", (input, message) => {
    const result = urlInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it("rejects overly long input", () => {
    expect(urlInputSchema.safeParse(`https://example.com/${"a".repeat(2100)}`).success).toBe(false);
  });
});

describe("tags", () => {
  it("normalizes names", () => {
    expect(normalizeTagName("  #Urban Design ")).toBe("urban-design");
    expect(normalizeTagName("C++ & Rust!")).toBe("c-rust");
    expect(normalizeTagName("Ünïcode Wörds")).toBe("ünïcode-wörds");
    expect(normalizeTagName("###")).toBe("");
  });

  it("parses comma separated input and de-duplicates", () => {
    expect(parseTagInput("urbanism, Transit,  urbanism\n#systems")).toEqual(["urbanism", "transit", "systems"]);
    expect(parseTagInput(" , ,")).toEqual([]);
  });
});

describe("noteInputSchema", () => {
  it("allows an empty title and trims it", () => {
    expect(noteInputSchema.parse({ title: "  ", body: "Hello" })).toEqual({ title: "", body: "Hello" });
  });

  it("caps body length", () => {
    expect(noteInputSchema.safeParse({ title: "x", body: "a".repeat(200_001) }).success).toBe(false);
  });
});

describe("collectionInputSchema", () => {
  it("requires a name and applies defaults", () => {
    expect(collectionInputSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(collectionInputSchema.parse({ name: " Field Notes " })).toEqual({
      name: "Field Notes",
      description: "",
      color: "YELLOW",
      isFavorite: false,
    });
  });

  it("rejects unknown colours", () => {
    expect(collectionInputSchema.safeParse({ name: "A", color: "PURPLE" }).success).toBe(false);
  });
});

describe("highlightCreateSchema", () => {
  const base = { documentId: "doc1", quote: "A street", startOffset: 10, endOffset: 18 };

  it("accepts a valid highlight with defaults", () => {
    expect(highlightCreateSchema.parse(base)).toMatchObject({ color: "YELLOW", prefix: "", suffix: "", context: "" });
  });

  it("rejects empty or inverted ranges", () => {
    expect(highlightCreateSchema.safeParse({ ...base, endOffset: 10 }).success).toBe(false);
    expect(highlightCreateSchema.safeParse({ ...base, quote: "" }).success).toBe(false);
    expect(highlightCreateSchema.safeParse({ ...base, startOffset: -1 }).success).toBe(false);
  });

  it("rejects ids that could smuggle syntax", () => {
    expect(highlightCreateSchema.safeParse({ ...base, documentId: "../etc" }).success).toBe(false);
  });
});

describe("preferences and positions", () => {
  it("bounds reading preferences", () => {
    expect(preferenceUpdateSchema.safeParse({ fontSize: 40 }).success).toBe(false);
    expect(preferenceUpdateSchema.safeParse({ lineHeight: 1.7, theme: "DARK" }).success).toBe(true);
    expect(preferenceUpdateSchema.safeParse({ theme: "NEON" }).success).toBe(false);
  });

  it("validates reading locations by kind", () => {
    expect(positionUpdateSchema.safeParse({ progress: 0.4, location: { kind: "pdf", page: 3, zoom: 0 } }).success).toBe(true);
    expect(positionUpdateSchema.safeParse({ progress: 1.4 }).success).toBe(false);
    expect(positionUpdateSchema.safeParse({ progress: 0.1, location: { kind: "scroll", y: 10 } }).success).toBe(false);
  });

  it("parses stored locations defensively", () => {
    expect(parseReadingLocation('{"kind":"text","offset":120,"ratio":0.3}')).toEqual({ kind: "text", offset: 120, ratio: 0.3 });
    expect(parseReadingLocation("not json")).toBeNull();
    expect(parseReadingLocation('{"kind":"epub"}')).toBeNull();
    expect(parseReadingLocation(null)).toBeNull();
  });
});

describe("librarySearchParamsSchema", () => {
  it("falls back to defaults for junk instead of throwing", () => {
    expect(librarySearchParamsSchema.parse({ status: "deleted", type: "video", sort: "random", view: "table", q: "x" })).toEqual({
      status: "all",
      type: "all",
      sort: "saved",
      view: "list",
      q: "x",
      tag: undefined,
      collection: undefined,
    });
  });

  it("keeps valid filters", () => {
    expect(librarySearchParamsSchema.parse({ status: "archived", type: "pdf", tag: "urbanism", collection: "abc123" })).toMatchObject({
      status: "archived",
      type: "pdf",
      tag: "urbanism",
      collection: "abc123",
    });
  });
});
