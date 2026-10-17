import http from "node:http";
import https from "node:https";
import { chatCompletionsUrl, createAssistLookup, type AssistHostClass } from "@/lib/assist-endpoint";
import type { AssistKindName } from "@/lib/types";

export const ASSIST_TEXT_LIMIT = 24_000;
export const ASSIST_ANSWER_LIMIT = 12_000;
export const ASSIST_RESPONSE_LIMIT = 1_000_000;
const REQUEST_TIMEOUT_MS = 30_000;

export class AssistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssistError";
  }
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

const SYSTEM_PROMPT = [
  "You help a person understand a text they saved.",
  "Use only the text in the user message.",
  "If it does not contain the answer, say so in one sentence.",
  "Do not invent quotations, citations, page numbers, or facts.",
  "Write plain sentences.",
  'Do not open with a label such as "Summary:" or "Outline:".',
].join(" ");

function clip(text: string): { text: string; truncated: boolean } {
  const trimmed = text.trim();
  if (trimmed.length <= ASSIST_TEXT_LIMIT) return { text: trimmed, truncated: false };
  return {
    text: `${trimmed.slice(0, ASSIST_TEXT_LIMIT)}\n\n[The rest of the document was not included.]`,
    truncated: true,
  };
}

function passageWindow(text: string, quote: string): string {
  const needle = quote.trim().slice(0, 80);
  if (!needle) return "";
  const index = text.indexOf(needle);
  if (index < 0) return "";
  const start = Math.max(0, index - 1_500);
  const end = Math.min(text.length, index + quote.length + 1_500);
  const slice = text.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

/** The messages sent to the model. The document is shortened past ASSIST_TEXT_LIMIT, and the model is told so. */
export function buildAssistMessages(input: {
  kind: AssistKindName;
  title: string;
  text: string;
  question?: string;
  quote?: string;
  context?: string;
}): { messages: ChatMessage[]; truncated: boolean } {
  const title = input.title.trim() || "Untitled";
  if (input.kind === "EXPLAIN") {
    const quote = (input.quote ?? "").trim();
    const around = [input.context?.trim(), passageWindow(input.text, quote)].filter(Boolean).join("\n\n");
    const source = clip(around || quote);
    return {
      truncated: source.truncated,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Title: ${title}`,
            "",
            "Highlighted passage:",
            quote,
            "",
            "Surrounding text:",
            source.text,
            "",
            "Explain what this passage is saying. Unpack any term a reader might not know. Stay with this passage and the surrounding text.",
          ].join("\n"),
        },
      ],
    };
  }

  const body = clip(input.text);
  const instruction =
    input.kind === "SUMMARY"
      ? "Summarize this for later review, in a few short paragraphs."
      : input.kind === "OUTLINE"
        ? "List the main points in the order they appear. One short sentence per point."
        : `Question: ${(input.question ?? "").trim().slice(0, 500)}`;
  return {
    truncated: body.truncated,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: [`Title: ${title}`, "", body.text, "", instruction].join("\n") },
    ],
  };
}

export interface ChatContent {
  answer: string;
  model: string;
}

/** Pulls the assistant text out of an OpenAI-compatible chat response. */
export function readChatContent(payload: unknown, fallbackModel: string): ChatContent {
  if (!payload || typeof payload !== "object") {
    throw new AssistError("The model host returned something that wasn't a chat response.");
  }
  const record = payload as { choices?: unknown; model?: unknown };
  const choices = record.choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  const message =
    first && typeof first === "object" ? (first as { message?: { content?: unknown } }).message : undefined;
  const content = message?.content;
  let text = "";
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    text = content
      .map((part) =>
        part && typeof part === "object" && "text" in part && typeof part.text === "string" ? part.text : "",
      )
      .join("");
  }
  text = text.trim();
  if (!text) throw new AssistError("The model returned an empty answer.");
  const reported = typeof record.model === "string" ? record.model.trim() : "";
  const model = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/.test(reported) ? reported : fallbackModel;
  return { answer: text.slice(0, ASSIST_ANSWER_LIMIT), model };
}

export interface AssistRequest {
  url: URL;
  hostClass: AssistHostClass;
  body: string;
  headers: Record<string, string>;
}

export type AssistTransport = (request: AssistRequest, signal: AbortSignal) => Promise<{ status: number; text: string }>;

let transportOverride: AssistTransport | null = null;

/** Tests substitute the HTTP call. Production code never sets this. */
export function setAssistTransportForTests(transport: AssistTransport | null): void {
  transportOverride = transport;
}

function sanitizeDetail(body: string, apiKey: string): string {
  let detail = "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } | string };
    if (typeof parsed.error === "string") detail = parsed.error;
    else if (parsed.error && typeof parsed.error === "object" && typeof parsed.error.message === "string") {
      detail = parsed.error.message;
    }
  } catch {
    detail = "";
  }
  detail = detail.replace(/\s+/g, " ").trim().slice(0, 180);
  if (apiKey) detail = detail.split(apiKey).join("…");
  return detail;
}

function failureMessage(status: number, body: string, apiKey: string): string {
  const detail = sanitizeDetail(body, apiKey);
  if (status >= 300 && status < 400) {
    return "The model host redirected the request. Put its final address in Settings.";
  }
  if (status === 401 || status === 403) {
    if (detail) return `The model host refused the request. ${detail}`;
    return apiKey ? "The model host refused that API key." : "The model host refused the request.";
  }
  if (status === 404) {
    return "That host has no chat endpoint at this address. OpenAI-compatible servers usually end in /v1.";
  }
  if (status === 429) return "The model host is rate-limiting requests. Try again in a moment.";
  if (detail) return `The model host returned an error. ${detail}`;
  return "The model host returned an error.";
}

function defaultTransport(request: AssistRequest, signal: AbortSignal): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("The operation was aborted", "AbortError"));
      return;
    }
    const lib = request.url.protocol === "https:" ? https : http;
    const req = lib.request(
      request.url,
      {
        method: "POST",
        headers: {
          ...request.headers,
          "content-type": "application/json",
          accept: "application/json",
          "content-length": Buffer.byteLength(request.body),
        },
        lookup: createAssistLookup(request.hostClass),
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let received = 0;
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > ASSIST_RESPONSE_LIMIT) {
            res.destroy();
            reject(new AssistError("The model host sent a response that was too large."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );
    const onAbort = () => req.destroy(new DOMException("The operation was aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    req.on("close", () => signal.removeEventListener("abort", onAbort));
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
    req.on("error", reject);
    req.end(request.body);
  });
}

function toAssistError(error: unknown): AssistError {
  if (error instanceof AssistError) return error;
  if (error instanceof Error && error.name === "AbortError") return new AssistError("The model host didn't answer in time.");
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code === "ETIMEDOUT" || code === "ABORT_ERR") return new AssistError("The model host didn't answer in time.");
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return new AssistError("Libra couldn't resolve the model host.");
  if (code === "ECONNREFUSED") return new AssistError("Nothing is accepting connections at that address.");
  if (error instanceof Error && error.name === "BlockedDestinationError") return new AssistError(error.message);
  return new AssistError("Libra couldn't reach the model host.");
}

export async function completeChat(options: {
  endpoint: URL;
  hostClass: AssistHostClass;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  transport?: AssistTransport;
}): Promise<ChatContent> {
  const url = chatCompletionsUrl(options.endpoint);
  const body = JSON.stringify({
    model: options.model,
    temperature: 0.2,
    stream: false,
    max_tokens: 900,
    messages: options.messages,
  });
  const transport = options.transport ?? transportOverride ?? defaultTransport;
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: { status: number; text: string };
  try {
    response = await transport(
      {
        url,
        hostClass: options.hostClass,
        body,
        headers: options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {},
      },
      signal,
    );
  } catch (error) {
    throw toAssistError(error);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new AssistError(failureMessage(response.status, response.text, options.apiKey));
  }
  let payload: unknown;
  try {
    payload = JSON.parse(response.text) as unknown;
  } catch {
    throw new AssistError("The model host returned something that wasn't a chat response.");
  }
  return readChatContent(payload, options.model);
}
