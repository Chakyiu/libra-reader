"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { cn } from "cn";
import { ChevronLeft, ChevronRight, CircleAlert, Download, ListTree, LoaderCircle } from "lucide-react";
import type { Book, Location, NavItem, Rendition } from "epubjs";
import { NoteDialog } from "@/components/highlights/note-dialog";
import { AnnotationsAside, AnnotationsPanelBody, AnnotationsSheet } from "@/components/reader/annotations-column";
import { PageModeToggle, usePageMode } from "@/components/reader/page-mode";
import { SelectionToolbar, type SelectionRect } from "@/components/reader/selection-toolbar";
import { toDraft, useHighlightMutations } from "@/components/reader/use-highlight-mutations";
import { usePositionSaver } from "@/components/reader/use-position-saver";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { rangeToOffsets } from "@/lib/anchoring/dom-anchor";
import { describeTextRange, surroundingSentence } from "@/lib/anchoring/text-anchor";
import { isOverlayOpen, isTypingTarget } from "@/lib/shortcuts";
import type { AssistPromptItem, DocumentAssist, HighlightItem, ReaderDocument } from "@/lib/types";
import type { HighlightColor } from "@/lib/generated/prisma/enums";

function flatten(items: NavItem[], depth = 0): Array<NavItem & { depth: number }> {
  return items.flatMap((item) => [{ ...item, depth }, ...flatten(item.subitems ?? [], depth + 1)]);
}

const stripFragment = (href: string) => href.split("#")[0] ?? href;

/** Class on the <g> epub.js draws for one highlight, so the stylesheet can colour it. */
const MARK_CLASS = "libra-hl";

/** The slice of an epub.js Contents this reader needs, without the library's loose types. */
interface ChapterContents {
  document: Document;
  window: Window;
  range: (cfi: string) => Range | null;
}

/** Where a highlight sits in the spine: "…/6/14[chapter]…" → 7. */
function sectionOf(cfi: string): number {
  const step = /\/6\/(\d+)/.exec(cfi)?.[1];
  return step ? Number(step) / 2 - 1 : -1;
}

function contentsOf(rendition: Rendition): ChapterContents | null {
  const current = rendition.getContents() as unknown as ChapterContents | ChapterContents[] | undefined;
  if (Array.isArray(current)) return current[0] ?? null;
  return current ?? null;
}


/** A CFI that no longer resolves gives null or a throw — both mean the passage moved. */
function safeRange(contents: ChapterContents, cfi: string): Range | null {
  try {
    return contents.range(cfi);
  } catch {
    return null;
  }
}

/** Colours come from the app's tokens so chapters follow light and dark themes. */
function themeBook(rendition: Rendition) {
  const css = getComputedStyle(window.document.documentElement);
  const ink = css.getPropertyValue("--ink").trim();
  const paper = css.getPropertyValue("--paper").trim();
  const accent = css.getPropertyValue("--terracotta").trim();
  const dark = css.colorScheme === "dark" || window.document.documentElement.dataset.theme === "dark";
  rendition.themes.default({
    // Without a matching color-scheme the browser paints an opaque white backdrop behind the chapter frame.
    html: { "color-scheme": dark ? "dark" : "light", background: `${paper} !important`, "-webkit-text-size-adjust": "100%" },
    body: {
      color: `${ink} !important`,
      background: "transparent !important",
      "line-height": "1.65",
      "font-family": '"Newsreader Variable", "Iowan Old Style", "Source Serif 4", Georgia, serif',
    },
    a: { color: `${accent} !important` },
    img: { "max-width": "100% !important", height: "auto !important" },
    ...(dark ? { "body *": { color: "inherit !important", "background-color": "transparent !important" } } : {}),
  });
}

/**
 * Renders an EPUB with epub.js. Chapters load into iframes sandboxed without
 * allow-scripts, so scripts inside the book never run. Highlights are the one
 * thing the reader draws itself: epub.js keeps each one as a CFI and paints it
 * as an SVG shape over the chapter, in this document rather than the frame.
 */
