import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { HIGHLIGHT_LABEL, highlightVar } from "@/lib/colors";
import type { HighlightWithSource } from "@/lib/types";

/** A saved passage with its note and a way back to the paragraph it came from. */
export function HighlightCard({
  highlight,
  actions,
  extra,
}: {
  highlight: HighlightWithSource;
  actions?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <article className="relative rounded-lg border border-border bg-background px-[26px] py-6 transition-colors hover:border-foreground/30 max-sm:px-5 max-sm:py-5">
      <p className="font-serif text-[19px] leading-[1.6] tracking-[-0.005em] whitespace-pre-line max-sm:text-[17px]">
        <span className="hl-wash" data-color={highlight.color}>
          {highlight.quote}
        </span>
      </p>
      {highlight.note && (
        <p className="mt-4 border-l-2 border-terracotta/60 pl-4 text-[13.5px] leading-relaxed text-muted-foreground italic">
          {highlight.note}
        </p>
      )}
      {extra}
      <div className="mt-[18px] flex flex-wrap items-center gap-x-[9px] gap-y-2 text-[12.5px] text-muted-foreground">
        <span className="chip gap-1.5 py-1">
          <span className="swatch" style={{ background: highlightVar(highlight.color) }} aria-hidden />
          {HIGHLIGHT_LABEL[highlight.color]}
        </span>
        <span className="font-medium text-foreground/85">{highlight.document.title}</span>
        {highlight.document.author && (
          <>
            <span aria-hidden>·</span>
            <span>{highlight.document.author}</span>
          </>
        )}
        {highlight.document.tags.map((tag) => (
          <span key={tag} className="chip py-1" data-variant="tag">
            #{tag}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1">
          {actions}
          <Link
            href={`/read/${highlight.document.id}?hl=${highlight.id}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-sm px-2 font-medium text-terracotta-text hover:bg-terracotta/8"
          >
            <ChevronRight className="size-[15px]" aria-hidden />
            Go to passage
            <span className="sr-only"> in {highlight.document.title}</span>
          </Link>
        </span>
      </div>
    </article>
  );
}
