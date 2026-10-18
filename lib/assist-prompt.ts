import { ASSIST_TEXT_LIMIT, type ChatMessage } from "@/lib/assist";

const TOKEN = /\{\{\s*(content|title|author)\s*\}\}/gi;

const SYSTEM_PROMPT = [
  "You help a person write a note on a passage they highlighted.",
  "Follow the instruction in the user message.",
  "Use only the passage, title, and author given there.",
  "If the passage does not contain the answer, say so in one sentence.",
  "Do not invent quotations, citations, page numbers, or facts.",
  "Write plain sentences.",
].join(" ");

export interface AssistPromptValues {
  content: string;
  title: string;
  author: string;
}

function oneLine(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function clip(text: string): { text: string; truncated: boolean } {
  if (text.length <= ASSIST_TEXT_LIMIT) return { text, truncated: false };
  return {
    text: `${text.slice(0, ASSIST_TEXT_LIMIT)}\n\n[The rest of the passage was not included.]`,
    truncated: true,
  };
}

/** Replaces {{content}}, {{title}}, and {{author}}. A prompt with no {{content}} still receives the passage. */
export function fillAssistPrompt(template: string, values: AssistPromptValues): string {
  let usedContent = false;
  const filled = template.replace(TOKEN, (_match, key: string) => {
    const name = key.toLowerCase();
    if (name === "content") {
      usedContent = true;
      return values.content;
    }
    if (name === "title") return values.title;
    return values.author;
  });
  const text = filled.trim();
  if (usedContent) return text;
  return [text, `Highlighted passage:\n${values.content}`].filter(Boolean).join("\n\n");
}

/** The messages for one highlight prompt. Title and author are single lines; the passage is clipped past the assist limit. */
export function buildPromptMessages(input: {
  template: string;
  content: string;
  title: string;
  author: string;
}): { messages: ChatMessage[]; truncated: boolean } {
  const values: AssistPromptValues = {
    content: input.content.trim(),
    title: oneLine(input.title, 300) || "Untitled",
    author: oneLine(input.author, 200),
  };
  const clipped = clip(fillAssistPrompt(input.template, values));
  return {
    truncated: clipped.truncated,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: clipped.text },
    ],
  };
}
