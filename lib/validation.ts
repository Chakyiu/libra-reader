import { z } from "zod";
import {
  CollectionColor,
  DocumentType,
  HighlightColor,
  ReaderFont,
  ReadingStatus,
  ThemePreference,
} from "@/lib/generated/prisma/enums";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_NOTE_LENGTH = 200_000;
export const MAX_HIGHLIGHT_NOTE_LENGTH = 10_000;
export const MAX_QUOTE_LENGTH = 5_000;

export const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/i, "Invalid id.");

export const idListSchema = z.array(idSchema).min(1, "Choose at least one item.").max(500);

/**
 * Accepts what people paste: bare hosts get https://, fragments are dropped.
 * Destination safety (private ranges, localhost, DNS) is checked separately
 * in lib/ssrf.ts at fetch time, including for every redirect.
 */
export const urlInputSchema = z
  .string({ error: "Paste an address first." })
  .trim()
  .min(1, "Paste an address first.")
  .max(2048, "That address is too long.")
  .transform((value, ctx) => {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      ctx.addIssue({ code: "custom", message: "That doesn't look like a web address." });
      return z.NEVER;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      ctx.addIssue({ code: "custom", message: "Only http:// and https:// addresses can be saved." });
      return z.NEVER;
    }
    if (url.username || url.password) {
      ctx.addIssue({ code: "custom", message: "Addresses with a username or password can't be saved." });
      return z.NEVER;
    }
    url.hash = "";
    return url.toString();
  });

export const documentTypeSchema = z.enum(DocumentType);
export const readingStatusSchema = z.enum(ReadingStatus);
export const highlightColorSchema = z.enum(HighlightColor);
export const collectionColorSchema = z.enum(CollectionColor);

export const noteInputSchema = z.object({
  title: z.string().trim().max(300, "Keep the title under 300 characters.").default(""),
  body: z.string().max(MAX_NOTE_LENGTH, "That note is too long to save in one piece."),
});

export const documentDetailsSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1, "A title is required.").max(300),
  author: z.string().trim().max(200).optional(),
  publication: z.string().trim().max(200).optional(),
});

/** Tags are stored lowercase and hyphenated: "Urban Design" → "urban-design". */
export function normalizeTagName(raw: string): string {
  return raw
    .normalize("NFKC")
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export const tagNameSchema = z
  .string()
  .max(80)
  .transform(normalizeTagName)
  .refine((value) => value.length > 0, "Tags need at least one letter or number.");

export const tagListSchema = z.array(tagNameSchema).max(30);

/** Parses "urbanism, transit  #systems" into normalized, de-duplicated tag names. */
export function parseTagInput(raw: string): string[] {
  const names = raw
    .split(/[,\n]/)
    .flatMap((part) => part.split(/\s+#/))
    .map(normalizeTagName)
    .filter(Boolean);
  return [...new Set(names)].slice(0, 30);
}

export const collectionInputSchema = z.object({
  name: z.string().trim().min(1, "Give the collection a name.").max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(500, "Keep the description under 500 characters.").default(""),
  color: collectionColorSchema.default("YELLOW"),
  isFavorite: z.boolean().default(false),
});

export const highlightCreateSchema = z
  .object({
    documentId: idSchema,
    quote: z.string().min(1).max(MAX_QUOTE_LENGTH, "That selection is too long to highlight."),
    prefix: z.string().max(64).default(""),
    suffix: z.string().max(64).default(""),
    context: z.string().max(1200).default(""),
    startOffset: z.int().min(0),
    endOffset: z.int().min(1),
    page: z.int().min(1).max(100_000).optional(),
    cfi: z.string().trim().min(1).max(2000, "That book location is too long.").optional(),
    color: highlightColorSchema.default("YELLOW"),
    note: z.string().trim().max(MAX_HIGHLIGHT_NOTE_LENGTH).optional(),
  })
  .refine((value) => value.endOffset > value.startOffset, {
    message: "A highlight needs at least one character.",
    path: ["endOffset"],
  });

export const highlightUpdateSchema = z.object({
  id: idSchema,
  color: highlightColorSchema.optional(),
  note: z.string().trim().max(MAX_HIGHLIGHT_NOTE_LENGTH).nullable().optional(),
});

export const preferenceUpdateSchema = z
  .object({
    theme: z.enum(ThemePreference),
    font: z.enum(ReaderFont),
    fontSize: z.int().min(15).max(26),
    lineHeight: z.number().min(1.4).max(2.1),
    columnWidth: z.int().min(48).max(86),
  })
  .partial();

export const readingLocationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    offset: z.int().min(0),
    ratio: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal("pdf"),
    page: z.int().min(1).max(100_000),
    /** 0 means "fit to width". */
    zoom: z.number().min(0).max(5),
  }),
  z.object({
    kind: z.literal("epub"),
    cfi: z.string().min(1).max(1000),
  }),
]);

