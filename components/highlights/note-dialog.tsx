"use client";

import { useId, useState } from "react";
import { LoaderCircle, Trash } from "lucide-react";
import { ColorChips } from "@/components/highlights/color-chips";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { highlightVar } from "@/lib/colors";
import type { HighlightColor } from "@/lib/generated/prisma/enums";
import { MAX_HIGHLIGHT_NOTE_LENGTH } from "@/lib/validation";

export interface NoteDraft {
  id: string;
  quote: string;
  note: string | null;
  color: HighlightColor;
}

/** Edit a highlight's note and colour; also the place to delete it. */
export function NoteDialog({
  highlight,
  onOpenChange,
  onSave,
  onDelete,
}: {
  highlight: NoteDraft | null;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: { note: string; color: HighlightColor }) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  return (
    <Dialog open={highlight !== null} onOpenChange={onOpenChange}>
      {highlight && (
        <NoteDialogBody key={highlight.id} highlight={highlight} onOpenChange={onOpenChange} onSave={onSave} onDelete={onDelete} />
      )}
    </Dialog>
  );
}

function NoteDialogBody({
  highlight,
  onOpenChange,
  onSave,
  onDelete,
}: {
  highlight: NoteDraft;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: { note: string; color: HighlightColor }) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const fieldId = useId();
  const [note, setNote] = useState(highlight.note ?? "");
  const [color, setColor] = useState<HighlightColor>(highlight.color);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const ok = await onSave(highlight.id, { note: note.trim(), color });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <DialogContent aria-describedby={undefined}>
      <DialogHeader>
        <span className="swatch size-3.5" style={{ background: highlightVar(color) }} aria-hidden />
        <DialogTitle>{highlight.note ? "Edit note" : "Add a note"}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <blockquote
          className="mb-5 max-h-48 overflow-y-auto rounded-r-sm border-l-[3px] bg-well px-[18px] py-3.5 font-serif text-base leading-relaxed whitespace-pre-line"
          style={{ borderColor: highlightVar(color) }}
        >
          {highlight.quote}
        </blockquote>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Label htmlFor={fieldId}>Your note</Label>
          <Textarea
            id={fieldId}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void save();
              }
            }}
            placeholder="What made this worth keeping?"
            maxLength={MAX_HIGHLIGHT_NOTE_LENGTH}
            autoFocus
          />
        </form>
        <div className="mt-[18px] flex flex-wrap items-center gap-3">
          <span className="caps">Colour</span>
          <ColorChips value={color} onChange={setColor} />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onOpenChange(false);
            onDelete(highlight.id);
          }}
        >
          <Trash />
          Delete highlight
        </Button>
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving && <LoaderCircle className="animate-spin" />}
          Save note
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
