"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "cn";
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronLeft,
  CircleAlert,
  Download,
  EllipsisVertical,
  ExternalLink,
  Folder,
  LoaderCircle,
  NotebookPen,
  PanelRight,
  Pencil,
  RotateCw,
  Sparkles,
  Star,
  Tag,
  Trash,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { CollectionDialog, DeleteDocumentsDialog, TagDialog } from "@/components/documents/document-dialogs";
import { useDocumentCommands } from "@/components/documents/use-document-commands";
import { ArticleReader } from "@/components/reader/article-reader";
import { AssistPanel, assistRevision } from "@/components/reader/assist-panel";
import { DisplayControls } from "@/components/reader/display-controls";
import { DocumentDetailsDialog } from "@/components/reader/document-details-dialog";
import { NoteEditor } from "@/components/reader/note-editor";
import { usePersistentFlag } from "@/components/reader/use-persistent-flag";
import { useReaderPreferences } from "@/components/reader/use-reader-preferences";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { retryImport } from "@/lib/actions/import";
import { TYPE_LABEL } from "@/lib/format";
import { isOverlayOpen, isTypingTarget } from "@/lib/shortcuts";
import type { CollectionSummary, DocumentAssist, HighlightItem, Preferences, ReaderDocument } from "@/lib/types";

function ReaderLoading({ label }: { label: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center text-[13px] text-muted-foreground" role="status">
      <span className="flex items-center gap-2.5">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {label}
      </span>
    </div>
  );
}

const PdfReader = dynamic(() => import("@/components/reader/pdf-reader").then((m) => m.PdfReader), {
  ssr: false,
  loading: () => <ReaderLoading label="Opening the PDF…" />,
});

const EpubReader = dynamic(() => import("@/components/reader/epub-reader").then((m) => m.EpubReader), {
  ssr: false,
  loading: () => <ReaderLoading label="Opening the book…" />,
});

