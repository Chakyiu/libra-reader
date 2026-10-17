"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { runAssist } from "@/lib/actions/assist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AssistAnswer, AssistKindName, DocumentAssist } from "@/lib/types";

/** Changes when a saved answer changes, so the panel remounts with the server copy. */
export function assistRevision(assist: DocumentAssist): string {
  const questions = assist.questions.map((note) => note.updatedAt).join(",");
  const explanations = Object.values(assist.explanations)
    .map((note) => note.updatedAt)
    .join(",");
  return `${assist.summary?.updatedAt ?? ""}|${assist.outline?.updatedAt ?? ""}|${questions}|${explanations}`;
}

function AnswerBlock({ answer, label }: { answer: AssistAnswer; label?: string }) {
  return (
    <div className="mt-4 border-l-2 border-terracotta/50 pl-4">
      {label && <p className="mb-1 text-[13px] font-medium">{label}</p>}
      <p className="text-[14px] leading-relaxed whitespace-pre-line">{answer.answer}</p>
      <p className="mt-2 text-[11.5px] text-muted-foreground">Generated · {answer.model}</p>
    </div>
  );
}

export function AssistPanel({
  documentId,
  wordCount,
  assist,
  configured,
  showHeading = true,
}: {
  documentId: string;
  wordCount: number;
  assist: DocumentAssist;
  configured: boolean;
  showHeading?: boolean;
}) {
  const [summary, setSummary] = useState(assist.summary);
  const [outline, setOutline] = useState(assist.outline);
  const [questions, setQuestions] = useState(assist.questions);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingKind, setPendingKind] = useState<AssistKindName | null>(null);
  const [pending, startTransition] = useTransition();

  const ask = (kind: AssistKindName, extra?: { question?: string }) => {
    setError(null);
    setPendingKind(kind);
    startTransition(async () => {
      const result = await runAssist({ documentId, kind, ...extra });
      setPendingKind(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (kind === "SUMMARY") setSummary(result.data);
      else if (kind === "OUTLINE") setOutline(result.data);
      else {
        setQuestions((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)].slice(0, 8));
        setQuestion("");
      }
    });
  };

  if (!configured) {
    return (
      <section aria-label="Assist">
        {showHeading && <h2 className="caps mb-2">Assist</h2>}
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          Connect a model in Settings to summarize this, outline it, or ask a question. Nothing is sent until you do.
        </p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link href="/settings/assist">Open Settings</Link>
        </Button>
      </section>
    );
  }

  return (
    <section aria-label="Assist" aria-busy={pending}>
      {showHeading && <h2 className="caps mb-2">Assist</h2>}
      <p className="text-[13.5px] leading-relaxed text-muted-foreground">
        Written from this document. Check it against the text — it can miss things.
      </p>
      {wordCount > 4500 && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
          This one is long, so Assist reads the beginning and says when the rest was left out.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => ask("SUMMARY")}>
          <Sparkles />
          {pendingKind === "SUMMARY" ? "Summarizing…" : summary ? "Summarize again" : "Summarize"}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => ask("OUTLINE")}>
          {pendingKind === "OUTLINE" ? "Outlining…" : outline ? "Outline again" : "Outline"}
        </Button>
      </div>
      {summary && <AnswerBlock answer={summary} />}
      {outline && <AnswerBlock answer={outline} label="Outline" />}
      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          const value = question.trim();
          if (!value) {
            setError("Ask something about this text.");
            return;
          }
          ask("QUESTION", { question: value });
        }}
      >
        <label htmlFor={`assist-question-${documentId}`} className="mb-1.5 block text-[13px] font-medium">
          Ask about this
        </label>
        <div className="flex gap-2">
          <Input
            id={`assist-question-${documentId}`}
            value={question}
            maxLength={500}
            placeholder="What is the author arguing?"
            className="h-10 text-[13px]"
            onChange={(event) => setQuestion(event.target.value)}
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pendingKind === "QUESTION" ? "Asking…" : "Ask"}
          </Button>
        </div>
      </form>
      {questions.map((item) => (
        <AnswerBlock key={item.id} answer={item} label={item.question ?? "Question"} />
      ))}
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-err">
          {error}
        </p>
      )}
    </section>
  );
}

/** Explains one highlight. Renders nothing until a model is connected or an explanation already exists. */
export function ExplainPassage({
  documentId,
  highlightId,
  initial,
  configured,
}: {
  documentId: string;
  highlightId: string;
  initial: { answer: string; model: string } | null;
  configured: boolean;
}) {
  const [answer, setAnswer] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!configured && !answer) return null;

  return (
    <div className="mt-4">
      {answer && (
        <>
          <p className="max-h-40 overflow-y-auto text-[13.5px] leading-relaxed whitespace-pre-line">{answer.answer}</p>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">Generated · {answer.model}</p>
        </>
      )}
      {configured && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={answer ? "mt-3" : undefined}
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await runAssist({ documentId, highlightId, kind: "EXPLAIN" });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setAnswer({ answer: result.data.answer, model: result.data.model });
            });
          }}
        >
          <Sparkles />
          {pending ? "Explaining…" : answer ? "Explain again" : "Explain"}
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-err">
          {error}
        </p>
      )}
    </div>
  );
}
