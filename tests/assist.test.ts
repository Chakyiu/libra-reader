import type { LookupAddress } from "node:dns";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ASSIST_TEXT_LIMIT, AssistError, buildAssistMessages, completeChat, readChatContent, setAssistTransportForTests } from "@/lib/assist";
import {
  assistAddressClass,
  chatCompletionsUrl,
  inspectAssistUrl,
  normalizeAssistBaseUrl,
  prepareAssistEndpoint,
} from "@/lib/assist-endpoint";
import { assertUrlAllowed, BlockedDestinationError } from "@/lib/ssrf";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { db } = await import("@/lib/db");
const { clearAssistConfig, runAssist, saveAssistConfig } = await import("@/lib/actions/assist");
const { getAssistStatus } = await import("@/lib/queries");
const { GET: exportLibrary } = await import("@/app/api/export/route");

const KEY = "sk-test-secret-value";

function records(...addresses: string[]): LookupAddress[] {
  return addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
}

describe("assist address policy", () => {
  it("keeps article fetching closed to local models", () => {
    expect(() => assertUrlAllowed("http://127.0.0.1:11434/v1")).toThrow(BlockedDestinationError);
  });

  it.each(["127.0.0.1", "10.1.2.3", "192.168.1.20", "172.16.0.4", "::1", "fd12:3456::1", "::ffff:127.0.0.1"])(
    "treats %s as a local model host",
    (ip) => {
      expect(assistAddressClass(ip)).toBe("local");
    },
  );

  it.each(["169.254.169.254", "fe80::1", "100.64.0.1", "0.0.0.0", "224.0.0.1"])("blocks %s", (ip) => {
    expect(assistAddressClass(ip)).toBe("blocked");
    expect(() => inspectAssistUrl(`http://${ip.includes(":") ? `[${ip}]` : ip}/`)).toThrow(BlockedDestinationError);
  });

  it("allows a local model on any port and a public host only on web ports", () => {
    expect(inspectAssistUrl("http://127.0.0.1:11434/v1").hostClass).toBe("local");
    expect(inspectAssistUrl("http://localhost:1234/v1").hostClass).toBe("local");
    expect(inspectAssistUrl("https://1.1.1.1/v1").hostClass).toBe("public");
    expect(() => inspectAssistUrl("https://1.1.1.1:11434/v1")).toThrow(/standard web ports/);
    expect(() => inspectAssistUrl("http://user:pass@127.0.0.1:11434/v1")).toThrow(/API key/);
    expect(() => inspectAssistUrl("file:///tmp/model")).toThrow(/http/);
  });

  it("classifies a hostname from its DNS answers", async () => {
    const local = await prepareAssistEndpoint("http://ollama.local:11434/v1", async () => records("192.168.1.9"));
    expect(local.hostClass).toBe("local");
    const pub = await prepareAssistEndpoint("https://api.openai.com/v1", async () => records("1.1.1.1"));
    expect(pub.hostClass).toBe("public");
    await expect(prepareAssistEndpoint("https://api.openai.com:11434/v1", async () => records("1.1.1.1"))).rejects.toThrow(
      /standard web ports/,
    );
    await expect(prepareAssistEndpoint("https://mixed.example/v1", async () => records("1.1.1.1", "10.0.0.1"))).rejects.toThrow(
      /both public and private/,
    );
    await expect(prepareAssistEndpoint("http://metadata.example/v1", async () => records("169.254.169.254"))).rejects.toThrow(
      /won't contact/,
    );
  });
});