export type ReadingLocation = z.infer<typeof readingLocationSchema>;

export function parseReadingLocation(raw: string | null | undefined): ReadingLocation | null {
  if (!raw) return null;
  try {
    const parsed = readingLocationSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const positionUpdateSchema = z.object({
  progress: z.number().min(0).max(1),
  location: readingLocationSchema.optional(),
});

export const fileMetadataSchema = z.object({
  id: idSchema,
  pageCount: z.int().min(1).max(100_000).optional(),
  title: z.string().trim().min(1).max(300).optional(),
  author: z.string().trim().min(1).max(200).optional(),
});

/* ---------------------------------------------------------------- search params */

export const LIBRARY_STATUSES = ["all", "inbox", "reading", "archived", "favorites"] as const;
export const LIBRARY_TYPES = ["all", "article", "pdf", "epub", "note"] as const;
export const LIBRARY_SORTS = ["saved", "title", "progress", "opened"] as const;

const optionalParam = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined))
    .catch(undefined);

export const librarySearchParamsSchema = z.object({
  status: z.enum(LIBRARY_STATUSES).catch("all"),
  type: z.enum(LIBRARY_TYPES).catch("all"),
  sort: z.enum(LIBRARY_SORTS).catch("saved"),
  view: z.enum(["list", "grid"]).catch("list"),
  q: z.string().trim().max(200).catch(""),
  tag: optionalParam(40),
  collection: idSchema.optional().catch(undefined),
});

export type LibraryFilters = z.infer<typeof librarySearchParamsSchema>;

export const highlightSearchParamsSchema = z.object({
  q: z.string().trim().max(200).catch(""),
  color: highlightColorSchema.optional().catch(undefined),
  document: idSchema.optional().catch(undefined),
  collection: idSchema.optional().catch(undefined),
  tag: optionalParam(40),
});

export type HighlightFilters = z.infer<typeof highlightSearchParamsSchema>;

/** Next.js hands search params over as string | string[]; keep the first value. */
export function firstParams(params: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) out[key] = Array.isArray(value) ? value[0] : value;
  return out;
}

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Something in that request wasn't valid.";
}

export const assistPromptSaveSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1, "Name the prompt.").max(60, "Keep the name under 60 characters."),
  body: z.string().trim().min(1, "Write the prompt.").max(2_000, "Keep the prompt under 2,000 characters."),
});

export const assistPromptRunSchema = z.object({
  highlightId: idSchema,
  promptId: idSchema,
});

export const assistConfigSchema = z.object({
  baseUrl: z.string().trim().min(1, "Add the model host address.").max(300, "That address is too long."),
  model: z
    .string()
    .trim()
    .min(1, "Add a model name.")
    .max(80, "That model name is too long.")
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, "Use a model name like gpt-4o-mini or llama3.2."),
  apiKey: z.string().max(500, "That API key is too long.").optional(),
});

export const assistRequestSchema = z
  .object({
    documentId: idSchema,
    kind: z.enum(["SUMMARY", "OUTLINE", "QUESTION", "EXPLAIN"]),
    highlightId: idSchema.optional(),
    question: z.string().trim().max(500, "Keep the question under 500 characters.").optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "QUESTION" && !value.question) {
      ctx.addIssue({ code: "custom", message: "Ask something about this text.", path: ["question"] });
    }
    if (value.kind === "EXPLAIN" && !value.highlightId) {
      ctx.addIssue({ code: "custom", message: "Choose a highlight to explain.", path: ["highlightId"] });
    }
  });
