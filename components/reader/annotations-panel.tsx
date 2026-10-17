"use client";

import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { formatDate, lengthLabel, STATUS_CHIP, TYPE_LABEL } from "@/lib/format";
import { highlightVar } from "@/lib/colors";
import type { DocumentListItem, HighlightItem } from "@/lib/types";

export function DocumentFacts({ document, onAddTag }: { document: DocumentListItem; onAddTag: () => void }) {
  const length = lengthLabel(document);
  return (
    <>
      <h3 className="caps">Document</h3>
      <dl className="mt-3 grid gap-1 text-[13px] leading-relaxed text-muted-foreground">
        <div>
          <dt className="sr-only">Saved</dt>
          <dd>Saved {formatDate(document.createdAt)}</dd>
        </div>
        <div>
          <dt className="sr-only">Length and type</dt>
          <dd>{[length, TYPE_LABEL[document.type]].filter(Boolean).join(" · ")}</dd>
        </div>
        <div>
          <dt className="inline">Collections: </dt>
          <dd className="inline">
            {document.collections.length
              ? document.collections.map((c, index) => (
                  <span key={c.id}>
                    {index > 0 && ", "}
                    <Link href={`/collections/${c.id}`} className="underline decoration-border underline-offset-4 hover:text-foreground">
                      {c.name}
                    </Link>
                  </span>
                ))
              : "None"}
          </dd>
        </div>
        <div>
          <dt className="inline">Status: </dt>
          <dd className="inline">
            {STATUS_CHIP[document.status]}
            {document.isFavorite ? " · Favorite" : ""}
          </dd>
        </div>
      </dl>
      <div className="mt-3.5 flex flex-wrap gap-[7px]">
        {document.tags.map((tag) => (
          <Link key={tag} href={`/library?tag=${encodeURIComponent(tag)}`} className="chip" data-variant="tag">
            #{tag}
          </Link>
        ))}
        <button type="button" className="chip" onClick={onAddTag}>
          <Plus className="size-3.5" aria-hidden />
          Tag
        </button>
      </div>
    </>
  );
}

export function AnnotationsList({
  highlights,
  orphanIds,
  onJump,
  onEdit,
}: {
  highlights: HighlightItem[];
  orphanIds: Set<string>;
  onJump: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  if (highlights.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Select any passage to highlight it. Notes you attach show up here and under Highlights.
      </p>
    );
  }
  return (
    <ul className="grid gap-5">
      {highlights.map((highlight) => {
        const orphan = orphanIds.has(highlight.id);
        return (
          <li key={highlight.id} className="group/item relative border-l-[3px] py-2.5 pl-4" style={{ borderColor: highlightVar(highlight.color) }}>
            <button
              type="button"
              onClick={() => (orphan ? onEdit(highlight.id) : onJump(highlight.id))}
              className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <q className="block font-serif text-[15px] leading-[1.55] whitespace-pre-line [quotes:none] group-hover/item:text-terracotta-text">
                {highlight.quote}
              </q>
              <span className="mt-2 block text-[13px] text-muted-foreground italic">
                {highlight.note ? highlight.note : <span className="opacity-75">No note yet</span>}
              </span>
              {orphan && (
                <span className="mt-2 block text-[12px] font-medium text-warn not-italic">
                  This passage isn&apos;t in the current text any more.
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onEdit(highlight.id)}
              aria-label="Edit note and colour"
              className="absolute top-1.5 right-0 grid size-8 place-items-center rounded-sm text-muted-foreground opacity-0 transition-opacity group-focus-within/item:opacity-100 group-hover/item:opacity-100 hover:bg-foreground/8 hover:text-foreground pointer-coarse:opacity-100"
            >
              <Pencil className="size-[15px]" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
