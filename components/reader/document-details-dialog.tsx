"use client";

import { useId, useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDocumentDetails } from "@/lib/actions/documents";
import type { DocumentListItem } from "@/lib/types";

export function DocumentDetailsDialog({
  document,
  open,
  onOpenChange,
}: {
  document: DocumentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <DetailsForm document={document} onOpenChange={onOpenChange} />}
    </Dialog>
  );
}

function DetailsForm({ document, onOpenChange }: { document: DocumentListItem; onOpenChange: (open: boolean) => void }) {
  const id = useId();
  const [title, setTitle] = useState(document.title);
  const [author, setAuthor] = useState(document.author ?? "");
  const [publication, setPublication] = useState(document.publication ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await updateDocumentDetails({ id: document.id, title, author, publication });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Details saved");
      onOpenChange(false);
    });

  return (
    <DialogContent aria-describedby={undefined}>
      <DialogHeader>
        <DialogTitle>Edit details</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <form
          id={`${id}-form`}
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="grid gap-[18px]"
        >
          <div>
            <Label htmlFor={`${id}-title`}>Title</Label>
            <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} required autoFocus />
          </div>
          <div className="grid gap-[18px] sm:grid-cols-2">
            <div>
              <Label htmlFor={`${id}-author`}>Author</Label>
              <Input id={`${id}-author`} value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={200} />
            </div>
            <div>
              <Label htmlFor={`${id}-publication`}>Publication or source</Label>
              <Input id={`${id}-publication`} value={publication} onChange={(e) => setPublication(e.target.value)} maxLength={200} />
            </div>
          </div>
        </form>
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-err">
            {error}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button size="sm" type="submit" form={`${id}-form`} disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
