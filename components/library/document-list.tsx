"use client";

import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Folder, FolderMinus, Star, Tag, Trash, X } from "lucide-react";
import { toast } from "sonner";
import { CollectionDialog, DeleteDocumentsDialog, TagDialog } from "@/components/documents/document-dialogs";
import { useDocumentCommands } from "@/components/documents/use-document-commands";
import { DocumentCard, DocumentRow, type ItemHandlers } from "@/components/library/document-items";
import type { DocumentRequest } from "@/components/library/document-menu";
import { Button } from "@/components/ui/button";
import { removeFromCollection } from "@/lib/actions/documents";
import { plural } from "@/lib/format";
import type { CollectionSummary, DocumentListItem } from "@/lib/types";

type DialogState = { kind: DocumentRequest; ids: string[]; title?: string; memberOf?: string[] } | null;

export function DocumentList({
  documents,
  collections,
  allTags,
  layout = "list",
  inCollection,
  selectMode: controlledSelectMode,
  onSelectModeChange,
  hideSelectButton = false,
}: {
  documents: DocumentListItem[];
  collections: CollectionSummary[];
  allTags: string[];
  layout?: "list" | "grid";
  inCollection?: { id: string; name: string };
  /** Pass to control select mode from a surrounding toolbar. */
  selectMode?: boolean;
  onSelectModeChange?: (value: boolean) => void;
  hideSelectButton?: boolean;
}) {
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [ownSelectMode, setOwnSelectMode] = useState(false);
  const selectMode = controlledSelectMode ?? ownSelectMode;
  const setSelectMode = (value: boolean) => {
    setOwnSelectMode(value);
    onSelectModeChange?.(value);
  };
  const [dialog, setDialog] = useState<DialogState>(null);
  const commands = useDocumentCommands();

  // Selection only ever refers to documents currently on screen.
  const visibleIds = useMemo(() => new Set(documents.map((d) => d.id)), [documents]);
  const selected = useMemo(() => [...selection].filter((id) => visibleIds.has(id)), [selection, visibleIds]);
  const selectedDocs = documents.filter((d) => selection.has(d.id));
  const allArchived = selectedDocs.length > 0 && selectedDocs.every((d) => d.status === "ARCHIVED");
  const allFavorite = selectedDocs.length > 0 && selectedDocs.every((d) => d.isFavorite);

  const clear = () => {
    setSelection(new Set());
    setSelectMode(false);
  };

  const handlers: ItemHandlers = {
    onToggleSelect: (id) =>
      setSelection((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    onRequest: (document, kind) =>
      setDialog({
        kind,
        ids: [document.id],
        title: document.title,
        memberOf: document.collections.map((c) => c.id),
      }),
    onFavorite: (document) => commands.toggleFavorite([document.id], !document.isFavorite, document.title),
    onArchive: (document) => commands.archive([document.id], document.title),
    onRestore: (document) => commands.restore([document.id], document.title),
  };

  return (
    <>
      {(!hideSelectButton || selectMode || selected.length > 0) && (
        <div className="flex min-h-10 items-center gap-2 pt-3">
          {(!hideSelectButton || selectMode) && (
            <Button
              variant="quiet"
              size="sm"
              onClick={() => (selectMode ? clear() : setSelectMode(true))}
              aria-pressed={selectMode}
              className="-ml-2.5"
            >
              {selectMode ? "Done" : "Select"}
            </Button>
          )}
          {(selectMode || selected.length > 0) && (
            <Button variant="quiet" size="sm" onClick={() => setSelection(new Set(documents.map((d) => d.id)))}>
              Select all {documents.length}
            </Button>
          )}
        </div>
      )}

      {layout === "grid" ? (
        <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(216px,1fr))] gap-x-6 gap-y-[30px] max-sm:grid-cols-2 max-sm:gap-x-4">
          {documents.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              selected={selection.has(document.id)}
              selectMode={selectMode}
              handlers={handlers}
            />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col">
          {documents.map((document) => (
            <DocumentRow
              key={document.id}
              document={document}
              selected={selection.has(document.id)}
              selectMode={selectMode}
              handlers={handlers}
            />
          ))}
        </ul>
      )}

      {selected.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="sticky bottom-5 z-20 mx-auto mt-5 flex max-w-[760px] flex-wrap items-center gap-2 rounded-lg border border-border bg-surface py-3 pr-3 pl-5 shadow-pop max-lg:bottom-[calc(96px+env(safe-area-inset-bottom))]"
        >
          <b className="text-[13px] font-semibold">{selected.length} selected</b>
          <span className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "tag", ids: selected })} aria-label="Add tag">
            <Tag />
            <span className="max-sm:hidden">Add tag</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "collection", ids: selected })} aria-label="Add to collection">
            <Folder />
            <span className="max-sm:hidden">Add to collection</span>
          </Button>
          {inCollection && (
            <Button
              variant="outline"
              size="sm"
              aria-label={`Remove from ${inCollection.name}`}
              onClick={async () => {
                const ids = selected;
                const result = await removeFromCollection({ ids, collectionId: inCollection.id });
                if (!result.ok) toast.error(result.error);
                else {
                  toast(`Removed ${plural(ids.length, "item")} from ${inCollection.name}`);
                  clear();
                }
              }}
            >
              <FolderMinus />
              <span className="max-sm:hidden">Remove from collection</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            aria-label={allFavorite ? "Remove from favorites" : "Add to favorites"}
            onClick={() => commands.toggleFavorite(selected, !allFavorite)}
          >
            <Star className={allFavorite ? "fill-current" : undefined} />
            <span className="max-sm:hidden">{allFavorite ? "Unfavorite" : "Favorite"}</span>
          </Button>
          {allArchived ? (
            <Button variant="outline" size="sm" aria-label="Restore" onClick={() => commands.restore(selected, undefined, clear)}>
              <ArchiveRestore />
              <span className="max-sm:hidden">Restore</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm" aria-label="Archive" onClick={() => commands.archive(selected, undefined, clear)}>
              <Archive />
              <span className="max-sm:hidden">Archive</span>
            </Button>
          )}
          <Button variant="outline" size="sm" aria-label="Delete" onClick={() => setDialog({ kind: "delete", ids: selected })}>
            <Trash />
            <span className="max-sm:hidden">Delete</span>
          </Button>
          <Button variant="quiet" size="icon-sm" aria-label="Clear selection" onClick={clear}>
            <X />
          </Button>
        </div>
      )}

      <TagDialog
        open={dialog?.kind === "tag"}
        onOpenChange={(open) => !open && setDialog(null)}
        ids={dialog?.ids ?? []}
        title={dialog?.title}
        existingTags={allTags}
        onDone={() => dialog && dialog.ids.length > 1 && clear()}
      />
      <CollectionDialog
        open={dialog?.kind === "collection"}
        onOpenChange={(open) => !open && setDialog(null)}
        ids={dialog?.ids ?? []}
        title={dialog?.title}
        collections={collections}
        memberOf={
          dialog?.ids.length === 1
            ? (documents.find((d) => d.id === dialog.ids[0])?.collections.map((c) => c.id) ?? dialog.memberOf)
            : undefined
        }
        onDone={() => dialog && dialog.ids.length > 1 && clear()}
      />
      <DeleteDocumentsDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        ids={dialog?.ids ?? []}
        title={dialog?.title}
        onDeleted={clear}
      />
    </>
  );
}
