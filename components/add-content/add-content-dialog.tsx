"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type DragEvent, type FormEvent } from "react";
import { cn } from "cn";
import { Check, CircleAlert, FileUp, Link2, LoaderCircle, NotebookPen, RotateCw, Search, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Bookplate } from "@/components/library/bookplate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createNote } from "@/lib/actions/documents";
import { previewUrl, saveUrl, type PreviewState } from "@/lib/actions/import";
import { formatBytes, formatDate, formatMinutes, STATUS_CHIP } from "@/lib/format";
import type { CollectionSummary } from "@/lib/types";
import { MAX_UPLOAD_BYTES, parseTagInput } from "@/lib/validation";

export type AddTab = "url" | "file" | "note";

type UrlPhase = { status: "idle" } | { status: "loading" } | Exclude<PreviewState, { status: "invalid" }>;

function CollectionAndTags({
  collections,
  collectionId,
  onCollectionChange,
  tags,
  onTagsChange,
}: {
  collections: CollectionSummary[];
  collectionId: string;
  onCollectionChange: (value: string) => void;
  tags: string;
  onTagsChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor={`${id}-collection`}>Collection</Label>
        <select
          id={`${id}-collection`}
          className="select-native h-12 w-full bg-well"
          value={collectionId}
          onChange={(event) => onCollectionChange(event.target.value)}
        >
          <option value="">Inbox only</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${id}-tags`}>Tags</Label>
        <Input
          id={`${id}-tags`}
          value={tags}
          onChange={(event) => onTagsChange(event.target.value)}
          placeholder="urbanism, transit"
          autoComplete="off"
        />
      </div>
    </div>
  );
}

function uploadWithProgress(
  file: File,
  fields: Record<string, string>,
  onProgress: (fraction: number) => void,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      const record = (body && typeof body === "object" ? body : {}) as { id?: unknown; error?: unknown };
      if (xhr.status >= 200 && xhr.status < 300 && typeof record.id === "string") resolve({ ok: true, id: record.id });
      else resolve({ ok: false, error: typeof record.error === "string" ? record.error : "The upload failed. Try again." });
    };
    xhr.onerror = () => resolve({ ok: false, error: "The upload was interrupted. Check that Libra is still running." });
    const form = new FormData();
    form.append("file", file);
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    xhr.send(form);
  });
}

function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf") && !name.endsWith(".epub")) return "Only PDF and EPUB files can be added.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return `That file is ${formatBytes(file.size)}. Files can be up to 50 MB.`;
  return null;
}

export function AddContentDialog({
  open,
  onOpenChange,
  collections,
  initialTab,
  initialCollectionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: CollectionSummary[];
  initialTab: AddTab;
  initialCollectionId?: string;
}) {
  const router = useRouter();
  const ids = useId();
  const [tab, setTab] = useState<AddTab>(initialTab);
  const [collectionId, setCollectionId] = useState(initialCollectionId ?? "");
  const [tags, setTags] = useState("");
  const [pending, startTransition] = useTransition();

  // URL
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [phase, setPhase] = useState<UrlPhase>({ status: "idle" });

  // File
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Note
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  const finish = (message: string, id: string, actionLabel: string) => {
    onOpenChange(false);
    toast(message, { action: { label: actionLabel, onClick: () => router.push(`/read/${id}`) } });
    startTransition(() => {
      router.push(collectionId ? `/collections/${collectionId}` : "/library?status=inbox");
      router.refresh();
    });
  };

  const fetchPreview = (allowDuplicate = false) => {
    setUrlError(null);
    if (!url.trim()) {
      setUrlError("Paste an address first.");
      return;
    }
    setPhase({ status: "loading" });
    startTransition(async () => {
      const result = await previewUrl({ url, allowDuplicate });
      if (result.status === "invalid") {
        setPhase({ status: "idle" });
        setUrlError(result.message);
      } else {
        setPhase(result);
      }
    });
  };

  const saveArticle = (linkOnly: boolean) => {
    const token = phase.status === "ready" ? phase.token : undefined;
    startTransition(async () => {
      const result = await saveUrl({ url, token, linkOnly, collectionId: collectionId || undefined, tags });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const where = collectionId ? collections.find((c) => c.id === collectionId)?.name : null;
      finish(
        result.data.linkOnly ? "Link saved to Inbox" : `Saved to ${where ? `Inbox and ${where}` : "Inbox"}`,
        result.data.id,
        result.data.linkOnly ? "Open" : "Read now",
      );
    });
  };

  const chooseFile = (next: File | null) => {
    setFile(next);
    setFileError(next ? validateFile(next) : null);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0] ?? null);
  };

  const upload = () => {
    if (!file) {
      setFileError("Choose a PDF or EPUB first.");
      return;
    }
    const problem = validateFile(file);
    if (problem) {
      setFileError(problem);
      return;
    }
    setUploadProgress(0);
    startTransition(async () => {
      const result = await uploadWithProgress(file, { collectionId, tags }, setUploadProgress);
      setUploadProgress(null);
      if (!result.ok) {
        setFileError(result.error);
        return;
      }
      finish(`Added “${file.name}” to Inbox`, result.id, "Open");
    });
  };

  const saveNote = (event?: FormEvent) => {
    event?.preventDefault();
    if (!noteTitle.trim() && !noteBody.trim()) {
      setNoteError("Write a title or a few words before saving.");
      return;
    }
    setNoteError(null);
    startTransition(async () => {
      const result = await createNote({
        title: noteTitle,
        body: noteBody,
        collectionId: collectionId || undefined,
        tags: parseTagInput(tags),
      });
      if (!result.ok) {
        setNoteError(result.error);
        return;
      }
      finish("Note saved to Inbox", result.data.id, "Open");
    });
  };

  const urlFooter =
    phase.status === "ready" ? (
      <Button size="sm" onClick={() => saveArticle(false)} disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : <Check />}
        Save to library
      </Button>
    ) : (
      <Button size="sm" onClick={() => fetchPreview()} disabled={pending || phase.status === "loading"}>
        {phase.status === "loading" ? <LoaderCircle className="animate-spin" /> : <Search />}
        Fetch preview
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent size="wide" aria-describedby={`${ids}-hint`}>
        <DialogHeader>
          <DialogTitle>Add content</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(value) => setTab(value as AddTab)} className="min-h-0 flex-1">
          <DialogBody>
            <TabsList aria-label="What to add" className="mb-6">
              <TabsTrigger value="url">
                <Link2 aria-hidden />
                <span>
                  <span className="max-sm:hidden">Paste a </span>URL
                </span>
              </TabsTrigger>
              <TabsTrigger value="file">
                <Upload aria-hidden />
                <span>
                  <span className="max-sm:hidden">Upload a </span>file
                </span>
              </TabsTrigger>
              <TabsTrigger value="note">
                <NotebookPen aria-hidden />
                <span>
                  <span className="max-sm:hidden">Write a </span>note
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (phase.status !== "ready") fetchPreview();
                }}
              >
                <Label htmlFor={`${ids}-url`}>Article or page address</Label>
                <Input
                  id={`${ids}-url`}
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    setUrlError(null);
                    if (phase.status !== "idle" && phase.status !== "loading") setPhase({ status: "idle" });
                  }}
                  placeholder="https://example.com/an-article"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  aria-invalid={urlError ? true : undefined}
                  aria-describedby={urlError ? `${ids}-url-error` : undefined}
                />
              </form>
              {urlError && (
                <p id={`${ids}-url-error`} role="alert" className="mt-2.5 flex items-center gap-2 text-[13px] text-err">
                  <CircleAlert className="size-4" aria-hidden />
                  {urlError}
                </p>
              )}

              {phase.status === "loading" && (
                <div
                  className="mt-[22px] grid grid-cols-[90px_minmax(0,1fr)] gap-[18px] rounded-lg border border-border bg-well p-5 max-sm:grid-cols-[72px_minmax(0,1fr)]"
                  aria-live="polite"
                >
                  <span className="plate size-[90px] max-sm:size-[72px]">
                    <span className="plate-frame" />
                  </span>
                  <span className="grid content-start gap-3">
                    <span className="skel w-[70%]" />
                    <span className="skel w-[45%]" />
                    <span className="skel w-[90%]" />
                    <span className="text-[12.5px] text-muted-foreground">Fetching the page and stripping the furniture…</span>
                  </span>
                </div>
              )}

              {phase.status === "ready" && (
                <>
                  <div className="mt-[22px] grid grid-cols-[90px_minmax(0,1fr)] gap-[18px] rounded-lg border border-border bg-well p-5 max-sm:grid-cols-[72px_minmax(0,1fr)]">
                    <Bookplate type="ARTICLE" publication={phase.preview.publication} title={phase.preview.title} size="preview" />
                    <div className="min-w-0">
                      <h3 className="font-serif text-lg leading-snug font-medium text-balance">{phase.preview.title}</h3>
                      <p className="mt-1 text-[12.5px] text-muted-foreground">
                        {[phase.preview.publication, formatMinutes(phase.preview.readingMinutes)].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{phase.preview.excerpt}</p>
                      <p className="mt-3.5 flex items-center gap-2 text-[12.5px] text-muted-foreground">
                        <Check className="size-[15px]" aria-hidden />
                        Readable copy extracted{phase.preview.author ? ` · ${phase.preview.author}` : ""} ·{" "}
                        {phase.preview.wordCount.toLocaleString()} words
                      </p>
                    </div>
                  </div>
                  <CollectionAndTags
                    collections={collections}
                    collectionId={collectionId}
                    onCollectionChange={setCollectionId}
                    tags={tags}
                    onTagsChange={setTags}
                  />
                </>
              )}

              {phase.status === "duplicate" && (
                <div className="state-box mt-[22px]" data-tone="warn" role="status">
                  <TriangleAlert className="mt-px size-[18px] shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="mb-1 text-[13.5px] font-semibold">You already saved this</p>
                    <p className="text-[13px] text-muted-foreground">
                      “{phase.existing.title}” is in your {STATUS_CHIP[phase.existing.status].toLowerCase()}, saved{" "}
                      {formatDate(phase.existing.createdAt)}.
                    </p>
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onOpenChange(false);
                          router.push(`/read/${phase.existing.id}`);
                        }}
                      >
                        Open the one you have
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => fetchPreview(true)}>
                        Save a second copy
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {phase.status === "error" && (
                <div className="state-box mt-[22px]" data-tone="error" role="alert">
                  <CircleAlert className="mt-px size-[18px] shrink-0 text-err" aria-hidden />
                  <div className="min-w-0">
                    <p className="mb-1 text-[13.5px] font-semibold">
                      {phase.code === "BLOCKED" ? "Libra won't fetch that address" : "Couldn't read that page"}
                    </p>
                    <p className="text-[13px] text-muted-foreground">{phase.message}</p>
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      {phase.code !== "BLOCKED" && (
                        <Button variant="outline" size="sm" onClick={() => fetchPreview()} disabled={pending}>
                          <RotateCw />
                          Retry
                        </Button>
                      )}
                      {phase.canSaveLink && (
                        <Button variant="ghost" size="sm" onClick={() => saveArticle(true)} disabled={pending}>
                          Save the link only
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="file">
              <label
                htmlFor={`${ids}-file`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "block cursor-pointer rounded-lg border border-dashed border-border px-7 py-12 text-center transition-colors focus-within:border-terracotta hover:border-foreground/30",
                  dragging && "border-terracotta bg-terracotta/6",
                )}
              >
                <FileUp className="mx-auto mb-4 size-[34px] text-muted-foreground" strokeWidth={1.4} aria-hidden />
                <span className="block font-serif text-[21px] font-medium tracking-[-0.01em]">
                  {file ? file.name : "Drop a PDF or EPUB"}
                </span>
                <span className="mx-auto mt-2 mb-5 block max-w-[46ch] text-[13.5px] leading-relaxed text-muted-foreground">
                  {file
                    ? `${formatBytes(file.size)} · ${file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "EPUB"}`
                    : "Up to 50 MB. The original is kept on this device, outside the web root, and opened in the built-in reader."}
                </span>
                <span className="inline-flex h-10 items-center gap-2 rounded-sm border border-border bg-background px-[15px] text-[13px] font-medium">
                  <Upload className="size-[15px]" aria-hidden />
                  {file ? "Choose a different file" : "Choose a file"}
                </span>
                <input
                  ref={fileInput}
                  id={`${ids}-file`}
                  type="file"
                  accept=".pdf,.epub,application/pdf,application/epub+zip"
                  className="sr-only"
                  onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                />
              </label>
              {fileError && (
                <p role="alert" className="mt-3 flex items-center gap-2 text-[13px] text-err">
                  <CircleAlert className="size-4 shrink-0" aria-hidden />
                  {fileError}
                </p>
              )}
              {uploadProgress !== null && (
                <div className="mt-4 flex items-center gap-3" aria-live="polite">
                  <span className="prog-track">
                    <span className="prog-fill block transition-[width]" style={{ width: `${Math.round(uploadProgress * 100)}%` }} />
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {uploadProgress < 1 ? `Uploading ${Math.round(uploadProgress * 100)}%` : "Processing…"}
                  </span>
                </div>
              )}
              <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">
                PDFs and EPUBs can flip one page at a time or scroll to the next. Select text in a PDF page or an EPUB
                chapter to highlight it, and your notes appear in the annotations panel beside the reader. Embedded
                scripts, forms and links inside files stay inactive.
              </p>
              <CollectionAndTags
                collections={collections}
                collectionId={collectionId}
                onCollectionChange={setCollectionId}
                tags={tags}
                onTagsChange={setTags}
              />
            </TabsContent>

            <TabsContent value="note">
              <form id={`${ids}-note-form`} onSubmit={saveNote}>
                <Label htmlFor={`${ids}-note-title`}>Title</Label>
                <Input
                  id={`${ids}-note-title`}
                  value={noteTitle}
                  onChange={(event) => setNoteTitle(event.target.value)}
                  placeholder="Notes on…"
                  maxLength={300}
                  autoFocus
                />
                <Label htmlFor={`${ids}-note-body`} className="mt-[18px]">
                  Note
                </Label>
                <Textarea
                  id={`${ids}-note-body`}
                  value={noteBody}
                  onChange={(event) => setNoteBody(event.target.value)}
                  placeholder="Write it down before it evaporates."
                  className="min-h-[150px]"
                />
                {noteError && (
                  <p role="alert" className="mt-2.5 flex items-center gap-2 text-[13px] text-err">
                    <CircleAlert className="size-4" aria-hidden />
                    {noteError}
                  </p>
                )}
              </form>
              <CollectionAndTags
                collections={collections}
                collectionId={collectionId}
                onCollectionChange={setCollectionId}
                tags={tags}
                onTagsChange={setTags}
              />
            </TabsContent>
          </DialogBody>
        </Tabs>
        <DialogFooter>
          <p id={`${ids}-hint`} className="text-[12.5px] text-muted-foreground max-sm:hidden">
            Everything lands in your inbox unless you pick a collection.
          </p>
          <span className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          {tab === "url" && urlFooter}
          {tab === "file" && (
            <Button size="sm" onClick={upload} disabled={pending || !file || Boolean(fileError)}>
              {uploadProgress !== null ? <LoaderCircle className="animate-spin" /> : <Upload />}
              Add to library
            </Button>
          )}
          {tab === "note" && (
            <Button size="sm" type="submit" form={`${ids}-note-form`} disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" /> : <Check />}
              Save note
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
