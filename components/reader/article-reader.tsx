"use client";

import { useRouter } from "next/navigation";
import {
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "cn";
import { Copy, ExternalLink, NotebookPen, Trash } from "lucide-react";
import { toast } from "sonner";
import { ColorChips } from "@/components/highlights/color-chips";
import { NoteDialog, type NoteDraft } from "@/components/highlights/note-dialog";
import { AnnotationsAside, AnnotationsPanelBody, AnnotationsSheet } from "@/components/reader/annotations-column";
import { ExplainPassage } from "@/components/reader/assist-panel";
import { AssistPromptMenu } from "@/components/reader/assist-prompt-menu";
import { SelectionToolbar, type SelectionRect } from "@/components/reader/selection-toolbar";
import { usePositionSaver } from "@/components/reader/use-position-saver";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { offsetsToRange, rangeToOffsets, textOffsetOf, unwrapHighlights, wrapOffsets } from "@/lib/anchoring/dom-anchor";
import { anchorSelector, describeTextRange, surroundingSentence } from "@/lib/anchoring/text-anchor";
import { applyAssistPrompt } from "@/lib/actions/assist";
import { createHighlight, deleteHighlight, updateHighlight } from "@/lib/actions/highlights";
import { formatMinutes, TYPE_LABEL } from "@/lib/format";
import type { HighlightColor } from "@/lib/generated/prisma/enums";
import { isOverlayOpen, isTypingTarget } from "@/lib/shortcuts";
import type { AssistPromptItem, DocumentAssist, HighlightItem, Preferences, ReaderDocument } from "@/lib/types";
import { MAX_QUOTE_LENGTH, type ReadingLocation } from "@/lib/validation";

const TOOLBAR_HEIGHT = 56;

type OptimisticAction =
  | { type: "add"; highlight: HighlightItem }
  | { type: "update"; id: string; patch: Partial<HighlightItem> }
  | { type: "remove"; id: string };

function reduceHighlights(state: HighlightItem[], action: OptimisticAction): HighlightItem[] {
  switch (action.type) {
    case "add":
      return [...state, action.highlight];
    case "update":
      return state.map((h) => (h.id === action.id ? { ...h, ...action.patch } : h));
    case "remove":
      return state.filter((h) => h.id !== action.id);
  }
}

interface SelectionState {
  start: number;
  end: number;
  text: string;
  rect: SelectionRect;
}

/** The article markup is set once; highlights are painted onto it imperatively. */
const ArticleBody = memo(function ArticleBody({ html, bodyRef }: { html: string; bodyRef: RefObject<HTMLDivElement | null> }) {
  return <div ref={bodyRef} className="article-body" dangerouslySetInnerHTML={{ __html: html }} />;
});

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (typeof doc.caretPositionFromPoint === "function") {
    const position = doc.caretPositionFromPoint(x, y);
    return position ? { node: position.offsetNode, offset: position.offset } : null;
  }
  if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(x, y);
    return range ? { node: range.startContainer, offset: range.startOffset } : null;
  }
  return null;
}

function scrollRatio(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1;
}

function marksFor(root: HTMLElement | null, id: string): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(`mark.hl[data-hl-id="${CSS.escape(id)}"]`));
}

function toDraft(highlight: HighlightItem): NoteDraft {
  return { id: highlight.id, quote: highlight.quote, note: highlight.note, color: highlight.color };
}

