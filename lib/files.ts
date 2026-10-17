import path from "node:path";
import { Parser } from "htmlparser2";
import JSZip from "jszip";
import { collapseWhitespace } from "@/lib/reading";
import { htmlToPlainText } from "@/lib/sanitize";

export type UploadKind = "PDF" | "EPUB";

const PDF_MAGIC = Buffer.from("%PDF-");
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Identifies uploads by their bytes, not their name or the browser's MIME
 * guess. The extension must agree with the content.
 */
export function detectUploadKind(buffer: Buffer, fileName: string): UploadKind | null {
  const ext = path.extname(fileName).toLowerCase();
  const head = buffer.subarray(0, 1024);
  if (ext === ".pdf" && head.includes(PDF_MAGIC)) return "PDF";
  if (ext === ".epub" && buffer.subarray(0, 4).equals(ZIP_MAGIC)) return "EPUB";
  return null;
}

export interface EpubDetails {
  title: string | null;
  author: string | null;
  publisher: string | null;
  text: string;
  /** Adobe-style DRM: the content is encrypted and can't be rendered here. */
  drm: boolean;
}

const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_TEXT_BYTES = 60 * 1024 * 1024;
const MAX_TEXT_CHARS = 3_000_000;
const MAX_SPINE_ITEMS = 600;

interface ZipEntryInternals {
  _data?: { uncompressedSize?: number };
}

function uncompressedSize(file: JSZip.JSZipObject): number {
  return (file as unknown as ZipEntryInternals)._data?.uncompressedSize ?? 0;
}

async function readText(zip: JSZip, name: string): Promise<string | null> {
  const file = zip.file(name);
  if (!file || uncompressedSize(file) > MAX_ENTRY_BYTES) return null;
  return file.async("string");
}

interface OpfData {
  title: string | null;
  creator: string | null;
  publisher: string | null;
  manifest: Map<string, { href: string; type: string }>;
  spine: string[];
}

function parseOpf(xml: string): OpfData {
  const data: OpfData = { title: null, creator: null, publisher: null, manifest: new Map(), spine: [] };
  const wanted = new Set(["title", "creator", "publisher"]);
  let current: "title" | "creator" | "publisher" | null = null;
  let buffer = "";
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        const local = name.toLowerCase().split(":").pop() ?? "";
        if (wanted.has(local) && data[local as "title"] === null && current === null) {
          current = local as "title" | "creator" | "publisher";
          buffer = "";
        }
        if (local === "item" && attrs.id && attrs.href) {
          data.manifest.set(attrs.id, { href: attrs.href, type: attrs["media-type"] ?? "" });
        }
        if (local === "itemref" && attrs.idref && attrs.linear !== "no") data.spine.push(attrs.idref);
      },
      ontext(text) {
        if (current) buffer += text;
      },
      onclosetag(name) {
        const local = name.toLowerCase().split(":").pop() ?? "";
        if (current && local === current) {
          data[current] = collapseWhitespace(buffer) || null;
          current = null;
        }
      },
    },
    { xmlMode: true, decodeEntities: true },
  );
  parser.write(xml);
  parser.end();
  return data;
}

/**
 * Validates an EPUB container and reads its title, author, publisher and
 * spine text (for search and reading time). Entry sizes are checked before
 * inflating, so a zip bomb can't exhaust memory.
 */
export async function readEpub(buffer: Buffer): Promise<EpubDetails | null> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return null;
  }

  const mimetype = (await readText(zip, "mimetype"))?.trim();
  if (mimetype && mimetype !== "application/epub+zip") return null;

  const container = await readText(zip, "META-INF/container.xml");
  const opfPath = container ? /full-path\s*=\s*["']([^"']+)["']/i.exec(container)?.[1] : undefined;
  if (!opfPath) return null;

  const opfXml = await readText(zip, opfPath);
  if (!opfXml) return null;
  const opf = parseOpf(opfXml);
  const base = path.posix.dirname(opfPath);

  if (zip.file("META-INF/rights.xml")) {
    return { title: opf.title, author: opf.creator, publisher: opf.publisher, text: "", drm: true };
  }

  let text = "";
  let inflated = 0;
  for (const idref of opf.spine.slice(0, MAX_SPINE_ITEMS)) {
    const item = opf.manifest.get(idref);
    if (!item || !/x?html/i.test(item.type || item.href)) continue;
    let href: string;
    try {
      href = decodeURIComponent(item.href.split("#")[0] ?? "");
    } catch {
      continue;
    }
    const entryName = path.posix.normalize(base === "." ? href : `${base}/${href}`);
    const entry = zip.file(entryName);
    if (!entry) continue;
    const size = uncompressedSize(entry);
    if (size > MAX_ENTRY_BYTES || inflated + size > MAX_TOTAL_TEXT_BYTES) break;
    inflated += size;
    const html = await entry.async("string");
    text += `${htmlToPlainText(html)}\n`;
    if (text.length > MAX_TEXT_CHARS) {
      text = text.slice(0, MAX_TEXT_CHARS);
      break;
    }
  }

  return {
    title: opf.title?.slice(0, 300) ?? null,
    author: opf.creator?.slice(0, 200) ?? null,
    publisher: opf.publisher?.slice(0, 200) ?? null,
    text: text.trim(),
    drm: false,
  };
}
