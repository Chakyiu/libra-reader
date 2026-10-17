import { db } from "@/lib/db";
import { isSameOriginRequest, jsonError } from "@/lib/http";
import { idSchema, positionUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Saves reading position. A route rather than a Server Action so it also
 * works from navigator.sendBeacon while the page is closing.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!isSameOriginRequest(request)) return jsonError("Not allowed.", 403);
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError("Not found.", 404);

  const raw = await request.text();
  if (raw.length > 4096) return jsonError("Too large.", 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError("Invalid JSON.", 400);
  }
  const input = positionUpdateSchema.safeParse(body);
  if (!input.success) return jsonError("Invalid position.", 400);

  const document = await db.document.findUnique({ where: { id: id.data }, select: { progress: true, status: true } });
  if (!document) return jsonError("Not found.", 404);

  const progress = Math.max(document.progress, input.data.progress);
  const statusChanged = document.status === "INBOX" && input.data.progress > 0.02;
  await db.document.update({
    where: { id: id.data },
    data: {
      progress,
      lastOpenedAt: new Date(),
      ...(input.data.location ? { readingLocation: JSON.stringify(input.data.location) } : {}),
      ...(statusChanged ? { status: "READING" } : {}),
    },
  });
  return Response.json({ ok: true, progress, statusChanged }, { headers: { "Cache-Control": "no-store" } });
}
