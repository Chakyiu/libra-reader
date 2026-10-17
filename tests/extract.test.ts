import { describe, expect, it } from "vitest";
import { extractArticle, extractPageTitle } from "@/lib/extract";
import { estimateReadingMinutes, linkOnlyTitle, makeExcerpt, noteBodyToHtml, titleFromFileName } from "@/lib/reading";

const paragraph = (n: number) =>
  `<p>Paragraph ${n}. Streets keep records in their geometry, and you can read the decade of a corner from its radius the way you can read the decade of a building from its window proportions. The measurement participates in the outcome it claims to describe.</p>`;

const ARTICLE_PAGE = `<!doctype html><html><head>
<title>The Curb Remembers | Slow Transit</title>
<meta property="og:site_name" content="Slow Transit">
<meta name="author" content="Mireille Asante">
<script type="application/ld+json">{"@type":"NewsArticle","headline":"The Curb Remembers","author":{"@type":"Person","name":"Mireille Asante"}}</script>
<script>window.track = true;</script>
</head><body>
<nav><a href="/">Home</a><a href="/about">About</a></nav>
<article>
<h1>The Curb Remembers</h1>
<p class="byline">By Mireille Asante</p>
${Array.from({ length: 8 }, (_, i) => paragraph(i + 1)).join("\n")}
<h2 id="evil">Second part</h2>
<p onclick="steal()">Interactive text <a href="javascript:alert(1)">bad link</a> and a <a href="/relative">relative link</a>.</p>
<iframe src="https://ads.example/frame"></iframe>
<img src="/photo.jpg" alt="A corner">
</article>
<footer>Subscribe now</footer>
</body></html>`;

describe("extractArticle", () => {
  it("extracts readable, sanitized content and metadata", () => {
    const article = extractArticle(ARTICLE_PAGE, "https://slowtransit.example/curb");
    expect(article).not.toBeNull();
    expect(article!.title).toBe("The Curb Remembers");
    expect(article!.author).toBe("Mireille Asante");
    expect(article!.publication).toBe("Slow Transit");
    expect(article!.contentHtml).not.toMatch(/<script|onclick|javascript:|<iframe|<nav/i);
    expect(article!.contentHtml).toContain('href="https://slowtransit.example/relative"');
    expect(article!.contentHtml).toContain('src="https://slowtransit.example/photo.jpg"');
    expect(article!.contentHtml).not.toContain('id="evil"');
    expect(article!.contentText).toContain("Streets keep records");
    expect(article!.wordCount).toBeGreaterThan(200);
    expect(article!.readingMinutes).toBeGreaterThanOrEqual(1);
    expect(article!.excerpt.length).toBeLessThanOrEqual(230);
  });

  it("returns null when a page has no real article text", () => {
    expect(extractArticle("<html><body><nav>Menu</nav><p>Sign in</p></body></html>", "https://example.com/")).toBeNull();
  });

  it("reads the page title for link-only saves", () => {
    expect(extractPageTitle("<html><head><title> A Page </title></head><body></body></html>", "https://example.com/")).toBe("A Page");
  });
});

describe("reading helpers", () => {
  it("estimates reading time from words", () => {
    expect(estimateReadingMinutes("word ".repeat(460))).toBe(2);
    expect(estimateReadingMinutes("")).toBe(1);
  });

  it("makes excerpts that end on a boundary", () => {
    const excerpt = makeExcerpt("word ".repeat(100), 50);
    expect(excerpt.length).toBeLessThanOrEqual(51);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("escapes note text when building HTML", () => {
    expect(noteBodyToHtml('<script>x</script>\n\nSecond "para"\nline')).toBe(
      "<p>&lt;script&gt;x&lt;/script&gt;</p>\n<p>Second &quot;para&quot;<br>line</p>",
    );
  });

  it("titles link-only saves with the address, not an invented headline", () => {
    expect(linkOnlyTitle("https://www.example.com/2026/some-essay/")).toBe("example.com/2026/some-essay");
    expect(linkOnlyTitle("https://example.com/")).toBe("example.com");
  });

  it("derives titles from file names", () => {
    expect(titleFromFileName("a-field_guide.pdf")).toBe("A field guide");
    expect(titleFromFileName(".epub")).toBe("Untitled document");
  });
});
