"use client";

import { HIGHLIGHT_COLORS } from "@/lib/colors";
import type { HighlightColor } from "@/lib/generated/prisma/enums";

/** Named colour choices; the name travels with the swatch so colour is never the only signal. */
export function ColorChips({
  value,
  onChange,
  label = "Highlight colour",
}: {
  value: HighlightColor;
  onChange: (color: HighlightColor) => void;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          role="radio"
          aria-checked={value === color.value}
          onClick={() => onChange(color.value)}
          className="chip pointer-coarse:min-h-10"
        >
          <span className="swatch" style={{ background: color.cssVar }} aria-hidden />
          {color.label}
        </button>
      ))}
    </div>
  );
}
