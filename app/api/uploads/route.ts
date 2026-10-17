import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { detectUploadKind, readEpub } from "@/lib/files";
import { isSameOriginRequest, jsonError } from "@/lib/http";
import { countWords, estimateReadingMinutes, excerptFromLines, titleFromFileName } from "@/lib/reading";
import { deleteStoredFile, safeFileName, saveUpload } from "@/lib/storage";
import { attachTags } from "@/lib/tags";
import { idSchema, MAX_UPLOAD_BYTES, parseTagInput } from "@/lib/validation";

export const runtime = "nodejs";

const MIME = { PDF: "application/pdf", EPUB: "application/epub+zip" } as const;

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return jsonError("Uploads from other sites aren't allowed.", 403);

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_UPLOAD_BYTES + 1024 * 1024) return jsonError("Files can be up to 50 MB.", 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("The upload didn't arrive intact. Try again.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Choose a PDF or EPUB file to upload.", 400);
  if (file.size === 0) return jsonError("That file is empty.", 400);
  if (file.size > MAX_UPLOAD_BYTES) return jsonError("Files can be up to 50 MB.", 413);

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = detectUploadKind(buffer, file.name);
  if (!kind) {
    return jsonError("Only PDF and EPUB files can be added, and the file's contents must match its extension.", 415);
  }

  const rawCollection = form.get("collectionId");
  const collection = typeof rawCollection === "string" && rawCollection ? idSchema.safeParse(rawCollection) : null;
  if (collection && !collection.success) return jsonError("That collection doesn't exist.", 400);
  const collectionId = collection?.success ? collection.data : undefined;
  if (collectionId && !(await db.collection.findUnique({ where: { id: collectionId }, select: { id: true } }))) {
    return jsonError("That collection doesn't exist.", 400);
  }
  const rawTags = form.get("tags");
  const tags = typeof rawTags === "string" ? parseTagInput(rawTags.slice(0, 500)) : [];

  const epub = kind === "EPUB" ? await readEpub(buffer) : null;
  if (kind === "EPUB" && !epub) return jsonError("That EPUB couldn't be opened. It may be damaged.", 422);
  if (epub?.drm) return jsonError("That EPUB is DRM-protected, so Libra can't open it.", 422);

  const fileName = safeFileName(file.name, kind === "PDF" ? "document.pdf" : "book.epub");
  const { relativePath } = await saveUpload(buffer, kind === "PDF" ? "pdf" : "epub");
  const text = epub?.text ?? "";

  try {
    const document = await db.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          type: kind,
          title: epub?.title || titleFromFileName(fileName),
          author: epub?.author ?? null,
          publication: epub?.publisher ?? null,
          filePath: relativePath,
          fileName,
          fileSize: file.size,
          mimeType: MIME[kind],
          contentText: text || null,
          excerpt: text ? excerptFromLines(text) : null,
          wordCount: text ? countWords(text) : 0,
          readingMinutes: text ? estimateReadingMinutes(text) : null,
          importStatus: "READY",
        },
        select: { id: true, title: true },
      });
      if (collectionId) await tx.documentCollection.create({ data: { documentId: created.id, collectionId } });
      if (tags.length) await attachTags(tx, [created.id], tags);
      return created;
    });
    revalidatePath("/", "layout");
    return Response.json(document, { status: 201 });
  } catch (error) {
    await deleteStoredFile(relativePath);
    throw error;
  }
}
