"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, Folder, List, LoaderCircle, Pencil, Trash } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { CollectionFormDialog } from "@/components/collections/collection-form-dialog";
import { DocumentList } from "@/components/library/document-list";
import { AddContentButton } from "@/components/shell/add-content-button";
import { MobileMenuButton } from "@/components/shell/mobile-nav";
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
import { deleteCollection } from "@/lib/actions/collections";
import { collectionVar } from "@/lib/colors";
import { plural } from "@/lib/format";
import type { CollectionSummary, DocumentListItem } from "@/lib/types";

export function CollectionDetailView({
  collection,
  documents,
  collections,
  tags,
}: {
  collection: CollectionSummary;
  documents: DocumentListItem[];
  collections: CollectionSummary[];
  tags: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      const result = await deleteCollection(collection.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirming(false);
      toast(`Deleted ${collection.name}. Its ${plural(result.data.keptDocuments, "document")} stayed in your library.`);
      router.push("/collections");
    });

  return (
    <div className="mx-auto max-w-[1080px] px-[22px] pt-6 pb-24 sm:px-[26px] lg:px-[52px] lg:pt-9">
      <div className="mb-[18px] flex items-center">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href="/collections">
            <ChevronLeft />
            All collections
          </Link>
        </Button>
        <MobileMenuButton className="ml-auto -mr-2" />
      </div>
      <header className="flex flex-wrap items-start gap-4">
        <span className="min-h-[52px] w-1 self-stretch rounded-full" style={{ background: collectionVar(collection.color) }} aria-hidden />
        <div className="min-w-[240px] flex-1">
          <h1 className="font-serif text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[30px]">{collection.name}</h1>
          {collection.description && <p className="mt-2 max-w-[62ch] text-muted-foreground">{collection.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
            <Trash />
            Delete
          </Button>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2.5 border-b border-border pb-4">
        <span className="count">{plural(documents.length, "item")}</span>
        <span className="flex-1" />
        <Button variant="outline" size="sm" asChild>
          <Link href={`/library?collection=${collection.id}`}>
            <List />
            Open in library with filters
          </Link>
        </Button>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={<Folder />}
          title={`Nothing in ${collection.name} yet`}
          action={<AddContentButton collectionId={collection.id} />}
        >
          Add things here from the library with “Collections…”, or save straight into it when you add something.
        </EmptyState>
      ) : (
        <DocumentList
          documents={documents}
          collections={collections}
          allTags={tags}
          inCollection={{ id: collection.id, name: collection.name }}
        />
      )}

      <CollectionFormDialog open={editing} onOpenChange={setEditing} collection={collection} />
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{collection.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Only the collection goes. {documents.length > 0 ? `Its ${plural(documents.length, "document")} stay` : "Documents stay"} in your
              library with their highlights, tags and other collections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                remove();
              }}
            >
              {pending && <LoaderCircle className="animate-spin" />}
              Delete collection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
