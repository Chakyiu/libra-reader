"use client";

import { useId, useState, useTransition } from "react";
import { Check, LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addTags, addToCollection, deleteDocuments, removeFromCollection } from "@/lib/actions/documents";
import { collectionVar } from "@/lib/colors";
import { plural } from "@/lib/format";
import type { CollectionSummary } from "@/lib/types";
import { parseTagInput } from "@/lib/validation";

function subject(ids: string[], title?: string): string {
  return ids.length === 1 && title ? `“${title}”` : `${plural(ids.length, "item")} selected`;
}

export function TagDialog({
  open,
  onOpenChange,
  ids,
  title,
  existingTags,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  title?: string;
  existingTags: string[];
  onDone?: () => void;
}) {
  const inputId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (raw: string) => {
    const tags = parseTagInput(raw);
    if (tags.length === 0) {
      setError("Type a tag first.");
      return;
    }
    startTransition(async () => {
      const result = await addTags({ ids, tags });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      setValue("");
      toast(`Tagged ${plural(ids.length, "item")} with ${result.data.tags.map((t) => `#${t}`).join(" ")}`);
      onDone?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a tag</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription className="mb-[18px]">{subject(ids, title)}</DialogDescription>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit(value);
            }}
          >
            <Label htmlFor={inputId}>Tags</Label>
            <Input
              id={inputId}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              placeholder="A new or existing tag; separate several with commas"
              autoFocus
              autoComplete="off"
              aria-invalid={error ? true : undefined}
            />
          </form>
          {error && (
            <p role="alert" className="mt-2 text-[13px] text-err">
              {error}
            </p>
          )}
          {existingTags.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="caps mr-1">Existing</span>
              {existingTags.map((tag) => (
                <button key={tag} type="button" className="chip" data-variant="tag" onClick={() => submit(tag)} disabled={pending}>
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <span className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => submit(value)} disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Plus />}
            Add tag
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Collections are many-to-many. For one document each row toggles
 * membership; for a selection each row adds every selected document.
 */
export function CollectionDialog({
  open,
  onOpenChange,
  ids,
  title,
  collections,
  memberOf = [],
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  title?: string;
  collections: CollectionSummary[];
  memberOf?: string[];
  onDone?: () => void;
}) {
  const single = ids.length === 1;
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const choose = (collection: CollectionSummary) => {
    const isMember = single && memberOf.includes(collection.id);
    setBusyId(collection.id);
    startTransition(async () => {
      const result = isMember
        ? await removeFromCollection({ ids, collectionId: collection.id })
        : await addToCollection({ ids, collectionId: collection.id });
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast(isMember ? `Removed from ${collection.name}` : `Added ${plural(ids.length, "item")} to ${collection.name}`);
      onDone?.();
      if (!single) onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{single ? "Collections" : "Add to collection"}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription className="mb-[18px]">
            {subject(ids, title)}
            {single ? " · a document can live in several collections." : ""}
          </DialogDescription>
          {collections.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">
              No collections yet. Create one from the Collections page, then come back.
            </p>
          ) : (
            <div className="grid gap-2.5">
              {collections.map((collection) => {
                const isMember = single && memberOf.includes(collection.id);
                return (
                  <button
                    key={collection.id}
                    type="button"
                    aria-pressed={single ? isMember : undefined}
                    onClick={() => choose(collection)}
                    disabled={pending}
                    className="flex min-h-12 w-full items-center gap-3 rounded-sm border border-border bg-background px-4 text-left text-[13.5px] transition-colors hover:border-foreground/25 hover:bg-well aria-pressed:border-terracotta/35 aria-pressed:bg-terracotta/8 disabled:opacity-60"
                  >
                    <span className="swatch size-3" style={{ background: collectionVar(collection.color) }} aria-hidden />
                    <span className="font-medium">{collection.name}</span>
                    <span className="ml-auto font-mono text-[11.5px] text-muted-foreground">{collection.documentCount}</span>
                    {busyId === collection.id ? (
                      <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
                    ) : isMember ? (
                      <Check className="size-4 text-terracotta" aria-hidden />
                    ) : (
                      <span className="size-4" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <span className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDocumentsDialog({
  open,
  onOpenChange,
  ids,
  title,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  title?: string;
  onDeleted?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const many = ids.length > 1;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{many ? `Delete ${ids.length} documents?` : `Delete “${title ?? "this document"}”?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {many ? "They" : "It"} will be removed from your library along with every highlight and note on{" "}
            {many ? "them" : "it"}, and any uploaded file will be erased from this device. This can&apos;t be undone.
            Archiving keeps things out of the way without losing them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await deleteDocuments({ ids });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                onOpenChange(false);
                toast(result.data.count === 1 ? "Deleted" : `Deleted ${result.data.count} documents`);
                onDeleted?.();
              });
            }}
          >
            {pending && <LoaderCircle className="animate-spin" />}
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
