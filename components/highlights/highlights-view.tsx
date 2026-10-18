"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { GalleryVerticalEnd, Highlighter, Pencil, SlidersHorizontal, Trash } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { UrlSearchField } from "@/components/common/url-search-field";
import { HighlightCard } from "@/components/highlights/highlight-card";
import { applyAssistPrompt } from "@/lib/actions/assist";
import { ExplainPassage } from "@/components/reader/assist-panel";
import { AssistPromptMenu } from "@/components/reader/assist-prompt-menu";
import { NoteDialog, type NoteDraft } from "@/components/highlights/note-dialog";
import { ReviewDialog } from "@/components/highlights/review-dialog";
import { MobileMenuButton } from "@/components/shell/mobile-nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createHighlight, deleteHighlight, updateHighlight } from "@/lib/actions/highlights";
import { HIGHLIGHT_COLORS } from "@/lib/colors";
import type { AssistPromptItem, CollectionSummary, HighlightWithSource } from "@/lib/types";
import type { HighlightFilters } from "@/lib/validation";

export function HighlightsView({
  highlights,
  total,
  filters,
  sources,
  tags,
  collections,
  assistConfigured,
  prompts,
}: {
  highlights: HighlightWithSource[];
  total: number;
  filters: HighlightFilters;
  sources: Array<{ id: string; title: string }>;
  tags: string[];
  collections: CollectionSummary[];
  assistConfigured: boolean;
  prompts: AssistPromptItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<NoteDraft | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtered = Boolean(filters.q || filters.color || filters.document || filters.collection || filters.tag);

  const hrefWith = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const runPrompt = (highlightId: string, promptId: string) => {
    startTransition(async () => {
      const result = await applyAssistPrompt({ highlightId, promptId });
      if (!result.ok) toast.error(result.error);
      else toast("Note written");
    });
  };

  const replace = (key: string, value: string | undefined) => {
    setFiltersOpen(false);
    startTransition(() => router.replace(hrefWith(key, value), { scroll: false }));
  };

  const secondaryFilters = (prefix: string) => (
    <>
      <label className="sr-only" htmlFor={`${prefix}-source`}>
        Filter by source
      </label>
      <select id={`${prefix}-source`} className="select-native max-w-[220px]" value={filters.document ?? ""} onChange={(event) => replace("document", event.target.value || undefined)}>
        <option value="">Any source</option>
        {sources.map((source) => (
          <option key={source.id} value={source.id}>
            {source.title}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`${prefix}-collection`}>
        Filter by collection
      </label>
      <select
        id={`${prefix}-collection`}
        className="select-native max-w-[200px]"
        value={filters.collection ?? ""}
        onChange={(event) => replace("collection", event.target.value || undefined)}
      >
        <option value="">Any collection</option>
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}
          </option>
        ))}
      </select>
      {tags.map((tag) => (
        <Link
          key={tag}
          href={hrefWith("tag", filters.tag === tag ? undefined : tag)}
          onClick={() => setFiltersOpen(false)}
          className="chip"
          data-variant="tag"
          data-active={filters.tag === tag ? "true" : undefined}
          aria-current={filters.tag === tag ? "true" : undefined}
          replace
          scroll={false}
        >
          #{tag}
        </Link>
      ))}
    </>
  );

  const save = async (id: string, patch: { note: string; color: HighlightWithSource["color"] }) => {
    const result = await updateHighlight({ id, ...patch });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast(patch.note ? "Note saved" : "Highlight updated");
    return true;
  };

  const remove = (id: string) => {
    const highlight = highlights.find((h) => h.id === id);
    if (!highlight) return;
    startTransition(async () => {
      const result = await deleteHighlight(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast("Highlight removed", {
        action: {
          label: "Undo",
          onClick: () =>
            void createHighlight({
              documentId: highlight.documentId,
              quote: highlight.quote,
              prefix: highlight.prefix,
              suffix: highlight.suffix,
              context: highlight.context,
              startOffset: highlight.startOffset,
              endOffset: highlight.endOffset,
              page: highlight.page ?? undefined,
              color: highlight.color,
              note: highlight.note ?? undefined,
            }).then((restored) => (restored.ok ? toast("Highlight restored") : toast.error(restored.error))),
        },
      });
    });
  };

  return (
    <div className="mx-auto max-w-[1080px] px-[22px] pt-4 pb-24 sm:px-[26px] sm:pt-8 lg:px-[52px] lg:pt-11">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:items-baseline">
        <h1 className="font-serif text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[30px]">Highlights</h1>
        <span className="count">{filtered ? `${highlights.length} of ${total}` : total}</span>
        <span className="ml-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReviewOpen(true)}
            disabled={highlights.length === 0}
            aria-label="Review mode"
            className="max-sm:size-11 max-sm:border-transparent max-sm:bg-transparent max-sm:px-0 max-sm:text-muted-foreground"
          >
            <GalleryVerticalEnd className="max-sm:size-[18px]" />
            <span className="max-sm:sr-only">Review mode</span>
          </Button>
          <Button variant="quiet" size="icon" className="sm:hidden" aria-label="Filter highlights" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal />
          </Button>
          <MobileMenuButton />
        </span>
      </header>
      <p className="mt-2 max-w-[62ch] text-muted-foreground max-sm:hidden">
        Everything you&apos;ve marked, in one place. Each one keeps a way back to the paragraph it came from.
      </p>

      <div className="mt-4 mb-4 sm:mt-6">
        <UrlSearchField label="Search highlights" placeholder="Search passages, notes, sources…" />
      </div>

      <nav
        aria-label="Highlight filters"
        className="no-scrollbar -mx-[22px] flex items-center gap-2 overflow-x-auto border-b border-border px-[22px] pb-[18px] sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {HIGHLIGHT_COLORS.map((color) => (
          <Link
            key={color.value}
            href={hrefWith("color", filters.color === color.value ? undefined : color.value)}
            className="chip shrink-0"
            data-active={filters.color === color.value ? "true" : undefined}
            aria-current={filters.color === color.value ? "true" : undefined}
            replace
            scroll={false}
          >
            <span className="swatch" style={{ background: color.cssVar }} aria-hidden />
            {color.label}
          </Link>
        ))}
        <span aria-hidden className="mx-1 h-[18px] w-px bg-border max-sm:hidden" />
        <div className="contents max-sm:hidden">{secondaryFilters("hl-inline")}</div>
        {filtered && (
          <Button variant="ghost" size="sm" asChild className="ml-auto shrink-0">
            <Link href={pathname} replace scroll={false}>
              Reset
            </Link>
          </Button>
        )}
      </nav>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Filter highlights</SheetTitle>
          </SheetHeader>
          <SheetBody className="flex flex-wrap gap-2.5 pb-[max(2rem,env(safe-area-inset-bottom))] [&_select]:w-full [&_select]:max-w-none">
            {secondaryFilters("hl-sheet")}
          </SheetBody>
        </SheetContent>
      </Sheet>

      {highlights.length === 0 ? (
        <EmptyState
          icon={<Highlighter />}
          title={total === 0 ? "No highlights yet" : "No highlights match"}
          action={
            total === 0 ? (
              <Button variant="outline" asChild>
                <Link href="/library">Open the library</Link>
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link href={pathname}>Reset filters</Link>
              </Button>
            )
          }
        >
          {total === 0
            ? "Open an article or note, select a passage, and choose a colour. It will be waiting here."
            : "Loosen a filter, or open something from the library and mark a passage."}
        </EmptyState>
      ) : (
        <ul className="mt-6 grid gap-[18px]">
          {highlights.map((highlight) => (
            <li key={highlight.id}>
              <HighlightCard
                highlight={highlight}
                extra={
                  <>
                    <div className="mt-4">
                      <AssistPromptMenu
                        variant="field"
                        prompts={prompts}
                        onSelect={(promptId) => runPrompt(highlight.id, promptId)}
                      />
                    </div>
                    <ExplainPassage
                      key={`${highlight.id}:${highlight.explanation?.answer ?? ""}`}
                      documentId={highlight.document.id}
                      highlightId={highlight.id}
                      initial={highlight.explanation ?? null}
                      configured={assistConfigured}
                    />
                  </>
                }
                actions={
                  <>
                    <Button
                      variant="quiet"
                      size="icon-sm"
                      aria-label="Edit note and colour"
                      onClick={() => setEditing({ id: highlight.id, quote: highlight.quote, note: highlight.note, color: highlight.color })}
                    >
                      <Pencil />
                    </Button>
                    <Button variant="quiet" size="icon-sm" aria-label="Delete highlight" onClick={() => remove(highlight.id)}>
                      <Trash />
                    </Button>
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        highlights={highlights}
        onEditNote={(highlight) => setEditing({ id: highlight.id, quote: highlight.quote, note: highlight.note, color: highlight.color })}
      />
      <NoteDialog highlight={editing} prompts={prompts} onOpenChange={(open) => !open && setEditing(null)} onSave={save} onDelete={remove} />
    </div>
  );
}
