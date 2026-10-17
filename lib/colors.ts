import type { CollectionColor, HighlightColor } from "@/lib/generated/prisma/enums";

/** Highlight colours carry names so colour is never the only signal. */
export const HIGHLIGHT_COLORS: Array<{ value: HighlightColor; label: string; cssVar: string }> = [
  { value: "YELLOW", label: "Yellow", cssVar: "var(--hl-yellow)" },
  { value: "SAGE", label: "Sage", cssVar: "var(--hl-sage)" },
  { value: "BLUE", label: "Blue", cssVar: "var(--hl-blue)" },
  { value: "BLUSH", label: "Blush", cssVar: "var(--hl-blush)" },
];

export const HIGHLIGHT_LABEL: Record<HighlightColor, string> = {
  YELLOW: "Yellow",
  SAGE: "Sage",
  BLUE: "Blue",
  BLUSH: "Blush",
};

export function highlightVar(color: HighlightColor): string {
  return `var(--hl-${color.toLowerCase()})`;
}

export const COLLECTION_COLORS: Array<{ value: CollectionColor; label: string; cssVar: string }> = [
  { value: "YELLOW", label: "Yellow", cssVar: "var(--hl-yellow)" },
  { value: "SAGE", label: "Sage", cssVar: "var(--hl-sage)" },
  { value: "BLUE", label: "Blue", cssVar: "var(--hl-blue)" },
  { value: "BLUSH", label: "Blush", cssVar: "var(--hl-blush)" },
  { value: "TERRACOTTA", label: "Terracotta", cssVar: "var(--terracotta)" },
  { value: "STONE", label: "Stone", cssVar: "var(--ink-muted)" },
];

export function collectionVar(color: CollectionColor): string {
  return COLLECTION_COLORS.find((c) => c.value === color)?.cssVar ?? "var(--ink-muted)";
}