export function EpubReader({
  document,
  highlights,
  prompts,
  focusHighlightId,
  progressLineRef,
  panelOpen,
  annotationsOpen,
  onAnnotationsOpenChange,
  assist,
  assistConfigured,
  onAddTag,
}: {
  document: ReaderDocument;
  highlights: HighlightItem[];
  prompts: AssistPromptItem[];
  focusHighlightId?: string;
  progressLineRef: RefObject<HTMLDivElement | null>;
  panelOpen: boolean;
  annotationsOpen: boolean;
  onAnnotationsOpenChange: (open: boolean) => void;
  assist: DocumentAssist;
  assistConfigured: boolean;
  onAddTag: () => void;
}) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);
  const [toc, setToc] = useState<Array<NavItem & { depth: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [href, setHref] = useState<string | null>(null);
  const [percentage, setPercentage] = useState<number | null>(document.progress || null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [mode, setMode] = usePageMode();
  const { optimistic, create, update, remove, copy, editing, setEditing } = useHighlightMutations(document.id, highlights);
  const [selection, setSelection] = useState<
    | { cfi: string; quote: string; prefix: string; suffix: string; context: string; start: number; end: number; rect: SelectionRect }
    | null
  >(null);
  const [orphanIds, setOrphanIds] = useState<Set<string>>(new Set());
  const save = usePositionSaver(document.id);
  const cfiRef = useRef<string | undefined>(document.location?.kind === "epub" ? document.location.cfi : undefined);
  /** highlight id → the mark currently drawn for it, so re-renders don't stack. */
  const drawnRef = useRef(new Map<string, { cfi: string; color: HighlightColor; hasNote: boolean }>());
  const highlightsRef = useRef(optimistic);
  const contentsRef = useRef<ChapterContents | null>(null);

  const prev = useCallback(() => void renditionRef.current?.prev(), []);
  const next = useCallback(() => void renditionRef.current?.next(), []);
  const changeMode = (nextMode: typeof mode) => {
    if (nextMode === mode) return;
    setReady(false);
    drawnRef.current.clear();
    setMode(nextMode);
  };

  useEffect(() => {
    highlightsRef.current = optimistic;
  }, [optimistic]);

  const selectionRef = useRef(selection);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  /**
   * Save the passage the reader last saw selected. The book's handlers are bound
   * once, so this reads the selection through a ref rather than the render it
   * was written in.
   */
  const highlightSelection = useCallback(
    (color: HighlightColor, withNote: boolean, promptId?: string) => {
      const selected = selectionRef.current;
      if (!selected) return;
      void create(
        {
          quote: selected.quote,
          prefix: selected.prefix,
          suffix: selected.suffix,
          context: selected.context,
          startOffset: selected.start,
          endOffset: selected.end,
          cfi: selected.cfi,
        },
        color,
        withNote,
        promptId,
      );
      contentsRef.current?.window.getSelection()?.removeAllRanges();
      setSelection(null);
    },
    [create],
  );

  /** Draw every stored highlight the book knows about, and drop the stale ones. */
  const syncMarks = useCallback(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    const wanted = highlightsRef.current.filter((item) => item.cfi);
    const byId = new Map(wanted.map((item) => [item.id, item]));

    for (const [id, mark] of Array.from(drawnRef.current)) {
      const item = byId.get(id);
      if (item && item.cfi === mark.cfi && item.color === mark.color && Boolean(item.note) === mark.hasNote) continue;
      try {
        rendition.annotations.remove(mark.cfi, "highlight");
      } catch {
        /* already gone with the chapter it lived in */
      }
      drawnRef.current.delete(id);
    }

    const contents = contentsOf(rendition);
    const chapter = cfiRef.current ? sectionOf(cfiRef.current) : -1;
    const missed: string[] = [];
    for (const item of wanted) {
      if (drawnRef.current.has(item.id)) continue;
      const cfi = item.cfi as string;
      // A passage in the open chapter can be checked now; one further along is
      // left to epub.js, which draws it when the reader gets there.
      if (contents && chapter >= 0 && sectionOf(cfi) === chapter) {
        const range = safeRange(contents, cfi);
        if (!range || range.toString().trim() === "") {
          missed.push(item.id);
          continue;
        }
      }
      try {
        rendition.annotations.highlight(
          cfi,
          { hlId: item.id, color: item.color, hasNote: item.note ? "true" : "false" },
          undefined,
          MARK_CLASS,
        );
        drawnRef.current.set(item.id, { cfi, color: item.color, hasNote: Boolean(item.note) });
      } catch {
        missed.push(item.id);
      }
    }
    setOrphanIds((current) => {
      const nextIds = new Set<string>();
      // Orphans found in a chapter that has since closed stay listed; a passage
      // that resolves again drops out.
      for (const id of current) {
        const item = byId.get(id);
        if (item?.cfi && sectionOf(item.cfi) !== chapter) nextIds.add(id);
      }
      for (const id of missed) nextIds.add(id);
      return nextIds;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const drawn = drawnRef.current;
    (async () => {
      try {
        const response = await fetch(`/api/files/${document.id}`);
        if (!response.ok) throw new Error("missing");
        const data = await response.arrayBuffer();
        const { default: ePub } = await import("epubjs");
        if (cancelled || !viewerRef.current) return;
        viewerRef.current.replaceChildren();
        const book = ePub(data);
        bookRef.current = book;
        const rendition = book.renderTo(viewerRef.current, {
          width: "100%",
          height: "100%",
          flow: mode === "scroll" ? "scrolled" : "paginated",
          manager: mode === "scroll" ? "continuous" : "default",
          spread: "none",
          allowScriptedContent: false,
        });
        renditionRef.current = rendition;
        themeBook(rendition);

        const navigation = await book.loaded.navigation;
        if (!cancelled) setToc(flatten(navigation.toc));

        rendition.on("relocated", (location: Location) => {
          cfiRef.current = location.start.cfi;
          setHref(location.start.href);
          setAtStart(location.atStart);
          setAtEnd(location.atEnd);
          const spineLength = book.spine ? (book.spine as unknown as { length: number }).length : 0;
          const fromLocations = book.locations.length() > 0 ? book.locations.percentageFromCfi(location.start.cfi) : null;
          const fromSpine = spineLength > 0 ? (location.start.index + 1) / spineLength : 0;
          const progress = location.atEnd ? 1 : (fromLocations ?? fromSpine);
          setPercentage(progress);
          if (progressLineRef.current) progressLineRef.current.style.width = `${Math.round(progress * 1000) / 10}%`;
          save({ progress, location: { kind: "epub", cfi: location.start.cfi } });
          syncMarks();
        });
        rendition.on("rendered", () => syncMarks());
        rendition.on("keyup", (event: KeyboardEvent) => {
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          if (event.key === "ArrowRight") void rendition.next();
          if (event.key === "ArrowLeft") void rendition.prev();
          if (event.key === "Escape") setSelection(null);
          if (event.key.toLowerCase() === "h") highlightSelection("YELLOW", false);
          if (event.key.toLowerCase() === "n") highlightSelection("YELLOW", true);
        });
        // A click in the chapter collapses the selection, so drop the toolbar too.
        rendition.on("click", (_event: Event, contents: unknown) => {
          const chapter = (contents as ChapterContents | undefined) ?? contentsRef.current;
          const selected = chapter?.window.getSelection();
          if (!selected || selected.rangeCount === 0 || selected.isCollapsed) setSelection(null);
        });
        // A mark is the only clickable thing the reader draws, so it opens that note.
        rendition.on("markClicked", (cfiRange: string, data: { hlId?: string }) => {
          const item = highlightsRef.current.find((highlight) => highlight.id === data?.hlId || highlight.cfi === cfiRange);
          if (item) setEditing(toDraft(item));
        });
        // epub.js watches the chapter's own selection and reports it as a CFI.
        rendition.on("selected", (cfiRange: string, contents: unknown) => {
          const chapter = contents as ChapterContents;
          if (!cfiRange || !chapter?.document) return;
          contentsRef.current = chapter;
          const range = safeRange(chapter, cfiRange) ?? chapter.window.getSelection()?.getRangeAt(0) ?? null;
          const offsets = range ? rangeToOffsets(chapter.document.body, range) : null;
          if (!range || !offsets) {
            setSelection(null);
            return;
          }
          const text = chapter.document.body.textContent ?? "";
          const selector = describeTextRange(text, offsets.start, offsets.end);
          if (selector.exact.length < 2) {
            setSelection(null);
            return;
          }
          const box = range.getBoundingClientRect();
          const frame = chapter.window.frameElement?.getBoundingClientRect();
          setSelection({
            cfi: cfiRange,
            quote: selector.exact.replace(/\s+/g, " ").trim(),
            prefix: selector.prefix,
            suffix: selector.suffix,
            context: surroundingSentence(text, selector.start, selector.end),
            start: selector.start,
            end: selector.end,
            rect: {
              top: (frame?.top ?? 0) + box.top,
              bottom: (frame?.bottom ?? 0) + box.bottom,
              left: (frame?.left ?? 0) + box.left,
              width: box.width,
            },
          });
        });

        const saved = cfiRef.current;
        try {
          await rendition.display(saved);
        } catch {
          await rendition.display();
        }
        if (cancelled) return;
        setReady(true);
        void book.ready.then(() => book.locations.generate(1200)).catch(() => undefined);
      } catch {
        if (!cancelled) setError("This book couldn't be opened. The file may be damaged, DRM-protected, or missing from storage.");
      }
    })();
    return () => {
      cancelled = true;
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current = null;
      drawn.clear();
      contentsRef.current = null;
    };
    // Reopen only when the book or the page movement changes. The saved place lives in cfiRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id, mode]);

  // The list changes without a page turn, so repaint when it does.
  useEffect(() => {
    if (ready) syncMarks();
  }, [optimistic, ready, syncMarks]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const rendition = renditionRef.current;
      if (rendition) {
        themeBook(rendition);
        const location = rendition.currentLocation() as unknown as Location | undefined;
        if (location?.start?.cfi) void rendition.display(location.start.cfi);
      }
    });
    observer.observe(window.document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  /** Go to a highlight and flash its mark once the chapter has drawn it. */
  const jumpTo = useCallback(
    (id: string) => {
      const item = highlightsRef.current.find((highlight) => highlight.id === id);
      if (!item?.cfi) return;
      onAnnotationsOpenChange(false);
      void renditionRef.current?.display(item.cfi);
      let attempts = 0;
      const seek = () => {
        const mark = window.document.querySelector<SVGGElement>(`g.${MARK_CLASS}[data-hl-id="${CSS.escape(id)}"]`);
        if (mark) {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          mark.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
          mark.classList.remove("hl-flash");
          void mark.getBoundingClientRect();
          mark.classList.add("hl-flash");
          return;
        }
        if (++attempts < 90) requestAnimationFrame(seek);
      };
      requestAnimationFrame(seek);
    },
    [onAnnotationsOpenChange],
  );

  // Arriving from the Highlights page: land on the passage, not the last place saved.
  const focused = useRef(false);
  useEffect(() => {
    if (!focusHighlightId || !ready || focused.current) return;
    focused.current = true;
    jumpTo(focusHighlightId);
  }, [focusHighlightId, jumpTo, ready]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (isOverlayOpen()) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, prev]);

  const current = href ? toc.find((item) => stripFragment(item.href).endsWith(stripFragment(href)) || stripFragment(href).endsWith(stripFragment(item.href))) : undefined;

  // Book order: chapter first, then position within the chapter.
  const sorted = useMemo(
    () =>
      [...optimistic].sort(
        (a, b) => sectionOf(a.cfi ?? "") - sectionOf(b.cfi ?? "") || a.startOffset - b.startOffset,
      ),
    [optimistic],
  );

  const chapterList = (
    <ol className="grid">
      {toc.map((item) => (
        <li key={`${item.id}-${item.href}`}>
          <button
            type="button"
            onClick={() => {
              void renditionRef.current?.display(item.href);
              setChaptersOpen(false);
            }}
            aria-current={current?.href === item.href ? "location" : undefined}
            className={cn(
              "block w-full border-l-2 border-border py-2.5 pr-2 text-left text-[13px] leading-snug text-muted-foreground hover:text-foreground aria-[current=location]:border-terracotta aria-[current=location]:font-medium aria-[current=location]:text-terracotta-text",
            )}
            style={{ paddingLeft: 16 + item.depth * 12 }}
          >
            {item.label.trim()}
          </button>
        </li>
      ))}
    </ol>
  );

  if (error) {
    return (
      <div className="mx-auto max-w-[560px] px-[22px] pt-12">
        <div className="state-box" data-tone="error" role="alert">
          <CircleAlert className="mt-px size-[18px] shrink-0 text-err" aria-hidden />
          <div>
            <p className="mb-1 text-[13.5px] font-semibold">Couldn&apos;t open this book</p>
            <p className="text-[13px] text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" asChild className="mt-3.5">
              <a href={`/api/files/${document.id}?download=1`} download>
                <Download />
                Download the original
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const panel = (
    <AnnotationsPanelBody
      document={document}
      highlights={sorted}
      orphanIds={orphanIds}
      onJump={jumpTo}
      onEdit={(id) => {
        const item = optimistic.find((highlight) => highlight.id === id);
        if (item) setEditing(toDraft(item));
      }}
      onAddTag={onAddTag}
      assist={assist}
      assistConfigured={assistConfigured}
    />
  );

  return (
    <div className={cn("grid xl:grid-cols-[var(--toc-width)_minmax(0,1fr)]", panelOpen && "xl:grid-cols-[var(--toc-width)_minmax(0,1fr)_var(--panel-width)]")}>
      <nav aria-label="Chapters" className="sticky top-14 hidden max-h-[calc(100dvh-56px)] self-start overflow-y-auto px-6 pt-[30px] pb-16 xl:block">
        <h2 className="caps mb-3.5">Chapters</h2>
        {toc.length ? chapterList : <p className="text-[13px] text-muted-foreground">This book has no table of contents.</p>}
      </nav>

      <div className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 sm:px-6">
          <Button variant="quiet" size="sm" className="xl:hidden" onClick={() => setChaptersOpen(true)} disabled={!toc.length}>
            <ListTree />
            Chapters
          </Button>
          <div className="min-w-0 flex-1 max-xl:text-right xl:text-left">
            <h1 className="truncate font-serif text-[15px] leading-snug font-semibold tracking-[-0.01em]">{document.title}</h1>
            <p className="truncate text-[12px] text-muted-foreground">{current?.label.trim() ?? (ready ? (document.author ?? "") : "Opening…")}</p>
          </div>
          <span className="shrink-0">
            <PageModeToggle mode={mode} onChange={changeMode} />
          </span>
          <span className="font-mono text-[11.5px] text-muted-foreground tabular-nums">
            {percentage !== null ? `${Math.round(percentage * 100)}%` : ""}
          </span>
        </div>

        <div
          className={cn(
            "relative mx-auto h-[calc(100dvh-56px-60px-64px)] min-h-[360px] w-full max-w-[760px] px-2 sm:px-6",
            mode === "scroll" && "overflow-y-auto",
          )}
        >
          <div ref={viewerRef} className="h-full w-full" aria-label={`${document.title}, book text`} />
          {!ready && (
            <div className="absolute inset-0 grid place-items-center text-[13px] text-muted-foreground" role="status">
              <span className="flex items-center gap-2.5">
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                Opening the book…
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 px-4 py-3">
          <Button variant="outline" size="sm" onClick={prev} disabled={!ready || atStart}>
            <ChevronLeft />
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={next} disabled={!ready || atEnd}>
            Next
            <ChevronRight />
          </Button>
        </div>
        <p className="mx-auto mb-10 max-w-[62ch] px-6 text-center text-[12.5px] leading-relaxed text-muted-foreground">
          {mode === "scroll"
            ? "Scroll to move through the book. Select any passage to highlight it; scripts inside the book never run."
            : "Select any passage to highlight it. Scripts inside the book never run. Use ← and → to turn pages."}
        </p>
      </div>

      {panelOpen && <AnnotationsAside body={panel} />}

      <AnnotationsSheet open={annotationsOpen} onOpenChange={onAnnotationsOpenChange} count={optimistic.length} body={panel} />

      {selection && !editing && (
        <SelectionToolbar
          rect={selection.rect}
          prompts={prompts}
          onHighlight={(color) => highlightSelection(color, false)}
          onNote={() => highlightSelection("YELLOW", true)}
          onPrompt={(promptId) => highlightSelection("YELLOW", false, promptId)}
          onCopy={() => {
            void copy(selection.quote);
            contentsRef.current?.window.getSelection()?.removeAllRanges();
            setSelection(null);
          }}
        />
      )}
      <NoteDialog
        highlight={editing}
        prompts={prompts}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={(id, patch) => update(id, patch)}
        onDelete={remove}
      />

      <Sheet open={chaptersOpen} onOpenChange={setChaptersOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Chapters</SheetTitle>
          </SheetHeader>
          <SheetBody>{chapterList}</SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}
