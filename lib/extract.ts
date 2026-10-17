import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import { collapseWhitespace, countWords, estimateReadingMinutes, excerptFromLines, makeExcerpt, prettyHost } from "@/lib/reading";
import { htmlToPlainText, sanitizeArticleHtml } from "@/lib/sanitize";

export interface ExtractedArticle {
  title: string;
  author: string | null;
  publication: string | null;
  excerpt: string;
  contentHtml: string;
  contentText: string;
  wordCount: number;
  readingMinutes: number;
}

interface PageMetadata {
  ogTitle: string | null;
  /** JSON-LD headline; some sites (Wikipedia) put a short description here instead of the title. */
  jsonLdHeadline: string | null;
  /** The <title> element, which often carries a " | Site" suffix. */
  documentTitle: string | null;
  author: string | null;
  /** og:site_name or application-name: the brand readers recognise. */
  siteName: string | null;
  /** JSON-LD publisher, often the legal entity rather than the publication. */
  publisher: string | null;
  description: string | null;
}

/** "The Curb Remembers | Slow Transit" → "The Curb Remembers" when the suffix is the site's name. */
function stripSiteSuffix(title: string, siteName: string | null): string {
  if (!siteName) return title;
  const escaped = siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = title.replace(new RegExp(`\\s+[|·•–—-]\\s+${escaped}\\s*$`, "i"), "").trim();
  return stripped || title;
}

const MIN_READABLE_CHARS = 140;

function clean(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const text = collapseWhitespace(value);
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function cleanByline(value: string | null | undefined): string | null {
  const text = clean(value?.split("\n")[0], 160);
  if (!text) return null;
  const stripped = text.replace(/^by[:\s]+/i, "").trim();
  if (!stripped || /^https?:\/\//i.test(stripped)) return null;
  return stripped.length > 120 ? `${stripped.slice(0, 119).trimEnd()}…` : stripped;
}

function metaContent(doc: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const value = doc.querySelector(selector)?.getAttribute("content");
    if (value?.trim()) return value;
  }
  return null;
}

function nameOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const names = value.map(nameOf).filter((name): name is string => Boolean(name));
    return names.length ? names.join(", ") : null;
  }
  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === "string" ? name : null;
  }
  return null;
}

interface JsonLdArticle {
  headline: string | null;
  author: string | null;
  siteName: string | null;
}

/** Article metadata from JSON-LD, which many publishers fill in more carefully than <meta>. */
function readJsonLd(doc: Document): Partial<JsonLdArticle> {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).slice(0, 8);
  for (const script of scripts) {
    const raw = script.textContent ?? "";
    if (raw.length > 200_000) continue;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    const nodes: unknown[] = Array.isArray(data)
      ? data
      : data && typeof data === "object" && "@graph" in data && Array.isArray((data as { "@graph": unknown })["@graph"])
        ? ((data as { "@graph": unknown[] })["@graph"])
        : [data];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const record = node as Record<string, unknown>;
      const type = record["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (!types.some((t) => typeof t === "string" && /Article|BlogPosting|Report|Posting/i.test(t))) continue;
      return {
        headline: typeof record.headline === "string" ? record.headline : null,
        author: nameOf(record.author),
        siteName: nameOf(record.publisher),
      };
    }
  }
  return {};
}

function readMetadata(doc: Document): PageMetadata {
  const jsonLd = readJsonLd(doc);
  const metaAuthor = metaContent(doc, ['meta[name="author"]', 'meta[property="article:author"]', 'meta[name="byl"]']);
  return {
    ogTitle: metaContent(doc, ['meta[property="og:title"]', 'meta[name="twitter:title"]']),
    jsonLdHeadline: jsonLd.headline ?? null,
    documentTitle: doc.querySelector("title")?.textContent ?? null,
    author: jsonLd.author ?? (metaAuthor && !/^https?:\/\//i.test(metaAuthor) ? metaAuthor : null),
    siteName: metaContent(doc, ['meta[property="og:site_name"]', 'meta[name="application-name"]']),
    publisher: jsonLd.siteName ?? null,
    description: metaContent(doc, ['meta[name="description"]', 'meta[property="og:description"]']),
  };
}

function createDom(html: string, pageUrl: string): JSDOM {
  // No runScripts and no resources: page scripts never execute and nothing is fetched.
  return new JSDOM(html, { url: pageUrl, virtualConsole: new VirtualConsole() });
}

/** The page's own title, used when only the link is kept. */
export function extractPageTitle(html: string, pageUrl: string): string | null {
  const dom = createDom(html, pageUrl);
  try {
    const meta = readMetadata(dom.window.document);
    const title = clean(meta.ogTitle, 300) ?? clean(meta.documentTitle, 300) ?? clean(meta.jsonLdHeadline, 300);
    return title ? stripSiteSuffix(title, clean(meta.siteName, 120)) : null;
  } finally {
    dom.window.close();
  }
}

/**
 * Pulls the readable article out of a page. Returns null when there isn't
 * enough real text to call it an article; callers then offer "Save link only"
 * rather than showing anything invented.
 */
export function extractArticle(html: string, pageUrl: string): ExtractedArticle | null {
  const dom = createDom(html, pageUrl);
  try {
    const doc = dom.window.document;
    const meta = readMetadata(doc);
    const parsed = new Readability(doc, { charThreshold: 400 }).parse();
    if (!parsed?.content) return null;

    const contentHtml = sanitizeArticleHtml(parsed.content);
    const contentText = htmlToPlainText(contentHtml);
    if (contentText.length < MIN_READABLE_CHARS) return null;

    const host = prettyHost(pageUrl);
    const publication =
      clean(meta.siteName, 120) ?? clean(parsed.siteName, 120) ?? clean(meta.publisher, 120) ?? (host || null);
    // Readability's title is usually right but can keep a " | Site" suffix; strip
    // whichever brand the page declared before falling back to other sources.
    const brands = [publication, clean(meta.siteName, 120), clean(parsed.siteName, 120)];
    const strip = (title: string) => brands.reduce<string>((current, brand) => stripSiteSuffix(current, brand), title);
    const rawTitle =
      clean(parsed.title, 300) ?? clean(meta.ogTitle, 300) ?? clean(meta.documentTitle, 300) ?? clean(meta.jsonLdHeadline, 300) ?? host;
    return {
      title: strip(rawTitle),
      author: cleanByline(parsed.byline) ?? cleanByline(meta.author),
      publication,
      excerpt: makeExcerpt(clean(parsed.excerpt, 600) ?? clean(meta.description, 600) ?? excerptFromLines(contentText, 600)),
      contentHtml,
      contentText,
      wordCount: countWords(contentText),
      readingMinutes: estimateReadingMinutes(contentText),
    };
  } finally {
    dom.window.close();
  }
}