function IconAction({
  label,
  onClick,
  pressed,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="quiet"
          size="icon"
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          className={cn("aria-[pressed=true]:border-transparent aria-[pressed=true]:bg-transparent aria-[pressed=true]:text-terracotta", className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function LinkOnlyPanel({ document }: { document: ReaderDocument }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="mx-auto max-w-[640px] px-[22px] pt-10 pb-36 sm:px-11">
      <h1 className="font-serif text-[30px] leading-[1.14] font-semibold tracking-[-0.025em] text-balance break-words sm:text-[38px]">
        {document.title}
      </h1>
      <p className="mt-3 text-[13px] text-muted-foreground">{[document.publication, "Article", "link only"].filter(Boolean).join(" · ")}</p>
      <div className="state-box mt-8" data-tone="warn">
        <CircleAlert className="mt-px size-[18px] shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="mb-1 text-[13.5px] font-semibold">There&apos;s no readable copy of this page</p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Libra kept the address only{document.importError ? `: ${document.importError}` : "."} Nothing below the title was
            invented. You can open the original, or try fetching a readable copy again.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {document.sourceUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={document.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  Open the original
                </a>
              </Button>
            )}
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await retryImport(document.id);
                  if (result.ok) toast(`Saved a readable copy of “${result.data.title}”`);
                  else toast.error(result.error);
                })
              }
            >
              {pending ? <LoaderCircle className="animate-spin" /> : <RotateCw />}
              Try again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReaderView({
  document,
  highlights,
  collections,
  allTags,
  preferences: initialPreferences,
  assist,
  assistConfigured,
  focusHighlightId,
}: {
  document: ReaderDocument;
  highlights: HighlightItem[];
  collections: CollectionSummary[];
  allTags: string[];
  preferences: Preferences;
  assist: DocumentAssist;
  assistConfigured: boolean;
  focusHighlightId?: string;
}) {
  const router = useRouter();
  const { preferences, change } = useReaderPreferences(initialPreferences);
  const commands = useDocumentCommands();
  const progressLine = useRef<HTMLDivElement>(null);
  const [panelOpen, setPanelOpen] = usePersistentFlag("libra:annotations-panel", true);
  const [annotationsOpen, setAnnotationsOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [displaySheetOpen, setDisplaySheetOpen] = useState(false);
  const [dialog, setDialog] = useState<"tag" | "collection" | "delete" | "details" | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [barHidden, setBarHidden] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);

  const isArticle = Boolean(document.contentHtml) && (document.type === "ARTICLE" || document.type === "NOTE");
  const archived = document.status === "ARCHIVED";
  const backHref = archived ? "/library?status=archived" : "/library";
  const crumb = document.collections[0]?.name ?? "Library";

  const togglePanel = () => setPanelOpen(!panelOpen);

  const toggleArchive = () => (archived ? commands.restore([document.id], document.title) : commands.archive([document.id], document.title));

  const showAnnotations = () => {
    if (window.matchMedia("(min-width: 1180px)").matches) togglePanel();
    else setAnnotationsOpen(true);
  };

  // Auto-hide the bar while scrolling down on small screens; any upward scroll brings it back.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (window.innerWidth >= 1024) {
        setBarHidden(false);
      } else if (y > 120 && y - last > 6) {
        setBarHidden(true);
      } else if (last - y > 6 || y < 60) {
        setBarHidden(false);
      }
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (isOverlayOpen()) return;
      const key = event.key.toLowerCase();
      if (key === "f") commands.toggleFavorite([document.id], !document.isFavorite, document.title);
      else if (key === "e") toggleArchive();
      else if (event.key === "]" && isArticle) showAnnotations();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const endcap = (
    <div className="mt-[58px] flex flex-wrap items-center gap-3 border-t border-border pt-8 font-sans text-[13.5px] text-muted-foreground">
      <span className="w-full sm:w-auto">You&apos;re at the end of this {TYPE_LABEL[document.type].toLowerCase()}.</span>
      {archived ? (
        <>
          <span className="chip" data-active="true">
            <Check className="size-3.5" aria-hidden />
            Archived
          </span>
          <Button variant="outline" size="sm" onClick={toggleArchive}>
            <ArchiveRestore />
            Restore
          </Button>
        </>
      ) : (
        <Button size="sm" onClick={toggleArchive}>
          <Archive />
          Archive it
        </Button>
      )}
      <Button variant="outline" size="sm" asChild>
        <Link href={backHref}>Back to {archived ? "Archived" : "Library"}</Link>
      </Button>
    </div>
  );

  return (
    <div className="min-h-dvh">
      <div
        className={cn(
          "sticky top-0 z-30 flex min-h-14 items-center gap-1 border-b border-border bg-background/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-[10px] transition-transform duration-200 sm:px-4",
          barHidden && "max-lg:-translate-y-full",
        )}
        role="toolbar"
        aria-label="Reader"
      >
        <Button variant="quiet" size="icon" asChild>
          <Link href={backHref} aria-label={`Back to ${archived ? "Archived" : "Library"}`}>
            <ChevronLeft />
          </Link>
        </Button>
        <span className="max-w-[300px] min-w-0 truncate text-[13px] text-muted-foreground max-md:hidden">
          {crumb} / {document.title}
        </span>
        <span className="flex-1" />
        <IconAction
          label={document.isFavorite ? "Remove from favorites" : "Add to favorites"}
          pressed={document.isFavorite}
          onClick={() => commands.toggleFavorite([document.id], !document.isFavorite, document.title)}
        >
          <Star className={cn(document.isFavorite && "fill-current")} />
        </IconAction>
        <IconAction label="Add a tag" onClick={() => setDialog("tag")} className="max-sm:hidden">
          <Tag />
        </IconAction>
        <IconAction label="Collections" onClick={() => setDialog("collection")} className="max-sm:hidden">
          <Folder />
        </IconAction>
        <IconAction label={archived ? "Restore to library" : "Archive"} onClick={toggleArchive}>
          {archived ? <ArchiveRestore /> : <Archive />}
        </IconAction>
        {document.wordCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!isArticle) {
                setAssistOpen(true);
                return;
              }
              if (window.matchMedia("(min-width: 1180px)").matches) setPanelOpen(true);
              else setAnnotationsOpen(true);
            }}
          >
            <Sparkles />
            Assist
          </Button>
        )}
        <span aria-hidden className="mx-1 h-5 w-px bg-border max-sm:hidden" />
        {isArticle && (
          <>
            <Popover open={displayOpen} onOpenChange={setDisplayOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="max-lg:hidden">
                  <Type />
                  Display
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[300px]" aria-label="Reading display">
                <h2 className="caps mb-3.5">Reading display</h2>
                <DisplayControls preferences={preferences} onChange={change} />
              </PopoverContent>
            </Popover>
            <Button variant="quiet" size="icon" className="lg:hidden" aria-label="Reading settings" onClick={() => setDisplaySheetOpen(true)}>
              <Type />
            </Button>
            <IconAction label={panelOpen ? "Hide annotations" : "Show annotations"} pressed={panelOpen} onClick={togglePanel} className="max-xl:hidden">
              <PanelRight />
            </IconAction>
            <Button variant="quiet" size="icon" className="xl:hidden" aria-label="Annotations" onClick={() => setAnnotationsOpen(true)}>
              <NotebookPen />
            </Button>
          </>
        )}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="quiet" size="icon" aria-label="More actions">
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {document.type === "NOTE" && (
              <DropdownMenuItem onSelect={() => setEditingNote(true)}>
                <Pencil />
                Edit note
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setDialog("details")}>
              <Pencil />
              Edit title and author
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog("tag")} className="sm:hidden">
              <Tag />
              Add a tag…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog("collection")} className="sm:hidden">
              <Folder />
              Collections…
            </DropdownMenuItem>
            {document.sourceUrl && (
              <DropdownMenuItem asChild>
                <a href={document.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  Open the original
                </a>
              </DropdownMenuItem>
            )}
            {(document.type === "PDF" || document.type === "EPUB") && (
              <DropdownMenuItem asChild>
                <a href={`/api/files/${document.id}?download=1`} download>
                  <Download />
                  Download the original file
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
              <Trash />
              Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div ref={progressLine} aria-hidden className="absolute bottom-[-1px] left-0 h-0.5 w-0 bg-terracotta transition-[width] duration-100" />
      </div>

      {document.type === "NOTE" && editingNote ? (
        <NoteEditor
          id={document.id}
          title={document.title}
          body={document.noteBody ?? ""}
          hasHighlights={highlights.length > 0}
          onDone={() => setEditingNote(false)}
        />
      ) : isArticle && document.contentHtml ? (
        <ArticleReader
          key={document.id}
          document={{ ...document, contentHtml: document.contentHtml }}
          highlights={highlights}
          preferences={preferences}
          assist={assist}
          assistConfigured={assistConfigured}
          focusHighlightId={focusHighlightId}
          panelOpen={panelOpen}
          annotationsOpen={annotationsOpen}
          onAnnotationsOpenChange={setAnnotationsOpen}
          progressLineRef={progressLine}
          onAddTag={() => setDialog("tag")}
          endcap={endcap}
        />
      ) : document.type === "PDF" ? (
        <PdfReader document={document} progressLineRef={progressLine} />
      ) : document.type === "EPUB" ? (
        <EpubReader document={document} progressLineRef={progressLine} />
      ) : (
        <LinkOnlyPanel document={document} />
      )}

      <Sheet open={assistOpen} onOpenChange={setAssistOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Assist</SheetTitle>
          </SheetHeader>
          <SheetBody className="pb-[max(2rem,env(safe-area-inset-bottom))]">
            <AssistPanel
              key={assistRevision(assist)}
              documentId={document.id}
              wordCount={document.wordCount}
              assist={assist}
              configured={assistConfigured}
              showHeading={false}
            />
          </SheetBody>
        </SheetContent>
      </Sheet>

      <Sheet open={displaySheetOpen} onOpenChange={setDisplaySheetOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Reading</SheetTitle>
          </SheetHeader>
          <SheetBody className="pb-[max(2rem,env(safe-area-inset-bottom))]">
            <DisplayControls preferences={preferences} onChange={change} showWidth={false} />
          </SheetBody>
        </SheetContent>
      </Sheet>

      <TagDialog
        open={dialog === "tag"}
        onOpenChange={(open) => !open && setDialog(null)}
        ids={[document.id]}
        title={document.title}
        existingTags={allTags.filter((tag) => !document.tags.includes(tag))}
      />
      <CollectionDialog
        open={dialog === "collection"}
        onOpenChange={(open) => !open && setDialog(null)}
        ids={[document.id]}
        title={document.title}
        collections={collections}
        memberOf={document.collections.map((c) => c.id)}
      />
      <DocumentDetailsDialog document={document} open={dialog === "details"} onOpenChange={(open) => !open && setDialog(null)} />
      <DeleteDocumentsDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        ids={[document.id]}
        title={document.title}
        onDeleted={() => router.push("/library")}
      />
    </div>
  );
}
