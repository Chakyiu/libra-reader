"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "cn";
import { ChevronLeft, ChevronRight, CircleAlert, Download, ListTree, LoaderCircle } from "lucide-react";
import type { Book, Location, NavItem, Rendition } from "epubjs";
import { usePositionSaver } from "@/components/reader/use-position-saver";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { isOverlayOpen, isTypingTarget } from "@/lib/shortcuts";
import type { ReaderDocument } from "@/lib/types";

function flatten(items: NavItem[], depth = 0): Array<NavItem & { depth: number }> {
  return items.flatMap((item) => [{ ...item, depth }, ...flatten(item.subitems ?? [], depth + 1)]);
}

const stripFragment = (href: string) => href.split("#")[0] ?? href;

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
 * Renders an EPUB with epub.js in paginated mode. Chapters load into iframes
 * sandboxed without allow-scripts, so scripts inside the book never run.
 */
export function EpubReader({ document, progressLineRef }: { document: ReaderDocument; progressLineRef: RefObject<HTMLDivElement | null> }) {
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
  const save = usePositionSaver(document.id);

  const prev = useCallback(() => void renditionRef.current?.prev(), []);
  const next = useCallback(() => void renditionRef.current?.next(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/files/${document.id}`);
        if (!response.ok) throw new Error("missing");
        const data = await response.arrayBuffer();
        const { default: ePub } = await import("epubjs");
        if (cancelled || !viewerRef.current) return;
        const book = ePub(data);
        bookRef.current = book;
        const rendition = book.renderTo(viewerRef.current, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "none",
          allowScriptedContent: false,
        });
        renditionRef.current = rendition;
        themeBook(rendition);

        const navigation = await book.loaded.navigation;
        if (!cancelled) setToc(flatten(navigation.toc));

        rendition.on("relocated", (location: Location) => {
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
        });
        rendition.on("keyup", (event: KeyboardEvent) => {
          if (event.key === "ArrowRight") void rendition.next();
          if (event.key === "ArrowLeft") void rendition.prev();
        });

        const saved = document.location?.kind === "epub" ? document.location.cfi : undefined;
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
    };
    // The reader is keyed to one document; later prop refreshes must not reopen the book.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

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

  return (
    <div className="grid xl:grid-cols-[var(--toc-width)_minmax(0,1fr)]">
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
          <span className="font-mono text-[11.5px] text-muted-foreground tabular-nums">
            {percentage !== null ? `${Math.round(percentage * 100)}%` : ""}
          </span>
        </div>

        <div className="relative mx-auto h-[calc(100dvh-56px-60px-64px)] min-h-[360px] w-full max-w-[760px] px-2 sm:px-6">
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
          Highlighting isn&apos;t available in EPUBs yet. Scripts inside the book never run. Use ← and → to turn pages.
        </p>
      </div>

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
