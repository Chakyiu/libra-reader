"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, LayoutGrid, List, ListChecks, Plus, SlidersHorizontal, X } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { UrlSearchField } from "@/components/common/url-search-field";
import { DocumentList } from "@/components/library/document-list";
import { useAddContent } from "@/components/shell/add-content-context";
import { MobileMenuButton } from "@/components/shell/mobile-nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { collectionVar } from "@/lib/colors";
import { plural } from "@/lib/format";
import { libraryHref } from "@/lib/library-href";
import type { CollectionSummary, DocumentListItem } from "@/lib/types";
import { LIBRARY_SORTS, type LibraryFilters } from "@/lib/validation";

const STATUS_TITLE: Record<LibraryFilters["status"], string> = {
  all: "Library",
  inbox: "Inbox",
  reading: "Reading",
  archived: "Archived",
  favorites: "Favorites",
};

const STATUS_CHIPS: Array<[LibraryFilters["status"], string]> = [
  ["all", "All"],
  ["inbox", "Inbox"],
  ["reading", "Reading"],
  ["archived", "Archived"],
  ["favorites", "Favorites"],
];

const TYPE_CHIPS: Array<[LibraryFilters["type"], string]> = [
  ["all", "All types"],
  ["article", "Articles"],
  ["pdf", "PDFs"],
  ["epub", "EPUBs"],
  ["note", "Notes"],
];

const SORT_LABEL: Record<(typeof LIBRARY_SORTS)[number], string> = {
  saved: "Date saved",
  opened: "Recently opened",
  title: "Title",
  progress: "Reading progress",
};

