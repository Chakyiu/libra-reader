"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { restoreStatuses, setFavorite, setStatus } from "@/lib/actions/documents";
import { plural } from "@/lib/format";

/** Favorite / archive / restore with toasts; archive always offers an exact Undo. */
export function useDocumentCommands() {
  const [pending, startTransition] = useTransition();

  const toggleFavorite = (ids: string[], value: boolean, title?: string) =>
    startTransition(async () => {
      const result = await setFavorite({ ids, value });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const what = ids.length === 1 && title ? `“${title}”` : plural(ids.length, "item");
      toast(value ? `Added ${what} to favorites` : `Removed ${what} from favorites`);
    });

  const archive = (ids: string[], title?: string, onDone?: () => void) =>
    startTransition(async () => {
      const result = await setStatus({ ids, status: "ARCHIVED" });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDone?.();
      const previous = result.data.previous;
      toast(ids.length === 1 && title ? `“${title}” archived` : `${plural(ids.length, "item")} archived`, {
        duration: 9000,
        action: {
          label: "Undo",
          onClick: () => {
            void restoreStatuses({ entries: previous }).then((undo) => {
              if (undo.ok) toast("Put back");
              else toast.error(undo.error);
            });
          },
        },
      });
    });

  const restore = (ids: string[], title?: string, onDone?: () => void) =>
    startTransition(async () => {
      const result = await setStatus({ ids, status: "RESTORE" });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDone?.();
      toast(ids.length === 1 && title ? `“${title}” restored` : `${plural(ids.length, "item")} restored`);
    });

  return { pending, toggleFavorite, archive, restore };
}
