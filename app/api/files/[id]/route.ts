import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { resolveStoredFile } from "@/lib/storage";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const parsed = idSchema.safeParse((await context.params).id);
  if (!parsed.success) return jsonError("Not found.", 404);

  const document = await db.document.findUnique({
    where: { id: parsed.data },
    select: { filePath: true, fileName: true, mimeType: true, type: true },
  });
  if (!document?.filePath || (document.type !== "PDF" && document.type !== "EPUB")) {
    return jsonError("Not found.", 404);
  }

  let absolute: string;
  try {
    absolute = resolveStoredFile(document.filePath);
  } catch {
    return jsonError("Not found.", 404);
  }
  const info = await stat(absolute).catch(() => null);
  if (!info?.isFile()) return jsonError("The original file is missing from storage.", 404);

  const download = new URL(request.url).searchParams.get("download") === "1";
  const name = document.fileName ?? (document.type === "PDF" ? "document.pdf" : "book.epub");
  const asciiName = name.replace(/[^\x20-\x7e]/g, "_");
  const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream<Uint8Array>;

  return new Response(stream, {
    headers: {
      "Content-Type": document.mimeType ?? "application/octet-stream",
      "Content-Length": String(info.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      // If the file is ever opened directly, it gets no script, no network, no origin.
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Cache-Control": "private, no-cache",
    },
  });
}
