"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCollection, updateCollection } from "@/lib/actions/collections";
import { COLLECTION_COLORS } from "@/lib/colors";
import type { CollectionColor } from "@/lib/generated/prisma/enums";
import type { CollectionSummary } from "@/lib/types";

export function CollectionFormDialog({
  open,
  onOpenChange,
  collection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection?: CollectionSummary;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <CollectionForm collection={collection} onOpenChange={onOpenChange} />}
    </Dialog>
  );
}

function CollectionForm({ collection, onOpenChange }: { collection?: CollectionSummary; onOpenChange: (open: boolean) => void }) {
  const id = useId();
  const router = useRouter();
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [color, setColor] = useState<CollectionColor>(collection?.color ?? "YELLOW");
  const [isFavorite, setIsFavorite] = useState(collection?.isFavorite ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const input = { name, description, color, isFavorite };
      const result = collection ? await updateCollection({ id: collection.id, ...input }) : await createCollection(input);
      if (!result.ok) {
        setError(result.fieldErrors?.name?.[0] ?? result.error);
        return;
      }
      onOpenChange(false);
      if (collection) toast("Collection updated");
      else {
        const created = result.data as { id: string };
        toast(`Created ${name.trim()}`, { action: { label: "Open", onClick: () => router.push(`/collections/${created.id}`) } });
      }
    });

  return (
    <DialogContent aria-describedby={undefined}>
      <DialogHeader>
        <DialogTitle>{collection ? "Edit collection" : "New collection"}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <form
          id={`${id}-form`}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            placeholder="Books to Revisit"
            maxLength={80}
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          {error && (
            <p id={`${id}-error`} role="alert" className="mt-2 text-[13px] text-err">
              {error}
            </p>
          )}
          <Label htmlFor={`${id}-description`} className="mt-[18px]">
            Description
          </Label>
          <Textarea
            id={`${id}-description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What belongs in here?"
            maxLength={500}
            className="min-h-20"
          />
        </form>
        <fieldset className="mt-[18px]">
          <legend className="caps mb-2.5">Colour</legend>
          <div role="radiogroup" aria-label="Collection colour" className="flex flex-wrap gap-2">
            {COLLECTION_COLORS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={color === option.value}
                onClick={() => setColor(option.value)}
                className="chip pointer-coarse:min-h-10"
              >
                <span className="swatch" style={{ background: option.cssVar }} aria-hidden />
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="mt-5 flex items-center gap-3 text-[13.5px]">
          <Checkbox checked={isFavorite} onCheckedChange={(value) => setIsFavorite(value === true)} />
          Show on Home as a favorite collection
        </label>
      </DialogBody>
      <DialogFooter>
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button size="sm" type="submit" form={`${id}-form`} disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          {collection ? "Save changes" : "Create collection"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
