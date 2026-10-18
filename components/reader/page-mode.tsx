"use client";

import { useState } from "react";

export type PageMode = "flip" | "scroll";

const KEY = "libra-page-mode";

function storedMode(): PageMode {
  if (typeof window === "undefined") return "flip";
  return localStorage.getItem(KEY) === "scroll" ? "scroll" : "flip";
}

/** Flip turns one page at a time. Scroll lays the pages out so the next one is below. Shared by the PDF and EPUB readers. */
export function usePageMode(): [PageMode, (mode: PageMode) => void] {
  const [mode, setMode] = useState<PageMode>(storedMode);
  const update = (next: PageMode) => {
    setMode(next);
    localStorage.setItem(KEY, next);
  };
  return [mode, update];
}

export function PageModeToggle({ mode, onChange }: { mode: PageMode; onChange: (mode: PageMode) => void }) {
  return (
    <div role="group" aria-label="How pages move" className="flex rounded-md border border-border p-0.5">
      {(
        [
          ["flip", "Flip"],
          ["scroll", "Scroll"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          className="h-8 rounded-[5px] px-2.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[pressed=true]:bg-foreground/8 aria-[pressed=true]:text-foreground"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
