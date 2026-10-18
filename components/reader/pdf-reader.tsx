"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, Download, LoaderCircle, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { NoteDialog } from "@/components/highlights/note-dialog";
import { AnnotationsAside, AnnotationsPanelBody, AnnotationsSheet } from "@/components/reader/annotations-column";
import { PageModeToggle, usePageMode } from "@/components/reader/page-mode";
import { SelectionToolbar, type SelectionRect } from "@/components/reader/selection-toolbar";
import { toDraft, useHighlightMutations } from "@/components/reader/use-highlight-mutations";
import { usePositionSaver } from "@/components/reader/use-position-saver";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { recordFileMetadata } from "@/lib/actions/documents";
import { rangeToOffsets, unwrapHighlights, wrapOffsets } from "@/lib/anchoring/dom-anchor";
import { anchorSelector, describeTextRange, surroundingSentence } from "@/lib/anchoring/text-anchor";
import { isOverlayOpen, isTypingTarget } from "@/lib/shortcuts";
import type { AssistPromptItem, DocumentAssist, HighlightItem, ReaderDocument } from "@/lib/types";
import type { HighlightColor } from "@/lib/generated/prisma/enums";

const ASSETS = "/vendor/pdfjs";
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

/**
 * Paints saved highlights into one page's text layer. Offsets are counted the
 * same way as everywhere else — over the layer's text, in order — and fall back
 * to the stored quote when the layer reflows. Ids that no longer match are
 * reported so the annotation list can call them out.
 */
function paintHighlights(root: HTMLElement, highlights: HighlightItem[]): string[] {
  unwrapHighlights(root);
  const text = root.textContent ?? "";
  const missed: string[] = [];
  for (const highlight of highlights) {
    const match = anchorSelector(text, {
      exact: highlight.quote,
      prefix: highlight.prefix,
      suffix: highlight.suffix,
      start: highlight.startOffset,
      end: highlight.endOffset,
    });
    if (!match) {
      missed.push(highlight.id);
      continue;
    }
    const label = `Highlight${highlight.note ? " with note" : ""}: ${highlight.quote.slice(0, 80)}`;
    wrapOffsets(root, match.start, match.end, {
      id: highlight.id,
      color: highlight.color,
      hasNote: Boolean(highlight.note),
      label,
    });
  }
  return missed;
}