describe("assist prompts and chat responses", () => {
  it("shortens a long document and tells the model the rest was left out", () => {
    const built = buildAssistMessages({ kind: "SUMMARY", title: "Streets", text: "word ".repeat(ASSIST_TEXT_LIMIT) });
    expect(built.truncated).toBe(true);
    expect(built.messages[1]?.content).toContain("[The rest of the document was not included.]");
    expect(built.messages[0]?.content).toContain("Do not invent");
  });

  it("puts the question in the user message and keeps an explanation on the passage", () => {
    const asked = buildAssistMessages({ kind: "QUESTION", title: "Streets", text: "A street is for walking.", question: "Who is it for?" });
    expect(asked.messages[1]?.content).toContain("Question: Who is it for?");
    const explained = buildAssistMessages({
      kind: "EXPLAIN",
      title: "Streets",
      text: `FAR_START ${"x".repeat(8_000)} The ground floor went quiet. ${"y".repeat(8_000)} FAR_END`,
      quote: "The ground floor went quiet.",
      context: "The ground floor went quiet.",
    });
    expect(explained.messages[1]?.content).toContain("Highlighted passage:\nThe ground floor went quiet.");
    expect(explained.messages[1]?.content).not.toContain("FAR_START");
    expect(explained.messages[1]?.content).not.toContain("FAR_END");
  });

  it("reads a chat response and refuses an empty one", () => {
    expect(readChatContent({ choices: [{ message: { content: "  A short summary. " } }], model: "llama3.2" }, "fallback")).toEqual({
      answer: "A short summary.",
      model: "llama3.2",
    });
    expect(readChatContent({ choices: [{ message: { content: [{ type: "text", text: "From parts." }] } }] }, "gpt-4o-mini").answer).toBe(
      "From parts.",
    );
    expect(() => readChatContent({ choices: [{ message: { content: "  " } }] }, "gpt-4o-mini")).toThrow(AssistError);
  });

  it("posts to chat completions and does not echo the API key on failure", async () => {
    const seen: string[] = [];
    const transport = async (request: { url: URL; headers: Record<string, string> }) => {
      seen.push(`${request.url.pathname} ${request.headers.authorization}`);
      return { status: 401, text: JSON.stringify({ error: { message: `rejected ${KEY}` } }) };
    };
    await expect(
      completeChat({
        endpoint: new URL("https://api.openai.com/v1"),
        hostClass: "public",
        apiKey: KEY,
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Hello" }],
        transport,
      }),
    ).rejects.toThrow(AssistError);
    expect(seen).toEqual([`/v1/chat/completions Bearer ${KEY}`]);
    expect(chatCompletionsUrl(new URL("https://api.openai.com/v1/chat/completions")).pathname).toBe("/v1/chat/completions");
    try {
      await completeChat({
        endpoint: new URL("http://127.0.0.1:11434/v1"),
        hostClass: "local",
        apiKey: KEY,
        model: "llama3.2",
        messages: [{ role: "user", content: "Hello" }],
        transport,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AssistError);
      expect((error as Error).message).not.toContain(KEY);
    }
  });

  it("does not follow a redirect", async () => {
    await expect(
      completeChat({
        endpoint: new URL("http://127.0.0.1:11434/v1"),
        hostClass: "local",
        apiKey: KEY,
        model: "llama3.2",
        messages: [{ role: "user", content: "Hello" }],
        transport: async () => ({ status: 302, text: "" }),
      }),
    ).rejects.toThrow(/redirected/);
  });
});

describe("assist configuration", () => {
  beforeEach(async () => {
    await db.assistNote.deleteMany();
    await db.assistConfig.deleteMany();
    await db.highlight.deleteMany();
    await db.document.deleteMany();
  });

  afterEach(() => setAssistTransportForTests(null));

  afterAll(async () => {
    await db.$disconnect();
  });

  it("stores the key on the server and leaves it out of status and export", async () => {
    const saved = await saveAssistConfig({ baseUrl: "http://127.0.0.1:11434/v1/", model: "llama3.2", apiKey: KEY });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.data).toEqual({ configured: true, hasKey: true, baseUrl: "http://127.0.0.1:11434/v1", model: "llama3.2" });
    expect(JSON.stringify(saved.data)).not.toContain(KEY);
    expect(normalizeAssistBaseUrl(new URL("http://127.0.0.1:11434/v1/"))).toBe("http://127.0.0.1:11434/v1");

    const status = await getAssistStatus();
    expect(status.configured).toBe(true);
    expect(JSON.stringify(status)).not.toContain(KEY);

    const kept = await saveAssistConfig({ baseUrl: "http://127.0.0.1:11434/v1", model: "llama3.2", apiKey: "" });
    expect(kept.ok && kept.data.configured && kept.data.hasKey).toBe(true);

    const exported = await exportLibrary();
    const body = await exported.text();
    expect(body).not.toContain(KEY);
    expect(body).toContain('"assist"');

    const cleared = await clearAssistConfig();
    expect(cleared.ok && cleared.data.configured && !cleared.data.hasKey).toBe(true);
  });

  it("saves a local endpoint with no key and does not send an authorization header", async () => {
    const saved = await saveAssistConfig({ baseUrl: "http://127.0.0.1:11434/v1", model: "llama3.2", apiKey: "  " });
    expect(saved.ok && saved.data.configured && !saved.data.hasKey).toBe(true);
    const status = await getAssistStatus();
    expect(status.hasKey).toBe(false);

    const doc = await db.document.create({
      data: { type: "NOTE", title: "Local", contentText: "There is enough text here to summarize for a test of the gate.", wordCount: 14 },
    });
    const seen: Array<string | undefined> = [];
    setAssistTransportForTests(async (request) => {
      seen.push(request.headers.authorization);
      return { status: 200, text: JSON.stringify({ choices: [{ message: { content: "A local answer." } }], model: "llama3.2" }) };
    });
    const result = await runAssist({ documentId: doc.id, kind: "SUMMARY" });
    expect(result.ok && result.data.answer).toBe("A local answer.");
    expect(seen).toEqual([undefined]);
  });

  it("rejects a metadata address", async () => {
    const blocked = await saveAssistConfig({ baseUrl: "http://169.254.169.254/latest", model: "gpt-4o-mini", apiKey: KEY });
    expect(blocked.ok).toBe(false);
  });

  it("saves a summary, replaces it, explains a highlight, and drops questions past eight", async () => {
    const doc = await db.document.create({
      data: {
        type: "NOTE",
        title: "On walking",
        contentText: "A street that cannot be crossed on foot is not a street. It is a wall with traffic on it.",
        contentHtml: "<p>A street that cannot be crossed on foot is not a street.</p>",
        wordCount: 18,
      },
    });
    const highlight = await db.highlight.create({
      data: { documentId: doc.id, quote: "not a street", startOffset: 38, endOffset: 50, context: "is not a street" },
    });
    await saveAssistConfig({ baseUrl: "http://127.0.0.1:11434/v1", model: "llama3.2", apiKey: KEY });

    let reply = "First summary.";
    setAssistTransportForTests(async () => ({
      status: 200,
      text: JSON.stringify({ choices: [{ message: { content: reply } }], model: "llama3.2" }),
    }));

    const summary = await runAssist({ documentId: doc.id, kind: "SUMMARY" });
    expect(summary.ok).toBe(true);
    if (!summary.ok) return;
    expect(summary.data.answer).toBe("First summary.");

    reply = "Second summary.";
    const again = await runAssist({ documentId: doc.id, kind: "SUMMARY" });
    expect(again.ok && again.data.answer).toBe("Second summary.");
    expect(await db.assistNote.count({ where: { documentId: doc.id, kind: "SUMMARY" } })).toBe(1);

    reply = "It means the street no longer works for people on foot.";
    const explained = await runAssist({ documentId: doc.id, highlightId: highlight.id, kind: "EXPLAIN" });
    expect(explained.ok && explained.data.answer).toContain("on foot");

    for (let i = 0; i < 9; i += 1) {
      reply = `Answer ${i}`;
      const asked = await runAssist({ documentId: doc.id, kind: "QUESTION", question: `Question ${i}?` });
      expect(asked.ok).toBe(true);
    }
    expect(await db.assistNote.count({ where: { documentId: doc.id, kind: "QUESTION" } })).toBe(8);

    await db.document.delete({ where: { id: doc.id } });
    expect(await db.assistNote.count({ where: { documentId: doc.id } })).toBe(0);
  });

  it("refuses to run before a model is connected", async () => {
    const doc = await db.document.create({
      data: { type: "NOTE", title: "Empty", contentText: "There is enough text here to summarize for a test of the gate.", wordCount: 14 },
    });
    const result = await runAssist({ documentId: doc.id, kind: "SUMMARY" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Settings/);
  });
});
