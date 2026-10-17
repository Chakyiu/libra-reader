"use client";

import Link from "next/link";
import { cn } from "cn";
import { Star } from "lucide-react";
import { ReadingProgress } from "@/components/common/progress";
import { Bookplate } from "@/components/library/bookplate";
import { DocumentMenu, type DocumentRequest } from "@/components/library/document-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { collectionVar } from "@/lib/colors";
import { formatDate, lengthLabel, percent, STATUS_CHIP, TYPE_LABEL } from "@/lib/format";
import type { DocumentListItem } from "@/lib/types";

export interface ItemHandlers {
  onToggleSelect: (id: string) => void;
  onRequest: (document: DocumentListItem, kind: DocumentRequest) => void;
  onFavorite: (document: DocumentListItem) => void;
  onArchive: (document: DocumentListItem) => void;
  onRestore: (document: DocumentListItem) => void;
}

export function DocumentRow({
  document,
  selected,
  selectMode,
  handlers,
}: {
  document: DocumentListItem;
  selected: boolean;
  selectMode: boolean;
  handlers: ItemHandlers;
}) {
  const byline = [document.author, document.publication !== document.author ? document.publication : null]
    .filter(Boolean)
    .join(" · ");
  const details = [TYPE_LABEL[document.type], lengthLabel(document), `Saved ${formatDate(document.createdAt)}`]
    .filter(Boolean)
    .join(" · ");
  return (
    <li
      data-selected={selected || undefined}
      className={cn(
        "group/row relative -mx-3.5 grid items-start gap-4 rounded-sm border-b border-border px-3.5 py-[18px] transition-colors hover:bg-foreground/4 data-selected:bg-terracotta/9",
        selectMode
          ? "grid-cols-[22px_60px_minmax(0,1fr)_auto] max-sm:grid-cols-[22px_52px_minmax(0,1fr)]"
          : "grid-cols-[22px_60px_minmax(0,1fr)_auto] max-sm:grid-cols-[52px_minmax(0,1fr)_auto] max-sm:gap-3.5",
      )}
    >
      <div className={cn("relative z-10 pt-1", !selectMode && "max-sm:hidden")}>
        <Checkbox
          checked={selected}
          onCheckedChange={() => handlers.onToggleSelect(document.id)}
          aria-label={`Select ${document.title}`}
          className={cn(
            "transition-opacity",
            selected || selectMode ? "opacity-100" : "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100",
          )}
        />
      </div>
      <Bookplate
        type={document.type}
        publication={document.publication}
        title={document.title}
        importStatus={document.importStatus}
        className="max-sm:size-[52px] max-sm:[&_b]:text-base"
      />
      <div className="min-w-0">
        <h3 className="font-serif text-[19px] leading-[1.3] font-medium tracking-[-0.01em] text-balance max-sm:text-lg">
          <Link
            href={`/read/${document.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {document.title}
          </Link>
        </h3>
        <p className="mt-[7px] flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground max-sm:hidden">
          {byline && (
            <>
              <span>{byline}</span>
              <span aria-hidden className="opacity-75">
                ·
              </span>
            </>
          )}
          <span>{details}</span>
          {document.status !== "READING" && <span className="chip ml-0.5 py-1">{STATUS_CHIP[document.status]}</span>}
          {document.importStatus === "LINK_ONLY" && <span className="chip py-1">Link only</span>}
        </p>
        {/* The phone keeps the mobile comp's two quiet lines and drops the chips. */}
        <p className="mt-[7px] text-[12.5px] leading-[1.55] text-muted-foreground sm:hidden">
          <span className="block truncate">{[document.author, TYPE_LABEL[document.type], lengthLabel(document)].filter(Boolean).join(" · ")}</span>
          <span className="block">
            {[
              `Saved ${formatDate(document.createdAt)}`,
              document.status !== "READING" ? STATUS_CHIP[document.status] : null,
              document.importStatus === "LINK_ONLY" ? "Link only" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </p>
        {(document.collections.length > 0 || document.tags.length > 0) && (
          <div className="relative z-10 mt-[11px] flex flex-wrap gap-[7px] max-sm:hidden">
            {document.collections.map((collection) => (
              <Link key={collection.id} href={`/collections/${collection.id}`} className="chip">
                <span className="swatch" style={{ background: collectionVar(collection.color) }} aria-hidden />
                {collection.name}
              </Link>
            ))}
            {document.tags.map((tag) => (
              <Link key={tag} href={`/library?tag=${encodeURIComponent(tag)}`} className="chip" data-variant="tag">
                #{tag}
              </Link>
            ))}
          </div>
        )}
        {document.progress > 0 && <ReadingProgress progress={document.progress} className="mt-[11px]" />}
      </div>
      {!selectMode && (
        <div
          className={cn(
            "relative z-10 flex items-center gap-0.5 transition-opacity pointer-coarse:opacity-100",
            document.isFavorite ? "opacity-100" : "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100",
          )}
        >
          <Button
            variant="quiet"
            size="icon"
            aria-pressed={document.isFavorite}
            aria-label={document.isFavorite ? `Remove ${document.title} from favorites` : `Add ${document.title} to favorites`}
            onClick={() => handlers.onFavorite(document)}
            className="aria-[pressed=true]:border-transparent aria-[pressed=true]:bg-transparent aria-[pressed=true]:text-terracotta max-sm:hidden"
          >
            <Star className={cn(document.isFavorite && "fill-current")} />
          </Button>
          <DocumentMenu
            document={document}
            onRequest={(kind) => handlers.onRequest(document, kind)}
            onFavorite={() => handlers.onFavorite(document)}
            onArchive={() => handlers.onArchive(document)}
            onRestore={() => handlers.onRestore(document)}
          />
        </div>
      )}
    </li>
  );
}

export function DocumentCard({
  document,
  selected,
  selectMode,
  handlers,
}: {
  document: DocumentListItem;
  selected: boolean;
  selectMode: boolean;
  handlers: ItemHandlers;
}) {
  const length = lengthLabel(document);
  const progress = percent(document.progress);
  return (
    <li data-selected={selected || undefined} className="group/card relative flex flex-col gap-[13px]">
      <div className="relative">
        <Bookplate
          type={document.type}
          publication={document.publication}
          title={document.title}
          importStatus={document.importStatus}
          size="card"
          className="transition-colors group-hover/card:border-foreground/30 group-data-selected/card:border-terracotta group-data-selected/card:ring-2 group-data-selected/card:ring-terracotta/25"
        />
        <div
          className={cn(
            "absolute top-2.5 left-2.5 z-10 grid size-8 place-items-center rounded-sm bg-background/85 backdrop-blur-[6px] transition-opacity",
            selected || selectMode ? "opacity-100" : "opacity-0 group-focus-within/card:opacity-100 group-hover/card:opacity-100",
          )}
        >
          <Checkbox checked={selected} onCheckedChange={() => handlers.onToggleSelect(document.id)} aria-label={`Select ${document.title}`} />
        </div>
        <div
          className={cn(
            "absolute top-2.5 right-2.5 z-10 flex gap-1 transition-opacity pointer-coarse:opacity-100",
            document.isFavorite ? "opacity-100" : "opacity-0 group-focus-within/card:opacity-100 group-hover/card:opacity-100",
          )}
        >
          <Button
            variant="quiet"
            size="icon"
            aria-pressed={document.isFavorite}
            aria-label={document.isFavorite ? `Remove ${document.title} from favorites` : `Add ${document.title} to favorites`}
            onClick={() => handlers.onFavorite(document)}
            className="bg-background/85 backdrop-blur-[6px] aria-[pressed=true]:border-transparent aria-[pressed=true]:bg-background/85 aria-[pressed=true]:text-terracotta"
          >
            <Star className={cn(document.isFavorite && "fill-current")} />
          </Button>
          <div className="rounded-sm bg-background/85 backdrop-blur-[6px]">
            <DocumentMenu
              document={document}
              onRequest={(kind) => handlers.onRequest(document, kind)}
              onFavorite={() => handlers.onFavorite(document)}
              onArchive={() => handlers.onArchive(document)}
              onRestore={() => handlers.onRestore(document)}
            />
          </div>
        </div>
      </div>
      <div>
        <h3 className="font-serif text-[17px] leading-[1.3] font-medium tracking-[-0.01em] text-balance">
          <Link
            href={`/read/${document.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {document.title}
          </Link>
        </h3>
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">
          {[
            document.author ?? document.publication,
            length,
            progress > 0 && progress < 100 ? `${progress}% read` : null,
            document.status === "ARCHIVED" ? "Archived" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </li>
  );
}
