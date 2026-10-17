import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { storageDir } from "@/lib/env";

export type StoredKind = "pdf" | "epub";

/** Writes an upload under the storage directory with a random name; never reuses the user's filename. */
export async function saveUpload(buffer: Buffer, kind: StoredKind): Promise<{ relativePath: string }> {
  const dir = storageDir();
  await mkdir(dir, { recursive: true });
  const relativePath = `${randomUUID()}.${kind}`;
  await writeFile(path.join(/*turbopackIgnore: true*/ dir, relativePath), buffer, { flag: "wx", mode: 0o600 });
  return { relativePath };
}

/** Absolute path for a stored file, refusing anything that escapes the storage directory. */
export function resolveStoredFile(relativePath: string): string {
  const dir = storageDir();
  const absolute = path.resolve(/*turbopackIgnore: true*/ dir, relativePath);
  if (!absolute.startsWith(dir + path.sep)) {
    throw new Error("Stored file path escapes the storage directory.");
  }
  return absolute;
}

export async function deleteStoredFile(relativePath: string | null | undefined): Promise<void> {
  if (!relativePath) return;
  try {
    await rm(resolveStoredFile(relativePath), { force: true });
  } catch {
    // A missing or unreachable file shouldn't block deleting the record.
  }
}

/** Keeps a display filename to safe characters for Content-Disposition. */
export function safeFileName(name: string, fallback: string): string {
  const base = path.basename(name).replace(/[\u0000-\u001f\u007f"\\/]/g, "").trim();
  return base.slice(0, 180) || fallback;
}