function PdfPage({
  pdf,
  pageNumber,
  total,
  title,
  zoom,
  width,
  highlights,
  scrollRoot,
  reportScale,
  onScale,
  onOrphans,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  total: number;
  title: string;
  zoom: number;
  width: number;
  highlights: HighlightItem[];
  scrollRoot: RefObject<HTMLElement | null> | null;
  reportScale: boolean;
  onScale: (scale: number) => void;
  onOrphans: (pageNumber: number, ids: string[]) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const reportScaleRef = useRef(false);
  const effectiveRef = useRef(1);
  const [near, setNear] = useState(scrollRoot === null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [textReady, setTextReady] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !scrollRoot) return;
    const observer = new IntersectionObserver(([entry]) => entry && setNear(entry.isIntersecting), {
      root: scrollRoot.current,
      rootMargin: "900px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    reportScaleRef.current = reportScale;
    if (reportScale) onScale(effectiveRef.current);
  }, [onScale, reportScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const textHost = textRef.current;
    const pageEl = boxRef.current;
    if (!near || !canvas || !textHost || !pageEl || width === 0) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let textLayer: { cancel: () => void } | null = null;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      const pdfPage = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const natural = pdfPage.getViewport({ scale: 1 });
      const effective = zoom === 0 ? Math.max(0.3, Math.min(3, width / natural.width)) : zoom;
      effectiveRef.current = effective;
      if (reportScaleRef.current) onScale(effective);
      const viewport = pdfPage.getViewport({ scale: effective });
      pageEl.style.setProperty("--scale-factor", String(effective));
      const cssWidth = Math.floor(viewport.width);
      const cssHeight = Math.floor(viewport.height);
      setBox({ width: cssWidth, height: cssHeight });
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      renderTask = pdfPage.render({ canvas, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
      textHost.replaceChildren();
      const layer = new pdfjs.TextLayer({ textContentSource: pdfPage.streamTextContent(), container: textHost, viewport });
      textLayer = layer;
      await Promise.all([renderTask.promise, layer.render()]);
      if (!cancelled) setTextReady((value) => value + 1);
    })().catch((caught: unknown) => {
      if (caught instanceof Error && caught.name === "RenderingCancelledException") return;
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [near, onScale, pageNumber, pdf, width, zoom]);

  useEffect(() => {
    const host = textRef.current;
    if (!host || textReady === 0) return;
    onOrphans(pageNumber, paintHighlights(host, highlights));
  }, [highlights, onOrphans, pageNumber, textReady]);

  const placeholderWidth = Math.max(width - 8, 240);
  return (
    <div
      ref={boxRef}
      data-pdf-page={pageNumber}
      className="pdf-page mb-3 border border-border last:mb-0"
      style={box ?? { width: placeholderWidth, height: Math.round(placeholderWidth * 1.35) }}
    >
      {near && width > 0 && (
        <>
          <canvas ref={canvasRef} role="img" aria-label={`Page ${pageNumber} of ${total} of ${title}`} className="block" />
          <div ref={textRef} className="textLayer" />
        </>
      )}
    </div>
  );
}

export function PdfReader({
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
  const initial = document.location?.kind === "pdf" ? document.location : null;
  const focusPage = highlights.find((item) => item.id === focusHighlightId)?.page ?? null;
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(focusPage ?? initial?.page ?? 1);
  const [zoom, setZoom] = useState(initial?.zoom ?? 0);
  const [pageInput, setPageInput] = useState(String(focusPage ?? initial?.page ?? 1));
  const [width, setWidth] = useState(0);
  const [scale, setScale] = useState(1);
  const [mode, setMode] = usePageMode();
  const { optimistic, create, update, remove, copy, editing, setEditing } = useHighlightMutations(document.id, highlights);
  const [selection, setSelection] = useState<{ page: number; start: number; end: number; text: string; rect: SelectionRect } | null>(null);
  const [orphansByPage, setOrphansByPage] = useState<Record<number, string[]>>({});
  const stageRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(page);
  const lockScroll = useRef(false);
  const save = usePositionSaver(document.id);
  const total = pdf?.numPages ?? document.pageCount ?? 0;
  const onScale = useCallback((next: number) => setScale(next), []);

  const orphanIds = useMemo(() => new Set(Object.values(orphansByPage).flat()), [orphansByPage]);
  // Page order first, so the list reads top to bottom through the file.
  const sorted = useMemo(
    () => [...optimistic].sort((a, b) => (a.page ?? 0) - (b.page ?? 0) || a.startOffset - b.startOffset),
    [optimistic],
  );
  const reportOrphans = useCallback((pageNumber: number, ids: string[]) => {
    setOrphansByPage((current) => {
      const previous = current[pageNumber];
      if (previous && previous.length === ids.length && previous.every((id, index) => id === ids[index])) return current;
      return { ...current, [pageNumber]: ids };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `${ASSETS}/pdf.worker.min.mjs`;
        task = pdfjs.getDocument({
          url: `/api/files/${document.id}`,
          cMapUrl: `${ASSETS}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${ASSETS}/standard_fonts/`,
          wasmUrl: `${ASSETS}/wasm/`,
          iccUrl: `${ASSETS}/iccs/`,
          enableXfa: false,
          disableRange: true,
        });
        const loaded = await task.promise;
        if (cancelled) return;
        setPdf(loaded);
        setPage((current) => Math.min(Math.max(1, current), loaded.numPages));
        if (!document.pageCount) {
          const meta = await loaded.getMetadata().catch(() => null);
          const info = (meta?.info ?? {}) as { Title?: unknown; Author?: unknown };
          const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : undefined);
          void recordFileMetadata({ id: document.id, pageCount: loaded.numPages, title: text(info.Title), author: text(info.Author) });
        }
      } catch (caught) {
        if (cancelled) return;
        const name = caught instanceof Error ? caught.name : "";
        setError(
          name === "PasswordException"
            ? "This PDF is password-protected, and Libra can't open protected PDFs."
            : "This PDF couldn't be opened. The file may be damaged or missing from storage.",
        );
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [document.id, document.pageCount]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    observer.observe(stage);
    return () => observer.disconnect();
  }, [pdf, mode]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    if (mode !== "scroll" || !pdf) return;
    const target = pageRef.current;
    lockScroll.current = true;
    const frame = requestAnimationFrame(() => {
      stageRef.current?.querySelector(`[data-pdf-page="${target}"]`)?.scrollIntoView({ block: "start" });
    });
    const release = window.setTimeout(() => {
      lockScroll.current = false;
    }, 200);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(release);
    };
  }, [mode, pdf]);

  useEffect(() => {
    const root = stageRef.current;
    if (mode !== "scroll" || !root || !pdf) return;
    let frame = 0;
    const updateScroll = () => {
      frame = 0;
      if (lockScroll.current) return;
      const top = root.getBoundingClientRect().top;
      let best = 1;
      let bestDist = Infinity;
      for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-page]"))) {
        const dist = Math.abs(el.getBoundingClientRect().top - top);
        if (dist < bestDist) {
          bestDist = dist;
          best = Number(el.dataset.pdfPage) || 1;
        }
      }
      setPage(best);
      if (window.document.activeElement?.id !== "pdf-page") setPageInput(String(best));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateScroll);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("scroll", onScroll);
    };
  }, [mode, pdf, total]);

  useEffect(() => {
    if (!total) return;
    const progress = page / total;
    if (progressLineRef.current) progressLineRef.current.style.width = `${Math.round(progress * 1000) / 10}%`;
    save({ progress, location: { kind: "pdf", page, zoom } });
  }, [page, zoom, total, progressLineRef, save]);

  /* ---- text selection in a page's text layer ---- */
  useEffect(() => {
    const onChange = () => {
      const selected = window.getSelection();
      const toolbarFocused = window.document.activeElement?.closest("[data-selection-toolbar]");
      const promptOpen = window.document.querySelector("[data-assist-prompt-menu][data-state=open]");
      if (!selected || selected.rangeCount === 0 || selected.isCollapsed) {
        if (!toolbarFocused && !promptOpen) setSelection(null);
        return;
      }
      const range = selected.getRangeAt(0);
      const owner = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
      const pageEl = owner?.closest<HTMLElement>("[data-pdf-page]");
      const layer = pageEl?.querySelector<HTMLElement>(".textLayer");
      if (!pageEl || !layer || !layer.contains(range.startContainer) || !layer.contains(range.endContainer)) {
        if (!toolbarFocused && !promptOpen) setSelection(null);
        return;
      }
      const offsets = rangeToOffsets(layer, range);
      if (!offsets) {
        setSelection(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setSelection({
        page: Number(pageEl.dataset.pdfPage) || 1,
        start: offsets.start,
        end: offsets.end,
        text: (layer.textContent ?? "").slice(offsets.start, offsets.end),
        rect: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
      });
    };
    window.document.addEventListener("selectionchange", onChange);
    return () => window.document.removeEventListener("selectionchange", onChange);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (!total) return;
      const clamped = Math.min(Math.max(1, next), total);
      setPage(clamped);
      setPageInput(String(clamped));
      if (mode === "scroll") {
        lockScroll.current = true;
        stageRef.current?.querySelector(`[data-pdf-page="${clamped}"]`)?.scrollIntoView({ block: "start" });
        window.setTimeout(() => {
          lockScroll.current = false;
        }, 200);
      }
    },
    [mode, total],
  );

  /** Move to a highlight's page, then to the passage itself once the page has painted. */
  const jumpTo = useCallback(
    (id: string) => {
      const highlight = optimistic.find((item) => item.id === id);
      if (!highlight?.page) return;
      goTo(highlight.page);
      onAnnotationsOpenChange(false);
      let attempts = 0;
      const seek = () => {
        const marks = Array.from(stageRef.current?.querySelectorAll<HTMLElement>(`mark.hl[data-hl-id="${CSS.escape(id)}"]`) ?? []);
        if (marks.length) {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          marks[0]?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
          for (const mark of marks) {
            mark.classList.remove("hl-flash");
            void mark.offsetWidth;
            mark.classList.add("hl-flash");
          }
          return;
        }
        // A page still rendering gets another look; an orphan stops at the page.
        if (++attempts < 90) requestAnimationFrame(seek);
      };
      requestAnimationFrame(seek);
    },
    [goTo, onAnnotationsOpenChange, optimistic],
  );

  // Arriving from the Highlights page: land on the passage, not just its page.
  const focused = useRef(false);
  useEffect(() => {
    if (!focusHighlightId || !pdf || focused.current) return;
    focused.current = true;
    jumpTo(focusHighlightId);
  }, [focusHighlightId, jumpTo, pdf]);

  const stepZoom = (direction: 1 | -1) => {
    const current = zoom === 0 ? scale : zoom;
    const next =
      direction === 1 ? ZOOM_STEPS.find((step) => step > current + 0.01) : [...ZOOM_STEPS].reverse().find((step) => step < current - 0.01);
    if (next) setZoom(next);
  };

  const createFromSelection = (color: HighlightColor, withNote: boolean, promptId?: string) => {
    const root = stageRef.current?.querySelector<HTMLElement>(`[data-pdf-page="${selection?.page}"] .textLayer`);
    if (!selection || !root) return;
    const pageText = root.textContent ?? "";
    const selector = describeTextRange(pageText, selection.start, selection.end);
    if (selector.exact.length < 2) return;
    void create(
      {
        quote: selector.exact.replace(/\s+/g, " ").trim(),
        prefix: selector.prefix,
        suffix: selector.suffix,
        context: surroundingSentence(pageText, selector.start, selector.end),
        startOffset: selector.start,
        endOffset: selector.end,
        page: selection.page,
      },
      color,
      withNote,
      promptId,
    );
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  };

  const openMark = (target: EventTarget) => {
    const mark = (target as HTMLElement).closest?.("mark.hl");
    const id = mark?.getAttribute("data-hl-id");
    if (!id || id.startsWith("pending-")) return;
    const selected = window.getSelection();
    if (selected && !selected.isCollapsed) return;
    const highlight = optimistic.find((item) => item.id === id);
    if (highlight) setEditing(toDraft(highlight));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (isOverlayOpen()) return;
      const key = event.key.toLowerCase();
      if (key === "h" && selection) {
        event.preventDefault();
        createFromSelection("YELLOW", false);
      } else if (key === "n" && selection) {
        event.preventDefault();
        createFromSelection("YELLOW", true);
      } else if (event.key === "Escape" && selection) {
        window.getSelection()?.removeAllRanges();
        setSelection(null);
      } else if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goTo(page + 1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goTo(page - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goTo, page, selection]);

  const pages = mode === "scroll" && total > 0 ? Array.from({ length: total }, (_, index) => index + 1) : [page];
  const panel = (
    <AnnotationsPanelBody
      document={document}
      highlights={sorted}
      orphanIds={orphanIds}
      onJump={jumpTo}
      onEdit={(id) => {
        const highlight = optimistic.find((item) => item.id === id);
        if (highlight) setEditing(toDraft(highlight));
      }}
      onAddTag={onAddTag}
      assist={assist}
      assistConfigured={assistConfigured}
    />
  );

  return (
    <div className={cn("grid", panelOpen && "xl:grid-cols-[minmax(0,1fr)_var(--panel-width)]")}>
      <div className="flex h-[calc(100dvh-3.5rem)] min-w-0 flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 border-b border-border bg-background px-3 py-2">
          <Button variant="quiet" size="icon" aria-label="Previous page" onClick={() => goTo(page - 1)} disabled={page <= 1 || !pdf}>
            <ChevronLeft />
          </Button>
          <form
            className="flex items-center gap-2 text-[13px] text-muted-foreground"
            onSubmit={(event) => {
              event.preventDefault();
              goTo(Number(pageInput) || page);
            }}
          >
            <label htmlFor="pdf-page">Page</label>
            <input
              id="pdf-page"
              inputMode="numeric"
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value.replace(/\D/g, ""))}
              onBlur={() => goTo(Number(pageInput) || page)}
              className="h-9 w-14 rounded-sm border border-border bg-well text-center font-mono text-[13px] text-foreground outline-none focus:border-terracotta"
              aria-describedby="pdf-total"
            />
            <span id="pdf-total">of {total || "…"}</span>
          </form>
          <Button variant="quiet" size="icon" aria-label="Next page" onClick={() => goTo(page + 1)} disabled={!pdf || page >= total}>
            <ChevronRight />
          </Button>
          <span aria-hidden className="mx-1.5 hidden h-5 w-px bg-border sm:block" />
          <Button variant="quiet" size="icon" aria-label="Zoom out" onClick={() => stepZoom(-1)} disabled={!pdf}>
            <ZoomOut />
          </Button>
          <span className="w-[72px] text-center font-mono text-[12px] text-muted-foreground" aria-live="polite">
            {zoom === 0 ? "Fit width" : `${Math.round(zoom * 100)}%`}
          </span>
          <Button variant="quiet" size="icon" aria-label="Zoom in" onClick={() => stepZoom(1)} disabled={!pdf}>
            <ZoomIn />
          </Button>
          <Button
            variant="quiet"
            size="icon"
            aria-label="Fit to width"
            aria-pressed={zoom === 0}
            onClick={() => setZoom(0)}
            disabled={!pdf}
            className="aria-[pressed=true]:border-transparent aria-[pressed=true]:bg-transparent aria-[pressed=true]:text-terracotta"
          >
            <Maximize2 />
          </Button>
          <PageModeToggle mode={mode} onChange={setMode} />
        </div>

        {error ? (
          <div className="mx-auto w-full max-w-[560px] px-[22px] pt-12">
            <div className="state-box" data-tone="error" role="alert">
              <CircleAlert className="mt-px size-[18px] shrink-0 text-err" aria-hidden />
              <div>
                <p className="mb-1 text-[13.5px] font-semibold">Couldn&apos;t open this PDF</p>
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
        ) : (
          <div
            ref={stageRef}
            onClick={(event) => openMark(event.target)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") openMark(event.target);
            }}
            className="min-h-0 flex-1 overflow-auto"
          >
            {pdf && width > 0
              ? pages.map((pageNumber) => (
                  <PdfPage
                    key={pageNumber}
                    pdf={pdf}
                    pageNumber={pageNumber}
                    total={total}
                    title={document.title}
                    zoom={zoom}
                    width={width}
                    highlights={optimistic.filter((item) => item.page === pageNumber)}
                    scrollRoot={mode === "scroll" ? stageRef : null}
                    reportScale={pageNumber === page}
                    onScale={onScale}
                    onOrphans={reportOrphans}
                  />
                ))
              : null}
            {!pdf && !error && (
              <div className="flex justify-center py-16" role="status">
                <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  Opening the PDF…
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {panelOpen && <AnnotationsAside body={panel} />}

      <AnnotationsSheet
        open={annotationsOpen}
        onOpenChange={onAnnotationsOpenChange}
        count={optimistic.length}
        body={panel}
      />

      {selection && !editing && (
        <SelectionToolbar
          rect={selection.rect}
          prompts={prompts}
          onHighlight={(color) => createFromSelection(color, false)}
          onNote={() => createFromSelection("YELLOW", true)}
          onPrompt={(promptId) => createFromSelection("YELLOW", false, promptId)}
          onCopy={() => {
            void copy(selection.text);
            window.getSelection()?.removeAllRanges();
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
    </div>
  );
}
