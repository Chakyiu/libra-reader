"use client";

import { useCallback, useOptimistic, useState, useTransition } from "react";
import { applyAssistPrompt } from "@/lib/actions/assist";
import { createHighlight, deleteHighlight, updateHighlight } from "@/lib/actions/highlights";
import type { NoteDraft } from "@/components/highlights/note-dialog";
import type { HighlightColor } from "@/lib/generated/prisma/enums";
import type { HighlightItem } from "@/lib/types";
import { MAX_QUOTE_LENGTH } from "@/lib/validation";
import { toast } from "sonner";

/**
 * Where a passage sits in the document. Each reader fills in the anchor its
 * format understands: offsets for articles and PDF pages, a CFI for EPUBs.
 */
export interface PassageAnchor {
  quote: string;
  prefix: string;
  suffix: string;
  context: string;
  startOffset: number;
  endOffset: number;
  page?: number;
  cfi?: string;
}

type OptimisticAction =
  | { type: "add"; highlight: HighlightItem }
  | { type: "update"; id: string; patch: Partial<HighlightItem> }
  | { type: "remove"; id: string };

function reduceHighlights(state: HighlightItem[], action: OptimisticAction): HighlightItem[] {
  if (action.type === "add") return [...state.filter((item) => item.id !== action.highlight.id), action.highlight];
  if (action.type === "remove") return state.filter((item) => item.id !== action.id);
  return state.map((item) => (item.id === action.id ? { ...item, ...action.patch } : item));
}

export function toDraft(highlight: HighlightItem): NoteDraft {
  return { id: highlight.id, quote: highlight.quote, note: highlight.note, color: highlight.color };
}

/**
 * Everything about a highlight except where it is painted: the optimistic list
 * the annotation panel shows, and the create / update / delete calls behind it.
 * Article, PDF and EPUB readers all use this, then paint in their own way.
 */
export function useHighlightMutations(documentId: string, highlights: HighlightItem[]) {
  const [optimistic, applyOptimistic] = useOptimistic(highlights, reduceHighlights);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<NoteDraft | null>(null);

  /** Highlight a passage the reader just located. Returns the saved row, or null. */
  const create = useCallback(
    (anchor: PassageAnchor, color: HighlightColor, withNote: boolean, promptId?: string): Promise<HighlightItem | null> =>
      new Promise((resolve) => {
        if (anchor.quote.length > MAX_QUOTE_LENGTH) {
          toast.error("That selection is too long to highlight. Try a paragraph or less.");
          resolve(null);
          return;
        }
        const now = new Date();
        const temp: HighlightItem = {
          id: `pending-${now.getTime()}`,
          documentId,
          quote: anchor.quote,
          prefix: anchor.prefix,
          suffix: anchor.suffix,
          context: anchor.context,
          startOffset: anchor.startOffset,
          endOffset: anchor.endOffset,
          page: anchor.page ?? null,
          cfi: anchor.cfi ?? null,
          color,
          note: null,
          createdAt: now,
          updatedAt: now,
        };
        startTransition(async () => {
          applyOptimistic({ type: "add", highlight: temp });
          const result = await createHighlight({ ...anchor, documentId, color });
          if (!result.ok) {
            toast.error(result.error);
            resolve(null);
            return;
          }
          const saved = result.data;
          // The painted mark is keyed by id, so swap the placeholder for the real row.
          applyOptimistic({ type: "remove", id: temp.id });
          applyOptimistic({ type: "add", highlight: saved });
          if (promptId) {
            const written = await applyAssistPrompt({ highlightId: saved.id, promptId });
            if (!written.ok) toast.error(written.error);
            else {
              applyOptimistic({ type: "update", id: saved.id, patch: { note: written.data.note } });
              toast("Note written");
            }
          } else if (withNote) {
            setEditing(toDraft(saved));
          } else {
            toast("Highlighted", { action: { label: "Add a note", onClick: () => setEditing(toDraft(saved)) } });
          }
          resolve(saved);
        });
      }),
    [applyOptimistic, documentId],
  );

  const update = useCallback(
    (id: string, patch: { note?: string; color?: HighlightColor }) =>
      new Promise<boolean>((resolve) => {
        const optimisticPatch: Partial<HighlightItem> = {};
        if (patch.color) optimisticPatch.color = patch.color;
        if (patch.note !== undefined) optimisticPatch.note = patch.note || null;
        startTransition(async () => {
          applyOptimistic({ type: "update", id, patch: optimisticPatch });
          const result = await updateHighlight({ id, ...patch });
          if (!result.ok) toast.error(result.error);
          else if (patch.note !== undefined) toast(patch.note ? "Note saved" : "Highlight updated");
          resolve(result.ok);
        });
      }),
    [applyOptimistic],
  );

  const remove = useCallback(
    (id: string) => {
      const highlight = optimistic.find((item) => item.id === id);
      setEditing(null);
      startTransition(async () => {
        applyOptimistic({ type: "remove", id });
        const result = await deleteHighlight(id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast("Highlight removed", {
          action: highlight
            ? {
                label: "Undo",
                onClick: () =>
                  startTransition(async () => {
                    applyOptimistic({ type: "add", highlight });
                    const restored = await createHighlight({
                      documentId: highlight.documentId,
                      quote: highlight.quote,
                      prefix: highlight.prefix,
                      suffix: highlight.suffix,
                      context: highlight.context,
                      startOffset: highlight.startOffset,
                      endOffset: highlight.endOffset,
                      page: highlight.page ?? undefined,
                      cfi: highlight.cfi ?? undefined,
                      color: highlight.color,
                      note: highlight.note ?? undefined,
                    });
                    if (!restored.ok) toast.error(restored.error);
                  }),
              }
            : undefined,
        });
      });
    },
    [applyOptimistic, optimistic],
  );

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Passage copied");
    } catch {
      toast.error("Your browser didn't allow copying.");
    }
  }, []);

  return { optimistic, create, update, remove, copy, editing, setEditing };
}
