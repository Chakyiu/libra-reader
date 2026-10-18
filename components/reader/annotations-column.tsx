"use client";

import type { ReactNode } from "react";
import { AnnotationsList, DocumentFacts } from "@/components/reader/annotations-panel";
import { AssistPanel, assistRevision } from "@/components/reader/assist-panel";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DocumentAssist, HighlightItem, ReaderDocument } from "@/lib/types";

/**
 * The Annotations + Document + Assist column. Every reader — article, PDF,
 * EPUB — shows the same list, so it lives here once: a sticky aside from 1180px
 * up, a bottom sheet below that.
 */
export interface AnnotationsPanelProps {
  document: ReaderDocument;
  highlights: HighlightItem[];
  orphanIds: Set<string>;
  onJump: (id: string) => void;
  onEdit: (id: string) => void;
  onAddTag: () => void;
  assist: DocumentAssist;
  assistConfigured: boolean;
}

export function AnnotationsPanelBody({
  document: doc,
  highlights,
  orphanIds,
  onJump,
  onEdit,
  onAddTag,
  assist,
  assistConfigured,
}: AnnotationsPanelProps) {
  return (
    <>
      <div className="mb-5 flex items-baseline gap-2">
        <h2 className="caps">Annotations</h2>
        <span className="count">{highlights.length}</span>
      </div>
      <AnnotationsList highlights={highlights} orphanIds={orphanIds} onJump={onJump} onEdit={onEdit} />
      <hr className="my-6 border-border" />
      <DocumentFacts document={doc} onAddTag={onAddTag} />
      {/* Assist works off extracted text, which only articles and notes carry. */}
      {doc.wordCount > 0 && (
        <>
          <hr className="my-6 border-border" />
          <AssistPanel
            key={assistRevision(assist)}
            documentId={doc.id}
            wordCount={doc.wordCount}
            assist={assist}
            configured={assistConfigured}
          />
        </>
      )}
    </>
  );
}

/** The desktop column. The parent grid gives it its track; see --panel-width. */
export function AnnotationsAside({ body }: { body: ReactNode }) {
  return (
    <aside
      aria-label="Annotations"
      className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto border-l border-border bg-surface px-[26px] pt-[30px] pb-16 xl:block"
    >
      {body}
    </aside>
  );
}

/** The same column folded into a bottom sheet for narrow screens. */
export function AnnotationsSheet({
  open,
  onOpenChange,
  count,
  body,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  body: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Annotations</SheetTitle>
          <span className="caps">{count}</span>
        </SheetHeader>
        <SheetBody>{body}</SheetBody>
      </SheetContent>
    </Sheet>
  );
}
