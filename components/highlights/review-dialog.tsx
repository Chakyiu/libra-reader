"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { HighlightWithSource } from "@/lib/types";

/** One highlight at a time, for rereading what you kept. ← and → step through. */
export function ReviewDialog({
  open,
  onOpenChange,
  highlights,
  onEditNote,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlights: HighlightWithSource[];
  onEditNote: (highlight: HighlightWithSource) => void;
}) {
  const [index, setIndex] = useState(0);
  const total = highlights.length;
  const current = highlights[Math.min(index, total - 1)];

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setIndex((value) => Math.min(total - 1, value + 1));
      if (event.key === "ArrowLeft") setIndex((value) => Math.max(0, value - 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, total]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setIndex(0);
        onOpenChange(next);
      }}
    >
      {current && (
        <DialogContent size="wide" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Review</DialogTitle>
            <span className="count" aria-live="polite">
              {Math.min(index, total - 1) + 1} of {total}
            </span>
          </DialogHeader>
          <DialogBody className="px-[22px] py-8 sm:px-11 sm:py-10">
            <p className="font-serif text-[22px] leading-[1.55] tracking-[-0.01em] whitespace-pre-line sm:text-[25px]">
              <span className="hl-wash" data-color={current.color}>
                {current.quote}
              </span>
            </p>
            {current.note && (
              <p className="mt-[26px] border-l-2 border-terracotta/60 pl-4 text-[15px] leading-relaxed text-muted-foreground italic">
                {current.note}
              </p>
            )}
            <p className="mt-[30px] flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
              <span className="font-medium text-foreground/85">{current.document.title}</span>
              {current.document.author && (
                <>
                  <span aria-hidden>·</span>
                  <span>{current.document.author}</span>
                </>
              )}
              {current.document.tags.map((tag) => (
                <span key={tag} className="chip py-1" data-variant="tag">
                  #{tag}
                </span>
              ))}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>
              <ChevronLeft />
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEditNote(current)}>
              <NotebookPen />
              {current.note ? "Edit note" : "Add note"}
            </Button>
            <span className="flex-1" />
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/read/${current.document.id}?hl=${current.id}`}>Go to passage</Link>
            </Button>
            <Button size="sm" onClick={() => setIndex((value) => Math.min(total - 1, value + 1))} disabled={index >= total - 1}>
              Next
              <ChevronRight />
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
