import http from "node:http";
import https from "node:https";
import { pipeline, type Readable } from "node:stream";
import zlib from "node:zlib";
import { assertUrlAllowed, BlockedDestinationError, createGuardedLookup } from "@/lib/ssrf";

export type SafeFetchErrorCode =
  | "BLOCKED"
  | "TIMEOUT"
  | "TOO_LARGE"
  | "TOO_MANY_REDIRECTS"
  | "HTTP_STATUS"
  | "UNSUPPORTED_TYPE"
  | "NOT_FOUND"
  | "NETWORK";

export class SafeFetchError extends Error {
  constructor(
    readonly code: SafeFetchErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export interface TransportResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Readable;
}

/** One HTTP exchange with no redirect handling; swappable in tests. */
export type Transport = (url: URL, signal: AbortSignal) => Promise<TransportResponse>;

export interface SafeFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  transport?: Transport;
}

export interface SafeFetchResult {
  url: string;
  status: number;
  contentType: string;
  body: Buffer;
}

export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HTML_TYPES = /^(text\/html|application\/xhtml\+xml)\b/i;

const guardedLookup = createGuardedLookup();

export const nodeTransport: Transport = (url, signal) =>
  new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method: "GET",
        agent: false,
        lookup: guardedLookup,
        signal,
        timeout: 10_000,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 LibraReader/0.1",
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "en;q=0.9,*;q=0.5",
        },
      },
      (response) => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: response }),
    );
    request.on("timeout", () => request.destroy(new SafeFetchError("TIMEOUT", "The site took too long to answer.")));
    request.on("error", reject);
    request.end();
  });

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function decompress(body: Readable, encoding: string | undefined): Readable {
  const kind = (encoding ?? "").trim().toLowerCase();
  const decoder =
    kind === "gzip" || kind === "x-gzip"
      ? zlib.createGunzip()
      : kind === "deflate"
        ? zlib.createInflate()
        : kind === "br"
          ? zlib.createBrotliDecompress()
          : null;
  if (!decoder) {
    if (kind === "" || kind === "identity") return body;
    body.destroy();
    throw new SafeFetchError("UNSUPPORTED_TYPE", "The site sent the page in an encoding Libra can't read.");
  }
  pipeline(body, decoder, () => undefined);
  return decoder;
}

/** Reads decompressed bytes and stops as soon as the limit is crossed (zip-bomb safe). */
async function readLimited(stream: Readable, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    total += buffer.length;
    if (total > maxBytes) {
      stream.destroy();
      throw new SafeFetchError("TOO_LARGE", tooLargeMessage(maxBytes));
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function tooLargeMessage(maxBytes: number): string {
  return `That page is larger than ${Math.round(maxBytes / (1024 * 1024))} MB, so Libra stopped reading it.`;
}

function describeStatus(status: number): string {
  if (status === 401 || status === 403) return `The site refused the request (${status}). It may need a login or block automated readers.`;
  if (status === 404 || status === 410) return `The site says that page doesn't exist (${status}).`;
  if (status === 429) return "The site is rate-limiting requests right now (429).";
  if (status >= 500) return `The site had a problem answering (${status}).`;
  return `The site answered with an unexpected status (${status}).`;
}

function describeType(contentType: string): string {
  const type = contentType.split(";")[0]?.trim() || "an unknown type";
  if (/pdf/i.test(type)) return "That address is a PDF file, not a web page. Download it and use Upload a file instead.";
  if (/epub/i.test(type)) return "That address is an EPUB file, not a web page. Download it and use Upload a file instead.";
  return `That address returned ${type}, not a web page.`;
}

function normalizeError(error: unknown, timedOut: boolean): SafeFetchError {
  if (error instanceof SafeFetchError) return error;
  if (error instanceof BlockedDestinationError) return new SafeFetchError("BLOCKED", error.message);
  if (timedOut) return new SafeFetchError("TIMEOUT", "The site took too long to answer.");
  const code = (error as NodeJS.ErrnoException | undefined)?.code ?? "";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "EAI_NONAME") {
    return new SafeFetchError("NOT_FOUND", "Libra couldn't find that site. Check the address for typos.");
  }
  if (code === "ABORT_ERR") return new SafeFetchError("TIMEOUT", "The site took too long to answer.");
  if (/CERT|SSL|TLS/i.test(code)) {
    return new SafeFetchError("NETWORK", "The site's security certificate couldn't be verified.");
  }
  return new SafeFetchError("NETWORK", "Libra couldn't connect to that site.");
}

/**
 * GET a public web page with SSRF protection: http(s) only, standard ports,
 * every hop (including redirects) re-validated, DNS answers checked at
 * connect time, a total timeout, and a hard cap on decompressed bytes.
 */
export async function safeFetch(input: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const {
    maxBytes = DEFAULT_MAX_BYTES,
    timeoutMs = 15_000,
    maxRedirects = 5,
    transport = nodeTransport,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let current = assertUrlAllowed(input);
    for (let redirects = 0; ; redirects += 1) {
      const response = await transport(current, controller.signal);

      if (REDIRECT_STATUSES.has(response.status)) {
        response.body.destroy();
        const location = headerValue(response.headers.location);
        if (!location) {
          throw new SafeFetchError("HTTP_STATUS", "The site redirected without saying where to.", response.status);
        }
        if (redirects >= maxRedirects) {
          throw new SafeFetchError("TOO_MANY_REDIRECTS", "The site redirected too many times.");
        }
        current = assertUrlAllowed(new URL(location, current));
        continue;
      }

      if (response.status < 200 || response.status >= 300) {
        response.body.destroy();
        throw new SafeFetchError("HTTP_STATUS", describeStatus(response.status), response.status);
      }

      const contentType = headerValue(response.headers["content-type"])?.trim() ?? "";
      if (contentType && !HTML_TYPES.test(contentType)) {
        response.body.destroy();
        throw new SafeFetchError("UNSUPPORTED_TYPE", describeType(contentType));
      }

      const declared = Number(headerValue(response.headers["content-length"]));
      if (Number.isFinite(declared) && declared > maxBytes) {
        response.body.destroy();
        throw new SafeFetchError("TOO_LARGE", tooLargeMessage(maxBytes));
      }

      const body = await readLimited(
        decompress(response.body, headerValue(response.headers["content-encoding"])),
        maxBytes,
      );
      return { url: current.toString(), status: response.status, contentType, body };
    }
  } catch (error) {
    throw normalizeError(error, controller.signal.aborted);
  } finally {
    clearTimeout(timer);
  }
}

/** Decodes bytes using the header charset, then a <meta charset>, then UTF-8. */
export function decodeHtml(body: Buffer, contentType: string): string {
  if (body[0] === 0xef && body[1] === 0xbb && body[2] === 0xbf) return body.subarray(3).toString("utf8");
  const head = body.subarray(0, 4096).toString("latin1");
  const labels = [
    /charset\s*=\s*["']?([\w.:-]+)/i.exec(contentType)?.[1],
    /<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i.exec(head)?.[1],
  ];
  for (const label of labels) {
    if (!label) continue;
    try {
      return new TextDecoder(label).decode(body);
    } catch {
      // Unknown label; fall through to the next candidate.
    }
  }
  return body.toString("utf8");
}
