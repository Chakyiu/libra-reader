import path from "node:path";

const DEFAULT_DATABASE_URL = "file:./data/libra.db";
const DEFAULT_STORAGE_DIR = "./data/uploads";

// The database and uploads are user data chosen at runtime, never part of the
// build output, so these paths are excluded from Turbopack's file tracing.

/** Absolute `file:` URL for the SQLite database; relative paths resolve from the project root. */
export function databaseUrl(): string {
  const raw = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  const file = raw.replace(/^file:/, "");
  return path.isAbsolute(file) ? `file:${file}` : `file:${path.resolve(/*turbopackIgnore: true*/ process.cwd(), file)}`;
}

/** Absolute directory for uploaded PDFs and EPUBs. Never inside /public. */
export function storageDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.LIBRA_STORAGE_DIR || DEFAULT_STORAGE_DIR);
}