export function ArticleReader({
  document: doc,
  highlights,
  preferences,
  assist,
  assistConfigured,
  prompts,
  focusHighlightId,
  panelOpen,
  annotationsOpen,
  onAnnotationsOpenChange,
  progressLineRef,
  onAddTag,
  endcap,
}: {
  document: ReaderDocument & { contentHtml: string };
  highlights: HighlightItem[];
  preferences: Preferences;
  assist: DocumentAssist;
  assistConfigured: boolean;
  prompts: AssistPromptItem[];
  focusHighlightId?: string;
  panelOpen: boolean;
  annotationsOpen: boolean;
  onAnnotationsOpenChange: (open: boolean) => void;
  progressLineRef: RefObject<HTMLDivElement | null>;
  onAddTag: () => void;
  endcap: ReactNode;
}) {
  const router = useRouter();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [optimistic, applyOptimistic] = useOptimistic(highlights, reduceHighlights);
  const [, startTransition] = useTransition();
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [orphanIds, setOrphanIds] = useState<Set<string>>(() => new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<NoteDraft | null>(null);
  const [writtenNotes, setWrittenNotes] = useState<Record<string, { answer: string; model: string }>>({});
  const headings = doc.headings;
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const pointerDown = useRef(false);
  const restored = useRef(false);
  const savePosition = usePositionSaver(doc.id);

  const sorted = useMemo(() => [...optimistic].sort((a, b) => a.startOffset - b.startOffset), [optimistic]);
  const activeHighlight = activeId ? (optimistic.find((h) => h.id === activeId) ?? null) : null;
  const promptNotes = { ...assist.promptNotes, ...writtenNotes };

  // useOptimistic hands back a new array on every render while an action is
  // pending, so painting is keyed on content rather than array identity.
  const paintKey = sorted
    .map((h) => `${h.id}:${h.color}:${h.note ? 1 : 0}:${h.startOffset}:${h.endOffset}:${h.quote.length}`)
    .join("|");
  const orphanRef = useRef(orphanIds);

  /* ---- paint highlights onto the article ---- */
  const paint = useEffectEvent(() => {
    const root = bodyRef.current;
    if (!root) return;
    unwrapHighlights(root);
    const text = root.textContent ?? "";
    const orphans = new Set<string>();
    for (const highlight of sorted) {
      const match = anchorSelector(text, {
        exact: highlight.quote,
        prefix: highlight.prefix,
        suffix: highlight.suffix,
        start: highlight.startOffset,
        end: highlight.endOffset,
      });
      if (!match) {
        orphans.add(highlight.id);
        continue;
      }
      const label = `Highlight${highlight.note ? " with note" : ""}: ${highlight.quote.slice(0, 80)}`;
      wrapOffsets(root, match.start, match.end, { id: highlight.id, color: highlight.color, hasNote: Boolean(highlight.note), label });
    }
    const previous = orphanRef.current;
    if (previous.size !== orphans.size || [...orphans].some((id) => !previous.has(id))) {
      orphanRef.current = orphans;
      setOrphanIds(orphans);
    }
  });

  useLayoutEffect(() => {
    paint();
  }, [paintKey, doc.contentHtml]);

  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    for (const mark of Array.from(root.querySelectorAll<HTMLElement>("mark.hl[data-active]"))) mark.removeAttribute("data-active");
    if (activeId) for (const mark of marksFor(root, activeId)) mark.setAttribute("data-active", "true");
  }, [activeId, paintKey]);

  /* ---- jumping to a highlight ---- */
  const jumpTo = useCallback(
    (id: string, smooth = true): boolean => {
      const marks = marksFor(bodyRef.current, id);
      const first = marks[0];
      if (!first) return false;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: first.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3, behavior: smooth && !reduce ? "smooth" : "auto" });
      for (const mark of marks) {
        mark.classList.remove("hl-flash");
        void mark.offsetWidth;
        mark.classList.add("hl-flash");
      }
      onAnnotationsOpenChange(false);
      return true;
    },
    [onAnnotationsOpenChange],
  );

  /* ---- reading position ---- */
  const currentLocation = useCallback((): ReadingLocation => {
    const root = bodyRef.current;
    const ratio = scrollRatio();
    if (!root) return { kind: "text", offset: 0, ratio };
    const rect = root.getBoundingClientRect();
    const y = Math.max(TOOLBAR_HEIGHT + 12, rect.top + 2);
    let offset = 0;
    if (y < window.innerHeight && rect.bottom > y) {
      const caret = caretAt(rect.left + Math.min(32, rect.width / 2), y);
      if (caret && root.contains(caret.node)) offset = textOffsetOf(root, caret.node, caret.offset);
    } else if (rect.bottom <= y) {
      offset = (root.textContent ?? "").length;
    }
    return { kind: "text", offset, ratio };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restore = () => {
      if (cancelled) return;
      const root = bodyRef.current;
      if (!(focusHighlightId && jumpTo(focusHighlightId, false)) && root) {
        const location = doc.location;
        if (location?.kind === "text" && location.offset > 0) {
          const range = offsetsToRange(root, location.offset, Math.min(location.offset + 1, (root.textContent ?? "").length));
          if (range) {
            window.scrollTo({ top: range.getBoundingClientRect().top + window.scrollY - TOOLBAR_HEIGHT - 20, behavior: "auto" });
          }
        } else if (location?.kind === "text" && location.ratio > 0) {
          window.scrollTo({ top: location.ratio * (document.documentElement.scrollHeight - window.innerHeight), behavior: "auto" });
        }
      }
      restored.current = true;
      savePosition({ progress: scrollRatio(), location: currentLocation() }, true);
    };
    const fonts = document.fonts?.ready ?? Promise.resolve();
    void fonts.then(() => requestAnimationFrame(restore));
    return () => {
      cancelled = true;
    };
    // Restore once per document; later prop refreshes must not move the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const ratio = scrollRatio();
      if (progressLineRef.current) progressLineRef.current.style.width = `${Math.round(ratio * 1000) / 10}%`;
      const root = bodyRef.current;
      if (root) {
        let current: string | null = null;
        for (const heading of Array.from(root.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id]"))) {
          if (heading.getBoundingClientRect().top < 140) current = heading.id;
          else break;
        }
        setActiveHeading(current);
      }
      if (restored.current) savePosition({ progress: ratio, location: currentLocation() });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [currentLocation, progressLineRef, savePosition]);

  /* ---- text selection ---- */
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    let frame = 0;
    const compute = () => {
      frame = 0;
      if (pointerDown.current) return;
      const selected = window.getSelection();
      const toolbarFocused = document.activeElement?.closest("[data-selection-toolbar]");
      const promptMenuOpen = document.querySelector("[data-assist-prompt-menu][data-state=open]");
      if (!selected || selected.rangeCount === 0 || selected.isCollapsed) {
        if (!toolbarFocused && !promptMenuOpen) setSelection(null);
        return;
      }
      const range = selected.getRangeAt(0);
      if (!root.contains(range.startContainer) && !root.contains(range.endContainer)) {
        setSelection(null);
        return;
      }
      const offsets = rangeToOffsets(root, range);
      if (!offsets || offsets.end - offsets.start < 2) {
        setSelection(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setSelection({
        ...offsets,
        text: (root.textContent ?? "").slice(offsets.start, offsets.end),
        rect: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(compute);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (root.contains(event.target as Node)) pointerDown.current = true;
    };
    const onPointerUp = () => {
      if (!pointerDown.current) return;
      pointerDown.current = false;
      setTimeout(schedule, 10);
    };
    document.addEventListener("selectionchange", schedule);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", schedule);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  /* ---- highlight mutations (optimistic) ---- */
  const createFromSelection = useCallback(
    (color: HighlightColor, withNote: boolean, promptId?: string) => {
      const root = bodyRef.current;
      if (!root || !selection) return;
      if (selection.end - selection.start > MAX_QUOTE_LENGTH) {
        toast.error("That selection is too long to highlight. Try a paragraph or less.");
        return;
      }
      const text = root.textContent ?? "";
      const selector = describeTextRange(text, selection.start, selection.end);
      const context = surroundingSentence(text, selector.start, selector.end);
      window.getSelection()?.removeAllRanges();
      setSelection(null);
      const now = new Date();
      const temp: HighlightItem = {
        id: `pending-${now.getTime()}`,
        documentId: doc.id,
        quote: selector.exact,
        prefix: selector.prefix,
        suffix: selector.suffix,
        context,
        startOffset: selector.start,
        endOffset: selector.end,
        page: null,
        cfi: null,
        color,
        note: null,
        createdAt: now,
        updatedAt: now,
      };
      startTransition(async () => {
        applyOptimistic({ type: "add", highlight: temp });
        const result = await createHighlight({
          documentId: doc.id,
          quote: selector.exact,
          prefix: selector.prefix,
          suffix: selector.suffix,
          context,
          startOffset: selector.start,
          endOffset: selector.end,
          color,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (promptId) {
          const written = await applyAssistPrompt({ highlightId: result.data.id, promptId });
          if (!written.ok) {
            toast.error(written.error);
            return;
          }
          applyOptimistic({ type: "update", id: result.data.id, patch: { note: written.data.note } });
          setWrittenNotes((current) => ({
            ...current,
            [result.data.id]: { answer: written.data.note, model: written.data.model },
          }));
          toast("Note written");
          return;
        }
        if (withNote) setEditing(toDraft(result.data));
        else toast("Highlighted", { action: { label: "Add a note", onClick: () => setEditing(toDraft(result.data)) } });
      });
    },
    [applyOptimistic, doc.id, selection],
  );

  const runPrompt = useCallback(
    (highlightId: string, promptId: string) => {
      startTransition(async () => {
        const written = await applyAssistPrompt({ highlightId, promptId });
        if (!written.ok) {
          toast.error(written.error);
          return;
        }
        applyOptimistic({ type: "update", id: highlightId, patch: { note: written.data.note } });
        setWrittenNotes((current) => ({
          ...current,
          [highlightId]: { answer: written.data.note, model: written.data.model },
        }));
        toast("Note written");
      });
    },
    [applyOptimistic],
  );

  const update = useCallback(
    (id: string, patch: { note?: string; color?: HighlightColor }) =>
      new Promise<boolean>((resolve) => {
        const optimisticPatch: Partial<HighlightItem> = {};
        if (patch.color) optimisticPatch.color = patch.color;
        if (patch.note !== undefined) optimisticPatch.note = patch.note || null;
        startTransition(async () => {
          applyOptimistic({ type: "update", id, patch: optimisticPatch });
          const result = await updateHighlight({ id, ...patch });
          if (!result.ok) toast.error(result.error);
          else if (patch.note !== undefined) {
            toast(patch.note ? "Note saved" : "Highlight updated", {
              action: { label: "See in Highlights", onClick: () => router.push("/highlights") },
            });
          }
          resolve(result.ok);
        });
      }),
    [applyOptimistic, router],
  );

  const remove = useCallback(
    (id: string) => {
      const highlight = optimistic.find((h) => h.id === id);
      if (!highlight) return;
      setActiveId(null);
      startTransition(async () => {
        applyOptimistic({ type: "remove", id });
        const result = await deleteHighlight(id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast("Highlight removed", {
          action: {
            label: "Undo",
            onClick: () =>
              startTransition(async () => {
                applyOptimistic({ type: "add", highlight });
                const restoredResult = await createHighlight({
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
                });
                if (!restoredResult.ok) toast.error(restoredResult.error);
              }),
          },
        });
      });
    },
    [applyOptimistic, optimistic],
  );

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Passage copied");
    } catch {
      toast.error("Your browser didn't allow copying.");
    }
  }, []);

  /* ---- keyboard: H highlights, N highlights with a note ---- */
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
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createFromSelection, selection]);

  /* ---- opening a highlight from the text ---- */
  const openFromMark = (target: EventTarget) => {
    const mark = (target as HTMLElement).closest?.("mark.hl");
    const id = mark?.getAttribute("data-hl-id");
    if (!id || id.startsWith("pending-")) return false;
    const selected = window.getSelection();
    if (selected && !selected.isCollapsed) return false;
    setActiveId(id);
    return true;
  };

  const onBodyClick = (event: ReactMouseEvent) => {
    openFromMark(event.target);
  };

  const onBodyKeyDown = (event: ReactKeyboardEvent) => {
    if ((event.key === "Enter" || event.key === " ") && openFromMark(event.target)) event.preventDefault();
  };

  const anchorRef = useMemo(
    () => ({
      current: {
        getBoundingClientRect: () =>
          (activeId ? marksFor(bodyRef.current, activeId)[0]?.getBoundingClientRect() : undefined) ?? new DOMRect(0, 0, 0, 0),
      },
    }),
    [activeId],
  );

  const articleStyle = {
    "--read-size": `${preferences.fontSize}px`,
    "--read-lead": String(preferences.lineHeight),
    maxWidth: `${preferences.columnWidth}ch`,
  } as CSSProperties;

  const length = doc.readingMinutes ? formatMinutes(doc.readingMinutes) : null;
  const panel = (
    <AnnotationsPanelBody
      document={doc}
      highlights={sorted}
      orphanIds={orphanIds}
      onJump={(id) => jumpTo(id)}
      onEdit={(id) => {
        const highlight = optimistic.find((h) => h.id === id);
        if (highlight) setEditing(toDraft(highlight));
      }}
      onAddTag={onAddTag}
      assist={assist}
      assistConfigured={assistConfigured}
    />
  );

  return (
    <>
      <div
        className={cn(
          "grid",
          panelOpen
            ? "xl:grid-cols-[minmax(0,1fr)_var(--panel-width)] min-[1360px]:grid-cols-[var(--toc-width)_minmax(0,1fr)_var(--panel-width)]"
            : "min-[1360px]:grid-cols-[var(--toc-width)_minmax(0,1fr)]",
        )}
      >
        <nav
          aria-label="Contents"
          className="sticky top-14 hidden max-h-[calc(100dvh-56px)] self-start overflow-y-auto px-6 pt-[38px] pb-16 min-[1360px]:block"
        >
          <h2 className="caps mb-3.5">Contents</h2>
          {headings.length ? (
            <ol>
              {headings.map((heading) => (
                <li key={heading.id}>
                  <a
                    href={`#${heading.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      const target = document.getElementById(heading.id);
                      if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 84, behavior: "smooth" });
                    }}
                    aria-current={activeHeading === heading.id ? "location" : undefined}
                    className={cn(
                      "block border-l-2 border-border py-2.5 pl-4 text-[13px] leading-snug text-muted-foreground hover:text-foreground aria-[current=location]:border-terracotta aria-[current=location]:font-medium aria-[current=location]:text-terracotta-text",
                      heading.level === 3 && "pl-7 text-[12.5px]",
                    )}
                  >
                    {heading.text}
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] leading-normal text-muted-foreground">Short enough not to need one.</p>
          )}
        </nav>

        <div className="min-w-0 px-[22px] pt-7 pb-36 sm:px-11 lg:pt-[38px]">
          <article className="article mx-auto w-full" data-font={preferences.font} style={articleStyle}>
            <header className="mb-9 border-b border-border pb-[30px] max-sm:mb-7 max-sm:pb-6">
              <h1 className="font-serif text-[30px] leading-[1.14] font-semibold tracking-[-0.025em] text-balance sm:text-[clamp(30px,3.4vw,42px)]">
                {doc.title}
              </h1>
              <p className="mt-[18px] flex flex-wrap items-center gap-x-2.5 gap-y-1.5 font-sans text-[13px] text-muted-foreground">
                <span>{[doc.author, doc.publication, TYPE_LABEL[doc.type], length].filter(Boolean).join(" · ")}</span>
                {doc.sourceUrl && (
                  <a
                    href={doc.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 border-b border-terracotta/40 pb-0.5 text-terracotta-text no-underline hover:border-terracotta"
                  >
                    <span className="truncate">{doc.sourceUrl.replace(/^https?:\/\/(www\.)?/, "")}</span>
                    <ExternalLink className="size-[13px] shrink-0" aria-hidden />
                    <span className="sr-only">(opens the original in a new tab)</span>
                  </a>
                )}
              </p>
            </header>
            {/* Clicks and Enter on painted <mark> elements open the highlight. */}
            <div onClick={onBodyClick} onKeyDown={onBodyKeyDown}>
              <ArticleBody html={doc.contentHtml} bodyRef={bodyRef} />
            </div>
            {endcap}
          </article>
        </div>

        {panelOpen && <AnnotationsAside body={panel} />}
      </div>

      <AnnotationsSheet
        open={annotationsOpen}
        onOpenChange={onAnnotationsOpenChange}
        count={optimistic.length}
        body={panel}
      />

      {selection && !activeId && !editing && (
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

      <Popover open={activeHighlight !== null} onOpenChange={(open) => !open && setActiveId(null)}>
        <PopoverAnchor virtualRef={anchorRef} />
        {activeHighlight && (
          <PopoverContent align="start" className="w-[min(340px,calc(100vw-24px))]" aria-label="Highlight">
            <h3 className="caps mb-3">Highlight</h3>
            <p className="mb-3.5 line-clamp-4 font-serif text-[15px] leading-[1.55] whitespace-pre-line">{activeHighlight.quote}</p>
            {activeHighlight.note ? (
              <div className="mb-4">
                <p className="border-l-2 border-terracotta/60 pl-4 text-[13.5px] text-muted-foreground italic">{activeHighlight.note}</p>
                {promptNotes[activeHighlight.id]?.answer === activeHighlight.note && (
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">Generated · {promptNotes[activeHighlight.id]?.model}</p>
                )}
              </div>
            ) : (
              <p className="mb-4 text-[13px] text-muted-foreground">No note on this one yet.</p>
            )}
            <div className="mb-4">
              <ColorChips value={activeHighlight.color} onChange={(color) => void update(activeHighlight.id, { color })} />
            </div>
            <ExplainPassage
              key={`${activeHighlight.id}:${assist.explanations[activeHighlight.id]?.updatedAt ?? ""}`}
              documentId={doc.id}
              highlightId={activeHighlight.id}
              initial={assist.explanations[activeHighlight.id] ?? null}
              configured={assistConfigured}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setEditing(toDraft(activeHighlight));
                  setActiveId(null);
                }}
              >
                <NotebookPen />
                {activeHighlight.note ? "Edit note" : "Add note"}
              </Button>
              <AssistPromptMenu
                variant="field"
                prompts={prompts}
                onSelect={(promptId) => runPrompt(activeHighlight.id, promptId)}
              />
              <Button variant="ghost" size="icon-sm" aria-label="Copy passage" onClick={() => void copy(activeHighlight.quote)}>
                <Copy />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Delete highlight" onClick={() => remove(activeHighlight.id)}>
                <Trash />
              </Button>
            </div>
          </PopoverContent>
        )}
      </Popover>

      <NoteDialog
        highlight={editing}
        prompts={prompts}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={(id, patch) => update(id, patch)}
        onDelete={remove}
      />
    </>
  );
}
