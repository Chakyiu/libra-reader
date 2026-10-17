"use client";

import Link from "next/link";
import { Archive, ArchiveRestore, EllipsisVertical, ExternalLink, FileText, Folder, Star, Tag, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DocumentListItem } from "@/lib/types";

export type DocumentRequest = "tag" | "collection" | "delete";

export function DocumentMenu({
  document,
  onRequest,
  onFavorite,
  onArchive,
  onRestore,
}: {
  document: DocumentListItem;
  onRequest: (kind: DocumentRequest) => void;
  onFavorite: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="quiet" size="icon" aria-label={`More actions for ${document.title}`}>
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link href={`/read/${document.id}`}>
            <FileText />
            Open in reader
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onFavorite}>
          <Star />
          {document.isFavorite ? "Remove from favorites" : "Add to favorites"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onRequest("tag")}>
          <Tag />
          Add a tag…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onRequest("collection")}>
          <Folder />
          Collections…
        </DropdownMenuItem>
        {document.status === "ARCHIVED" ? (
          <DropdownMenuItem onSelect={onRestore}>
            <ArchiveRestore />
            Restore to library
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onArchive}>
            <Archive />
            Archive
          </DropdownMenuItem>
        )}
        {document.sourceUrl && (
          <DropdownMenuItem asChild>
            <a href={document.sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              Open the original
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onRequest("delete")}>
          <Trash />
          Delete…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
