import "server-only";
import { randomUUID } from "node:crypto";
import { extractArticle, extractPageTitle, type ExtractedArticle } from "@/lib/extract";
import { decodeHtml, safeFetch, SafeFetchError, type SafeFetchErrorCode } from "@/lib/safe-fetch";

export interface Extraction {
  requestedUrl: string;
  finalUrl: string;
  article: ExtractedArticle | null;
  pageTitle: string | null;
}

export type ExtractionFailure = { code: SafeFetchErrorCode | "UNREADABLE"; message: string; pageTitle: string | null };

export async function fetchAndExtract(url: string): Promise<{ ok: true; extraction: Extraction } | { ok: false; failure: ExtractionFailure }> {
  let page;
  try {
    page = await safeFetch(url);
  } catch (error) {
    const failure =
      error instanceof SafeFetchError
        ? { code: error.code, message: error.message, pageTitle: null }
        : { code: "NETWORK" as const, message: "Libra couldn't connect to that site.", pageTitle: null };
    return { ok: false, failure };
  }

  const html = decodeHtml(page.body, page.contentType);
  let article: ExtractedArticle | null = null;
  try {
    article = extractArticle(html, page.url);
  } catch {
    article = null;
  }
  if (!article) {
    let pageTitle: string | null = null;
    try {
      pageTitle = extractPageTitle(html, page.url);
    } catch {
      pageTitle = null;
    }
    return {
      ok: false,
      failure: {
        code: "UNREADABLE",
        message: "The page loaded, but Libra couldn't find readable article text in it.",
        pageTitle,
      },
    };
  }
  return { ok: true, extraction: { requestedUrl: url, finalUrl: page.url, article, pageTitle: article.title } };
}

/* Short-lived cache so "Save" stores exactly what the preview showed. */

const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 24;
const globalCache = globalThis as unknown as { libraExtractions?: Map<string, { value: Extraction; expires: number }> };
const cache = (globalCache.libraExtractions ??= new Map());

export function rememberExtraction(value: Extraction): string {
  const now = Date.now();
  for (const [key, entry] of cache) if (entry.expires < now) cache.delete(key);
  while (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  const token = randomUUID();
  cache.set(token, { value, expires: now + TTL_MS });
  return token;
}

export function takeExtraction(token: string | undefined, url: string): Extraction | null {
  if (!token) return null;
  const entry = cache.get(token);
  if (!entry || entry.expires < Date.now() || entry.value.requestedUrl !== url) return null;
  cache.delete(token);
  return entry.value;
}
