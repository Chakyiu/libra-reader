"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { clearAssistConfig, saveAssistConfig } from "@/lib/actions/assist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AssistStatus } from "@/lib/types";

export function AssistSettings({ status }: { status: AssistStatus }) {
  const [baseUrl, setBaseUrl] = useState(status.baseUrl);
  const [model, setModel] = useState(status.model);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(status.hasKey);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-5 grid max-w-[52ch] gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await saveAssistConfig({ baseUrl, model, apiKey });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setHasKey(result.data.hasKey);
          setBaseUrl(result.data.baseUrl);
          setModel(result.data.model);
          setApiKey("");
          toast("Model saved");
        });
      }}
    >
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Endpoint</span>
        <Input
          value={baseUrl}
          spellCheck={false}
          autoComplete="off"
          maxLength={300}
          onChange={(event) => setBaseUrl(event.target.value)}
          aria-describedby="assist-endpoint-hint"
        />
        <span id="assist-endpoint-hint" className="text-[12.5px] leading-relaxed text-muted-foreground">
          OpenAI uses https://api.openai.com/v1. Ollama on this computer uses http://127.0.0.1:11434/v1. If Libra is in Docker
          and the model is on the host, use http://host.docker.internal:11434/v1.
        </span>
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Model</span>
        <Input
          value={model}
          spellCheck={false}
          autoComplete="off"
          maxLength={80}
          onChange={(event) => setModel(event.target.value)}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">API key</span>
        <Input
          type="password"
          name="libra-assist-key"
          value={apiKey}
          autoComplete="off"
          spellCheck={false}
          maxLength={500}
          placeholder={hasKey ? "Saved — leave blank to keep it" : "Optional"}
          onChange={(event) => setApiKey(event.target.value)}
        />
        <span className="text-[12.5px] leading-relaxed text-muted-foreground">
          {hasKey
            ? "A key is saved on this device. It is not shown here and it is left out of JSON export."
            : "Leave this empty when the server doesn't ask for a key. Ollama doesn't."}
        </span>
      </label>
      {error && (
        <p role="alert" className="text-[13px] text-err">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {hasKey && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await clearAssistConfig();
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setHasKey(false);
                setApiKey("");
                toast("API key removed");
              });
            }}
          >
            Remove key
          </Button>
        )}
      </div>
    </form>
  );
}
