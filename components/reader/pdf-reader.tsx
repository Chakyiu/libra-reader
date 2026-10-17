"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, Download, LoaderCircle, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { usePositionSaver } from "@/components/reader/use-position-saver";
import { Button } from "@/components/ui/button";
import { recordFileMetadata } from "@/lib/actions/documents";
import { isOverlayOpen, isTypingTarget } from "@/lib/shortcuts";
import type { ReaderDocument } from "@/lib/types";

const ASSETS = "/vendor/pdfjs";
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

/**
 * Renders one PDF page at a time to a canvas with PDF.js. No annotation or
 * text layer is mounted, so links, forms and embedded scripts stay inert.
 */
export function PdfReader({ document, progressLineRef }: { document: ReaderDocument; progressLineRef: RefObject<HTMLDivElement | null> }) {
  const initial = document.location?.kind === "pdf" ? document.location : null;
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initial?.page ?? 1);
  const [zoom, setZoom] = useState(initial?.zoom ?? 0);
  const [pageInput, setPageInput] = useState(String(initial?.page ?? 1));
  const [rendering, setRendering] = useState(true);
  const [width, setWidth] = useState(0);
  const [scale, setScale] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const save = usePositionSaver(document.id);
  const total = pdf?.numPages ?? document.pageCount ?? 0;

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
        setRendering(false);
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
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!pdf || !canvas || width === 0) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    setRendering(true);
    (async () => {
      const pdfPage = await pdf.getPage(page);
      if (cancelled) return;
      const natural = pdfPage.getViewport({ scale: 1 });
      const effective = zoom === 0 ? Math.max(0.3, Math.min(3, (width - 8) / natural.width)) : zoom;
      setScale(effective);
      const viewport = pdfPage.getViewport({ scale: effective });
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      task = pdfPage.render({ canvas, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
      await task.promise;
      if (!cancelled) setRendering(false);
    })().catch((caught: unknown) => {
      if (caught instanceof Error && caught.name === "RenderingCancelledException") return;
      if (!cancelled) {
        setError("This page couldn't be drawn.");
        setRendering(false);
      }
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page, zoom, width]);

  useEffect(() => {
    if (!total) return;
    const progress = page / total;
    if (progressLineRef.current) progressLineRef.current.style.width = `${Math.round(progress * 1000) / 10}%`;
    save({ progress, location: { kind: "pdf", page, zoom } });
  }, [page, zoom, total, progressLineRef, save]);

  const goTo = useCallback(
    (next: number) => {
      if (!total) return;
      const clamped = Math.min(Math.max(1, next), total);
      setPage(clamped);
      setPageInput(String(clamped));
      stageRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    },
    [total],
  );

  const stepZoom = (direction: 1 | -1) => {
    const current = zoom === 0 ? scale : zoom;
    const next =
      direction === 1 ? ZOOM_STEPS.find((step) => step > current + 0.01) : [...ZOOM_STEPS].reverse().find((step) => step < current - 0.01);
    if (next) setZoom(next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (isOverlayOpen()) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goTo(page + 1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goTo(page - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, page]);

  return (
    <div>
      <div className="sticky top-14 z-20 flex flex-wrap items-center justify-center gap-1.5 border-b border-border bg-background/92 px-3 py-2 backdrop-blur-[10px]">
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
        <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />
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
      </div>

      <div className="mx-auto max-w-[1100px] px-3 pt-6 pb-24 sm:px-8">
        <header className="mx-auto mb-6 max-w-[760px] text-center">
          <h1 className="font-serif text-[22px] leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-[26px]">{document.title}</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {[document.author, document.publication, "PDF", total ? `${total} pages` : null].filter(Boolean).join(" · ")}
          </p>
        </header>
        {error ? (
          <div className="state-box mx-auto mt-8 max-w-[560px]" data-tone="error" role="alert">
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
        ) : (
          <div ref={stageRef} className="relative overflow-x-auto scroll-mt-[120px]">
            <div className="mx-auto w-fit">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`Page ${page} of ${total || "…"} of ${document.title}`}
                className="block rounded-[2px] border border-border bg-white"
              />
            </div>
            {rendering && (
              <div className="absolute inset-x-0 top-10 flex justify-center" role="status">
                <span className="flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-[12.5px] text-muted-foreground shadow-pop">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  Rendering page {page}…
                </span>
              </div>
            )}
          </div>
        )}
        <p className="mx-auto mt-6 max-w-[62ch] text-center text-[12.5px] leading-relaxed text-muted-foreground">
          PDFs are shown page by page. Text selection and highlighting aren&apos;t available for PDFs yet, and links, forms and
          scripts inside the file stay inactive. Use ← and → to turn pages.
        </p>
      </div>
    </div>
  );
}
