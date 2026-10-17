"use client";

import type { CSSProperties, ReactNode } from "react";
import { Download, Monitor, Moon, Sun } from "lucide-react";
import { ShortcutRow } from "@/components/shell/keyboard-shortcuts";
import { InstallAppButton } from "@/components/shell/pwa";
import { MobileMenuButton } from "@/components/shell/mobile-nav";
import { DisplayControls } from "@/components/reader/display-controls";
import { useReaderPreferences } from "@/components/reader/use-reader-preferences";
import { Button } from "@/components/ui/button";
import type { ThemePreference } from "@/lib/generated/prisma/enums";
import { plural } from "@/lib/format";
import type { LibraryStats } from "@/lib/queries";
import { GLOBAL_SHORTCUTS, READER_SHORTCUTS } from "@/lib/shortcuts";
import type { Preferences } from "@/lib/types";

function Group({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  return (
    <section className="mt-[42px]">
      <h2 className="font-serif text-[21px] leading-[1.3] font-semibold tracking-[-0.015em]">{title}</h2>
      {lede && <p className="mt-1 max-w-[62ch] text-[13.5px] text-muted-foreground">{lede}</p>}
      {children}
    </section>
  );
}

function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-center gap-x-[26px] gap-y-3 border-b border-border py-5 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-[5px] max-w-[52ch] text-[13px] leading-[1.55] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

const THEMES: Array<{ value: ThemePreference; label: string; icon: ReactNode; swatch: CSSProperties }> = [
  {
    value: "LIGHT",
    label: "Ivory",
    icon: <Sun aria-hidden />,
    swatch: { background: "oklch(0.979 0.003 85)", boxShadow: "inset 0 -14px 0 oklch(0.96 0.004 100)" },
  },
  {
    value: "DARK",
    label: "Charcoal",
    icon: <Moon aria-hidden />,
    swatch: { background: "oklch(0.198 0.005 75)", boxShadow: "inset 0 -14px 0 oklch(0.246 0.005 75)" },
  },
  {
    value: "SYSTEM",
    label: "System",
    icon: <Monitor aria-hidden />,
    swatch: { background: "linear-gradient(135deg, oklch(0.979 0.003 85) 50%, oklch(0.198 0.005 75) 50%)" },
  },
];

export function SettingsView({ preferences: initial, stats }: { preferences: Preferences; stats: LibraryStats }) {
  const { preferences, change } = useReaderPreferences(initial);
  const preview = {
    "--read-size": `${preferences.fontSize}px`,
    "--read-lead": String(preferences.lineHeight),
    maxWidth: `${preferences.columnWidth}ch`,
  } as CSSProperties;

  return (
    <div className="mx-auto max-w-[760px] px-[22px] pt-4 pb-24 sm:px-[26px] sm:pt-8 lg:pt-11">
      <header className="flex items-center gap-3">
        <h1 className="font-serif text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[30px]">Settings</h1>
        <MobileMenuButton className="ml-auto -mr-2" />
      </header>

      <Group title="Appearance" lede="Light is warm paper; dark is warm charcoal. Neither uses pure black or white.">
        <Row title="Theme" description="Applies everywhere, including the reader.">
          <div role="radiogroup" aria-label="Theme" className="flex gap-3">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                type="button"
                role="radio"
                aria-checked={preferences.theme === theme.value}
                onClick={() => change({ theme: theme.value })}
                className="w-[96px] rounded-sm border border-border p-3 text-center transition-colors hover:border-foreground/30 aria-checked:border-terracotta aria-checked:shadow-[0_0_0_2px_color-mix(in_oklab,var(--terracotta)_24%,transparent)]"
              >
                <span className="mb-2.5 block h-10 rounded-[4px] border border-border" style={theme.swatch} aria-hidden />
                <span className="flex items-center justify-center gap-1.5 text-[12px] [&_svg]:size-3.5">
                  {theme.icon}
                  {theme.label}
                </span>
              </button>
            ))}
          </div>
        </Row>
        <Row title="Reduce motion" description="Libra follows your system setting. With it on, highlight flashes become a static outline and sheets stop sliding.">
          <span className="chip" data-active="true">
            Follows system
          </span>
        </Row>
      </Group>

      <Group title="Reading" lede="Used by every article and note. Changes from the reader's Display menu land here too.">
        <div className="mt-5 grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <DisplayControls preferences={preferences} onChange={change} showTheme={false} />
          <div className="rounded-lg border border-border bg-well px-6 py-5" aria-label="Preview">
            <p className="caps mb-3">Preview</p>
            <div className="article" data-font={preferences.font} style={preview}>
              <p className="!mb-0">
                A street that cannot be crossed on foot is not a street; it is a wall with traffic on it. The wall is invisible in the
                analysis because walls are not in the units.
              </p>
            </div>
          </div>
        </div>
      </Group>

      <Group title="Keyboard shortcuts" lede="Press ? anywhere to see these.">
        <h3 className="caps mt-5 mb-1">Everywhere</h3>
        {GLOBAL_SHORTCUTS.map((shortcut) => (
          <ShortcutRow key={shortcut.label} shortcut={shortcut} />
        ))}
        <h3 className="caps mt-6 mb-1">While reading</h3>
        {READER_SHORTCUTS.map((shortcut) => (
          <ShortcutRow key={shortcut.label} shortcut={shortcut} />
        ))}
      </Group>

      <Group title="Your data" lede="Everything lives on this device. Nothing is sent anywhere except when you ask Libra to fetch a page.">
        <Row
          title="Export everything as JSON"
          description={`Documents with their text and metadata, ${plural(stats.highlights, "highlight")} and notes, collections, tags, and these preferences. Original PDF and EPUB files stay in the storage folder.`}
        >
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export" download>
              <Download />
              Export JSON
            </a>
          </Button>
        </Row>
        <Row
          title="Install Libra"
          description="Opens in its own window from your dock or home screen. On iPhone, use Share and then Add to Home Screen. Your library stays on this computer, so Libra has to be running."
        >
          <InstallAppButton />
        </Row>
        <Row
          title="Where it's stored"
          description={
            <>
              Database: <code className="font-mono text-[12px] break-all">{stats.databasePath}</code>
              <br />
              Uploaded files: <code className="font-mono text-[12px] break-all">{stats.storagePath}</code>
            </>
          }
        >
          <span className="count">
            {plural(stats.documents, "document")} · {plural(stats.collections, "collection")}
          </span>
        </Row>
      </Group>
    </div>
  );
}