export function LibraryView({
  filters,
  documents,
  collections,
  tags,
  libraryIsEmpty,
}: {
  filters: LibraryFilters;
  documents: DocumentListItem[];
  collections: CollectionSummary[];
  tags: string[];
  libraryIsEmpty: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { openAddContent } = useAddContent();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const collection = filters.collection ? collections.find((c) => c.id === filters.collection) : undefined;
  const title = collection?.name ?? (filters.tag && filters.status === "all" ? `#${filters.tag}` : STATUS_TITLE[filters.status]);
  const filtered =
    filters.status !== "all" || filters.type !== "all" || Boolean(filters.tag) || Boolean(filters.collection) || Boolean(filters.q);

  const navigate = (overrides: Partial<Record<keyof LibraryFilters, string | undefined>>) =>
    startTransition(() => router.replace(libraryHref(filters, overrides), { scroll: false }));

  return (
    <div className="mx-auto max-w-[1080px] px-[22px] pt-4 pb-24 sm:px-[26px] sm:pt-8 lg:px-[52px] lg:pt-11">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:items-baseline">
        <h1 className="font-serif text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[30px]">{title}</h1>
        <span className="count max-sm:hidden">{plural(documents.length, "document")}</span>
        <span className="ml-auto flex items-center sm:hidden">
          <Button variant="quiet" size="icon" aria-label="Filter, sort and select" onClick={() => setSheetOpen(true)}>
            <SlidersHorizontal />
          </Button>
          <MobileMenuButton />
        </span>
        <span className="ml-auto max-sm:hidden lg:hidden">
          <MobileMenuButton />
        </span>
      </header>

      <div className="mt-4 mb-4 flex flex-wrap items-center gap-2.5 sm:mt-6">
        <UrlSearchField label="Search within library" placeholder="Search titles, authors, tags…" className="min-w-[230px] flex-1" />
        <label className="sr-only" htmlFor="library-sort">
          Sort by
        </label>
        <select
          id="library-sort"
          className="select-native h-[42px] max-sm:hidden"
          value={filters.sort}
          onChange={(event) => navigate({ sort: event.target.value })}
        >
          {LIBRARY_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {SORT_LABEL[sort]}
            </option>
          ))}
        </select>
        <div role="group" aria-label="Layout" className="flex overflow-hidden rounded-sm border border-border bg-background max-sm:hidden">
          <button
            type="button"
            aria-pressed={filters.view === "list"}
            aria-label="List view"
            onClick={() => navigate({ view: "list" })}
            className="grid size-10 place-items-center text-muted-foreground aria-pressed:bg-well aria-pressed:text-foreground"
          >
            <List className="size-[15px]" />
          </button>
          <button
            type="button"
            aria-pressed={filters.view === "grid"}
            aria-label="Grid view"
            onClick={() => navigate({ view: "grid" })}
            className="grid size-10 place-items-center border-l border-border text-muted-foreground aria-pressed:bg-well aria-pressed:text-foreground"
          >
            <LayoutGrid className="size-[15px]" />
          </button>
        </div>
        {documents.length > 0 && (
          <Button variant="outline" size="sm" aria-pressed={selectMode} onClick={() => setSelectMode(!selectMode)} className="h-[42px] max-sm:hidden">
            <ListChecks />
            Select
          </Button>
        )}
      </div>

      <nav
        aria-label="Filters"
        className="no-scrollbar -mx-[22px] flex items-center gap-2 overflow-x-auto border-b border-border px-[22px] pb-[18px] sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {collection && (
          <Link
            href={libraryHref(filters, { collection: undefined })}
            className="chip shrink-0"
            data-active="true"
            aria-label={`Remove the ${collection.name} filter`}
            replace
            scroll={false}
          >
            <span className="swatch" style={{ background: collectionVar(collection.color) }} aria-hidden />
            {collection.name}
            <X className="size-3.5" aria-hidden />
          </Link>
        )}
        {filters.tag && (
          <Link
            href={libraryHref(filters, { tag: undefined })}
            className="chip shrink-0"
            data-active="true"
            aria-label={`Remove the #${filters.tag} filter`}
            replace
            scroll={false}
          >
            #{filters.tag}
            <X className="size-3.5" aria-hidden />
          </Link>
        )}
        {(filters.tag || collection) && <span aria-hidden className="mx-1 h-[18px] w-px shrink-0 bg-border" />}
        {STATUS_CHIPS.map(([value, label]) => (
          <Link
            key={value}
            href={libraryHref(filters, { status: value, collection: undefined })}
            className="chip shrink-0"
            data-active={filters.status === value && !filters.collection ? "true" : undefined}
            aria-current={filters.status === value && !filters.collection ? "true" : undefined}
            replace
            scroll={false}
          >
            {label}
          </Link>
        ))}
        <span aria-hidden className="mx-1 h-[18px] w-px shrink-0 bg-border max-sm:hidden" />
        {TYPE_CHIPS.map(([value, label]) => (
          <Link
            key={value}
            href={libraryHref(filters, { type: value })}
            className="chip shrink-0 max-sm:hidden"
            data-active={filters.type === value ? "true" : undefined}
            aria-current={filters.type === value ? "true" : undefined}
            replace
            scroll={false}
          >
            {label}
          </Link>
        ))}
        {filtered && (
          <Button variant="ghost" size="sm" asChild className="ml-auto shrink-0 max-sm:hidden">
            <Link href={libraryHref({ sort: filters.sort, view: filters.view })} replace scroll={false}>
              Reset filters
            </Link>
          </Button>
        )}
      </nav>
      <p className="caps mt-4 sm:hidden">{plural(documents.length, "document")}</p>

      {documents.length === 0 ? (
        libraryIsEmpty ? (
          <EmptyState
            title="Your library is empty"
            action={
              <Button onClick={() => openAddContent()}>
                <Plus />
                Add your first thing
              </Button>
            }
          >
            Save an article, drop in a PDF, or write a note. Everything you keep lands in the inbox first.
          </EmptyState>
        ) : (
          <EmptyState
            title={filters.q ? `Nothing matches “${filters.q}”` : "Nothing matches these filters"}
            action={
              <Button variant="outline" asChild>
                <Link href={libraryHref({ sort: filters.sort, view: filters.view })}>Reset filters</Link>
              </Button>
            }
          >
            {filters.status === "archived"
              ? "Nothing archived yet. Finished pieces land here when you archive them."
              : "Try a different status or type, or reset the filters and start again."}
          </EmptyState>
        )
      ) : (
        <DocumentList
          documents={documents}
          collections={collections}
          allTags={tags}
          layout={filters.view}
          selectMode={selectMode}
          onSelectModeChange={setSelectMode}
          hideSelectButton
        />
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>View</SheetTitle>
          </SheetHeader>
          <SheetBody className="grid gap-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <section>
              <h3 className="caps mb-2.5">Type</h3>
              <div className="flex flex-wrap gap-2">
                {TYPE_CHIPS.map(([value, label]) => (
                  <Link
                    key={value}
                    href={libraryHref(filters, { type: value })}
                    className="chip"
                    data-active={filters.type === value ? "true" : undefined}
                    aria-current={filters.type === value ? "true" : undefined}
                    onClick={() => setSheetOpen(false)}
                    replace
                    scroll={false}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </section>
            <section>
              <h3 className="caps mb-1">Sort by</h3>
              <div role="radiogroup" aria-label="Sort by">
                {LIBRARY_SORTS.map((sort) => (
                  <button
                    key={sort}
                    type="button"
                    role="radio"
                    aria-checked={filters.sort === sort}
                    onClick={() => {
                      navigate({ sort });
                      setSheetOpen(false);
                    }}
                    className="flex min-h-12 w-full items-center justify-between border-b border-border text-left text-[14.5px]"
                  >
                    {SORT_LABEL[sort]}
                    {filters.sort === sort && <Check className="size-[18px] text-terracotta" aria-hidden />}
                  </button>
                ))}
              </div>
            </section>
            <section className="flex flex-wrap gap-2.5">
              <Button
                variant="outline"
                className="flex-1"
                aria-pressed={filters.view === "grid"}
                onClick={() => {
                  navigate({ view: filters.view === "grid" ? "list" : "grid" });
                  setSheetOpen(false);
                }}
              >
                {filters.view === "grid" ? <List /> : <LayoutGrid />}
                {filters.view === "grid" ? "Show as list" : "Show as grid"}
              </Button>
              {documents.length > 0 && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectMode(true);
                    setSheetOpen(false);
                  }}
                >
                  <ListChecks />
                  Select several
                </Button>
              )}
            </section>
            {filtered && (
              <Button variant="ghost" asChild>
                <Link href={libraryHref({ sort: filters.sort, view: filters.view })} onClick={() => setSheetOpen(false)} replace scroll={false}>
                  Reset filters
                </Link>
              </Button>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}
