"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AddContentDialog, type AddTab } from "@/components/add-content/add-content-dialog";
import type { CollectionSummary } from "@/lib/types";

interface AddContentOptions {
  tab?: AddTab;
  collectionId?: string;
}

interface AddContentContextValue {
  openAddContent: (options?: AddContentOptions) => void;
}

const AddContentContext = createContext<AddContentContextValue | null>(null);

export function AddContentProvider({ collections, children }: { collections: CollectionSummary[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AddContentOptions>({});
  const [session, setSession] = useState(0);

  const openAddContent = useCallback((next: AddContentOptions = {}) => {
    setOptions(next);
    setSession((value) => value + 1);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openAddContent }), [openAddContent]);

  return (
    <AddContentContext.Provider value={value}>
      {children}
      <AddContentDialog
        key={session}
        open={open}
        onOpenChange={setOpen}
        collections={collections}
        initialTab={options.tab ?? "url"}
        initialCollectionId={options.collectionId}
      />
    </AddContentContext.Provider>
  );
}

export function useAddContent(): AddContentContextValue {
  const value = useContext(AddContentContext);
  if (!value) throw new Error("useAddContent must be used inside AddContentProvider");
  return value;
}
