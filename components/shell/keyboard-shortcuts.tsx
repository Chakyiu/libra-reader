"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAddContent } from "@/components/shell/add-content-context";
import { applyTheme, effectiveTheme } from "@/components/shell/theme";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { updatePreferences } from "@/lib/actions/preferences";
import { GLOBAL_SHORTCUTS, isOverlayOpen, isTypingTarget, READER_SHORTCUTS, type Shortcut } from "@/lib/shortcuts";

export function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border py-3 last:border-b-0">
      <span className="text-[13.5px]">{shortcut.label}</span>
      <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        {shortcut.keys.map((key, index) => (
          <span key={key} className="flex items-center gap-1.5">
            {index > 0 && <span>{shortcut.sequence ? "then" : "or"}</span>}
            <kbd className="kbd">{key}</kbd>
          </span>
        ))}
      </span>
    </div>
  );
}

const CHORDS: Record<string, string> = { l: "/library", h: "/highlights", c: "/collections", s: "/settings" };

/** App-wide keys. Reader keys live in the reader so they can act on the selection. */
export function KeyboardShortcuts() {
  const router = useRouter();
  const { openAddContent } = useAddContent();
  const [helpOpen, setHelpOpen] = useState(false);
  const chord = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (isOverlayOpen()) return;

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const pending = chord.current;
      chord.current = null;
      if (pending && Date.now() - pending.at < 1200) {
        const destination = CHORDS[key];
        if (destination) {
          event.preventDefault();
          router.push(destination);
          return;
        }
      }

      if (key === "g") {
        chord.current = { key, at: Date.now() };
      } else if (key === "/") {
        event.preventDefault();
        router.push("/search");
      } else if (key === "a") {
        event.preventDefault();
        openAddContent();
      } else if (key === "t") {
        const next = effectiveTheme() === "dark" ? "LIGHT" : "DARK";
        applyTheme(next);
        void updatePreferences({ theme: next });
      } else if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, openAddContent]);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <DialogBody className="pt-3">
          <h3 className="caps mt-2 mb-1">Everywhere</h3>
          {GLOBAL_SHORTCUTS.map((shortcut) => (
            <ShortcutRow key={shortcut.label} shortcut={shortcut} />
          ))}
          <h3 className="caps mt-6 mb-1">While reading</h3>
          {READER_SHORTCUTS.map((shortcut) => (
            <ShortcutRow key={shortcut.label} shortcut={shortcut} />
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
