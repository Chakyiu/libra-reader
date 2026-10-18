"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteAssistPrompt, saveAssistPrompt } from "@/lib/actions/assist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AssistPromptItem } from "@/lib/types";

function PromptFields({
  prompt,
  onSaved,
  onDeleted,
}: {
  prompt: AssistPromptItem | null;
  onSaved: (prompt: AssistPromptItem) => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(prompt?.name ?? "");
  const [body, setBody] = useState(prompt?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameId = prompt ? `prompt-name-${prompt.id}` : "prompt-name-new";
  const bodyId = prompt ? `prompt-body-${prompt.id}` : "prompt-body-new";

  return (
    <form
      className="grid gap-3 border-b border-border py-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await saveAssistPrompt({ id: prompt?.id, name, body });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          onSaved(result.data);
          if (!prompt) {
            setName("");
            setBody("");
          } else {
            setName(result.data.name);
            setBody(result.data.body);
          }
          toast(prompt ? "Prompt saved" : "Prompt added");
        });
      }}
    >
      <label className="grid gap-1.5" htmlFor={nameId}>
        <span className="text-sm font-medium">{prompt ? "Name" : "New prompt"}</span>
        <Input id={nameId} value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="grid gap-1.5" htmlFor={bodyId}>
        <span className="text-sm font-medium">Prompt</span>
        <Textarea
          id={bodyId}
          value={body}
          maxLength={2000}
          placeholder={"Explain this passage.\n\nTitle: {{title}}\nAuthor: {{author}}\n\n{{content}}"}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-[13px] text-err">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : prompt ? "Save" : "Add prompt"}
        </Button>
        {prompt && onDeleted && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await deleteAssistPrompt(prompt.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                onDeleted();
                toast("Prompt deleted");
              });
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}

export function AssistPromptSettings({ prompts: initial }: { prompts: AssistPromptItem[] }) {
  const [prompts, setPrompts] = useState(initial);

  return (
    <div className="mt-8">
      <h3 className="font-serif text-[21px] leading-[1.3] font-semibold tracking-[-0.015em]">Prompts</h3>
      <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">
        When you highlight a passage, pick one of these. <code className="font-mono text-[12px]">{"{{content}}"}</code> is the passage,{" "}
        <code className="font-mono text-[12px]">{"{{title}}"}</code> is the document title, and{" "}
        <code className="font-mono text-[12px]">{"{{author}}"}</code> is the author. The answer is saved as the note on that highlight.
      </p>
      {prompts.map((prompt) => (
        <PromptFields
          key={prompt.id}
          prompt={prompt}
          onSaved={(saved) => setPrompts((current) => current.map((item) => (item.id === saved.id ? saved : item)))}
          onDeleted={() => setPrompts((current) => current.filter((item) => item.id !== prompt.id))}
        />
      ))}
      <PromptFields
        prompt={null}
        onSaved={(saved) => setPrompts((current) => [...current, saved])}
      />
    </div>
  );
}
