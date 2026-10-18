"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Copy, Highlighter, NotebookPen } from "lucide-react";
import { AssistPromptMenu } from "@/components/reader/assist-prompt-menu";
import { HIGHLIGHT_COLORS } from "@/lib/colors";
import type { HighlightColor } from "@/lib/generated/prisma/enums";
import type { AssistPromptItem } from "@/lib/types";

export interface SelectionRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

/**
 * The floating ink toolbar for a text selection. mousedown is prevented so
 * clicking a button never collapses the selection it acts on.
 */
export function SelectionToolbar({
  rect,
  prompts,
  onHighlight,
  onNote,
  onPrompt,
  onCopy,
}: {
  rect: SelectionRect;
  prompts: AssistPromptItem[];
  onHighlight: (color: HighlightColor) => void;
  onNote: () => void;
  onPrompt: (promptId: string) => void;
  onCopy: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const above = rect.top - height - 10;
    const placeBelow = coarse || above < 68;
    const top = placeBelow ? Math.min(rect.bottom + 12, window.innerHeight - height - 12) : above;
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12));
    setPosition({ top, left });
  }, [rect]);

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Selection actions"
      data-selection-toolbar
      onMouseDown={(event) => event.preventDefault()}
      style={{ top: position?.top ?? -9999, left: position?.left ?? -9999 }}
      className="fixed z-40 flex items-center gap-0.5 rounded-[10px] bg-foreground p-1.5 text-background shadow-pop motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95"
    >
      <button
        type="button"
        onClick={() => onHighlight("YELLOW")}
        className="flex min-h-9 items-center gap-2 rounded-md px-3.5 text-[12.5px] font-medium hover:bg-background/20 focus-visible:outline-2 focus-visible:outline-background pointer-coarse:min-h-11"
      >
        <Highlighter className="size-[15px]" aria-hidden />
        Highlight
      </button>
      <span className="flex gap-1.5 px-[7px]">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            onClick={() => onHighlight(color.value)}
            aria-label={`Highlight in ${color.label}`}
            title={color.label}
            className="size-5 rounded-full border border-background/50 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background pointer-coarse:size-7"
            style={{ background: color.cssVar }}
          />
        ))}
      </span>
      <span aria-hidden className="mx-[5px] h-5 w-px bg-background/32" />
      <button
        type="button"
        onClick={onNote}
        className="flex min-h-9 items-center gap-2 rounded-md px-3.5 text-[12.5px] font-medium hover:bg-background/20 focus-visible:outline-2 focus-visible:outline-background pointer-coarse:min-h-11"
      >
        <NotebookPen className="size-[15px]" aria-hidden />
        Add note
      </button>
      <AssistPromptMenu variant="toolbar" prompts={prompts} onSelect={onPrompt} />
      <button
        type="button"
        onClick={onCopy}
        className="flex min-h-9 items-center gap-2 rounded-md px-3.5 text-[12.5px] font-medium hover:bg-background/20 focus-visible:outline-2 focus-visible:outline-background max-sm:px-2.5 pointer-coarse:min-h-11"
      >
        <Copy className="size-[15px]" aria-hidden />
        <span className="max-sm:sr-only">Copy</span>
      </button>
    </div>
  );
}
