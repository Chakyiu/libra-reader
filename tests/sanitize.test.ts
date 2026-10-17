import { describe, expect, it } from "vitest";
import { headingsFromHtml, htmlToPlainText, sanitizeArticleHtml } from "@/lib/sanitize";

describe("sanitizeArticleHtml", () => {
  it("removes scripts, styles and their contents", () => {
    const out = sanitizeArticleHtml('<p>Hi</p><script>alert(1)</script><style>p{}</style><noscript>x</noscript>');
    expect(out).toBe("<p>Hi</p>");
  });

  it("strips event handlers and inline styles", () => {
    const out = sanitizeArticleHtml('<p onclick="steal()" style="color:red" class="x">Text</p><img src="https://a.test/i.png" onerror="x()">');
    expect(out).not.toMatch(/onclick|onerror|style=|class=/);
    expect(out).toContain("<p>Text</p>");
  });

  it("neutralizes javascript: and data: URLs", () => {
    const out = sanitizeArticleHtml(
      '<a href="javascript:alert(1)">bad</a><a href="JaVaScRiPt:alert(1)">bad2</a><img src="data:image/svg+xml;base64,PHN2Zz4=">',
    );
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toContain("data:");
    expect(out).not.toContain("<img");
  });

  it("drops active and embedded content entirely", () => {
    const out = sanitizeArticleHtml(
      '<iframe src="https://evil.test"></iframe><object data="x"></object><embed src="y"><form action="/x"><input name="q"><button>Go</button></form><svg><script>x</script></svg><p>kept</p>',
    );
    expect(out).toBe("<p>kept</p>");
  });

  it("forces safe link attributes", () => {
    const out = sanitizeArticleHtml('<a href="https://example.com" target="_self" rel="opener">read</a>');
    expect(out).toBe('<a href="https://example.com" rel="noopener noreferrer nofollow ugc" target="_blank">read</a>');
  });

  it("loads images lazily without a referrer", () => {
    const out = sanitizeArticleHtml('<img src="https://example.com/a.jpg" alt="A" width="640" height="abc">');
    expect(out).toContain('src="https://example.com/a.jpg"');
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('referrerpolicy="no-referrer"');
    expect(out).toContain('width="640"');
    expect(out).not.toContain("height=");
  });

  it("replaces incoming ids with generated heading ids (no DOM clobbering)", () => {
    const out = sanitizeArticleHtml('<h2 id="location">One</h2><p id="cookie">x</p><h3 id="x">Two</h3>');
    expect(out).toBe('<h2 id="sec-1">One</h2>\n<p>x</p>\n<h3 id="sec-2">Two</h3>');
  });

  it("normalizes whitespace so only block boundaries carry newlines", () => {
    const out = sanitizeArticleHtml("<div>\n   <p>One\n     two  <em>three</em> <strong>four</strong></p>\n\n\n<p>Five</p>\n</div>");
    expect(out).toBe("<div><p>One two <em>three</em> <strong>four</strong></p>\n<p>Five</p></div>");
  });

  it("keeps preformatted whitespace intact", () => {
    expect(sanitizeArticleHtml("<pre><code>a\n    b</code></pre>")).toBe("<pre><code>a\n    b</code></pre>");
  });

  it("escapes text safely when re-serializing", () => {
    const out = sanitizeArticleHtml("<p>1 &lt; 2 &amp; “quotes” — fine</p>");
    expect(out).toBe("<p>1 &lt; 2 &amp; “quotes” — fine</p>");
  });

  it("keeps ordinary article structure", () => {
    const html = "<blockquote><p>Q</p></blockquote><ul><li>a</li></ul><pre><code>x &lt; y</code></pre><table><tr><td colspan=\"2\">t</td></tr></table>";
    const out = sanitizeArticleHtml(html);
    expect(out).toContain("<blockquote><p>Q</p></blockquote>");
    expect(out).toContain("<ul><li>a</li></ul>");
    expect(out).toContain("<pre><code>x &lt; y</code></pre>");
    expect(out).toContain('<td colspan="2">t</td>');
  });

  it("never emits <mark>, which the reader reserves for highlights", () => {
    expect(sanitizeArticleHtml("<p><mark>pre-highlighted</mark></p>")).toBe("<p>pre-highlighted</p>");
  });
});

describe("htmlToPlainText", () => {
  it("separates blocks with newlines and decodes entities", () => {
    expect(htmlToPlainText("<h2>Title</h2><p>One &amp; two</p><p>Three<br>four</p>")).toBe("Title\nOne & two\nThree\nfour");
  });

  it("ignores script and style text", () => {
    expect(htmlToPlainText("<p>a</p><script>var x=1</script><style>.a{}</style>")).toBe("a");
  });
});

describe("headingsFromHtml", () => {
  it("lists h1–h3 headings that carry ids", () => {
    expect(headingsFromHtml('<h2 id="sec-1">The <em>arithmetic</em></h2><h4 id="sec-2">Skip</h4><h3>No id</h3>')).toEqual([
      { id: "sec-1", text: "The arithmetic", level: 2 },
    ]);
  });
});
