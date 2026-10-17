"use client";

import { useId, useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateNote } from "@/lib/actions/documents";

/** In-place editor for a personal note. Highlights re-anchor to the new text after saving. */
export function NoteEditor({
  id,
  title,
  body,
  hasHighlights,
  onDone,
}: {
  id: string;
  title: string;
  body: string;
  hasHighlights: boolean;
  onDone: () => void;
}) {
  const fieldId = useId();
  const [draftTitle, setDraftTitle] = useState(title === "Untitled note" ? "" : title);
  const [draftBody, setDraftBody] = useState(body);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await updateNote({ id, title: draftTitle, body: draftBody });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Note saved");
      onDone();
    });

  return (
    <div className="mx-auto w-full max-w-[720px] px-[22px] pt-8 pb-36 sm:px-11 lg:pt-[38px]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Label htmlFor={`${fieldId}-title`}>Title</Label>
        <Input
          id={`${fieldId}-title`}
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          placeholder="Untitled note"
          maxLength={300}
          className="font-serif text-xl font-semibold"
        />
        <Label htmlFor={`${fieldId}-body`} className="mt-[18px]">
          Note
        </Label>
        <Textarea
          id={`${fieldId}-body`}
          value={draftBody}
          onChange={(event) => setDraftBody(event.target.value)}
          className="min-h-[50vh] font-serif text-[18px] leading-[1.7]"
          autoFocus
        />
        <p className="mt-2.5 text-[12.5px] text-muted-foreground">
          Blank lines start a new paragraph.
          {hasHighlights ? " Highlights stay attached where their passage still exists; any that can't be found are flagged." : ""}
        </p>
        {error && (
          <p role="alert" className="mt-2.5 text-[13px] text-err">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-2.5">
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" />}
            Save note
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
