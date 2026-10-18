"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { cn } from "cn";
import { ChevronLeft, ChevronRight, Download, Monitor, Moon, Sun } from "lucide-react";
import { AssistPromptSettings } from "@/components/settings/assist-prompts";
import { AssistSettings } from "@/components/settings/assist-settings";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "@/components/settings/sections";
import { ShortcutRow } from "@/components/shell/keyboard-shortcuts";
import { MobileMenuButton } from "@/components/shell/mobile-nav";
import { InstallAppButton } from "@/components/shell/pwa";
import { DisplayControls } from "@/components/reader/display-controls";
import { useReaderPreferences } from "@/components/reader/use-reader-preferences";
import { Button } from "@/components/ui/button";
import type { ThemePreference } from "@/lib/generated/prisma/enums";
import { plural } from "@/lib/format";
import type { LibraryStats } from "@/lib/queries";
import { GLOBAL_SHORTCUTS, READER_SHORTCUTS } from "@/lib/shortcuts";
import type { AssistPromptItem, AssistStatus, Preferences } from "@/lib/types";

const SettingsContext = createContext<{
  preferences: Preferences;
  change: (patch: Partial<Preferences>) => void;
  stats: LibraryStats;
  assist: AssistStatus;
  prompts: AssistPromptItem[];
} | null>(null);

function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("Settings sections render inside the settings layout.");
  return value;
}

function currentSection(pathname: string, id: SettingsSectionId) {
  if (id === "appearance") return pathname === "/settings" || pathname === "/settings/appearance";
  return pathname === `/settings/${id}`;
}

export function SettingsFrame({
  preferences: initial,
  stats,
  assist,
  prompts,
  children,
}: {
  preferences: Preferences;
  stats: LibraryStats;
  assist: AssistStatus;
  prompts: AssistPromptItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const reader = useReaderPreferences(initial);
  const onIndex = pathname === "/settings";
  const active = SETTINGS_SECTIONS.find((section) => currentSection(pathname, section.id));
  const title = onIndex ? "Settings" : (active?.label ?? "Settings");

  return (
    <SettingsContext.Provider value={{ ...reader, stats, assist, prompts }}>
      <div className="mx-auto w-full max-w-[960px] px-[22px] pt-4 pb-24 sm:px-[26px] sm:pt-8 lg:pt-11">
        <header>
          {!onIndex && (
            <Link
              href="/settings"
              className="mb-2 inline-flex items-center gap-0.5 text-[13px] font-medium text-terracotta-text md:hidden"
            >
              <ChevronLeft className="size-4" aria-hidden />
              Settings
            </Link>
          )}
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[30px]">
              <span className="md:hidden">{title}</span>
              <span className="hidden md:inline">Settings</span>
            </h1>
            <MobileMenuButton className="ml-auto -mr-2" />
          </div>
        </header>

        <div className="mt-8 md:grid md:grid-cols-[196px_minmax(0,1fr)] md:items-start md:gap-x-12">
          <nav aria-label="Settings" className={cn("md:sticky md:top-8", onIndex ? "block" : "hidden md:block")}>
            <ul className="md:grid md:gap-0.5">
              {SETTINGS_SECTIONS.map((section) => {
                const current = currentSection(pathname, section.id);
                return (
                  <li key={section.id} className="border-b border-border md:border-0">
                    <Link
                      href={`/settings/${section.id}`}
                      aria-current={current ? "page" : undefined}
                      className="flex items-center gap-3 py-4 text-foreground transition-colors hover:text-terracotta-text md:rounded-sm md:px-3 md:py-2 md:hover:bg-foreground/6 md:hover:text-foreground md:aria-[current=page]:bg-terracotta/13 md:aria-[current=page]:font-semibold md:aria-[current=page]:text-terracotta-text pointer-coarse:md:py-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium md:text-[13.5px]">{section.label}</span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground md:hidden">{section.description}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground md:hidden" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className={cn("@container min-w-0", onIndex && "hidden md:block")}>{children}</div>
        </div>
      </div>
    </SettingsContext.Provider>
  );
}

function Section({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <section aria-labelledby="settings-section-title">
      <h2 id="settings-section-title" className="hidden font-serif text-[21px] leading-[1.3] font-semibold tracking-[-0.015em] md:block">
        {title}
      </h2>
      <p className="max-w-[62ch] text-[13.5px] text-muted-foreground md:mt-1">{lede}</p>
      {children}
    </section>
  );
}

function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-start gap-x-[26px] gap-y-3 border-b border-border py-5 @min-[36rem]:grid-cols-[minmax(0,1fr)_auto]">
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

export function SettingsPanel({ section }: { section: SettingsSectionId }) {
  const { preferences, change, stats, assist, prompts } = useSettings();
  const preview = {
    "--read-size": `${preferences.fontSize}px`,
    "--read-lead": String(preferences.lineHeight),
    maxWidth: `${preferences.columnWidth}ch`,
  } as CSSProperties;

  if (section === "appearance") {
    return (
      <Section title="Appearance" lede="Light is warm paper; dark is warm charcoal. Neither uses pure black or white.">
        <Row title="Theme" description="Applies everywhere, including the reader.">
          <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-3">
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
      </Section>
    );
  }

  if (section === "reading") {
    return (
      <Section title="Reading" lede="Used by every article and note. Changes from the reader's Display menu land here too.">
        <div className="mt-5 grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
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
      </Section>
    );
  }

  if (section === "shortcuts") {
    return (
      <Section title="Shortcuts" lede="Press ? anywhere to see these.">
        <h3 className="caps mt-5 mb-1">Everywhere</h3>
        {GLOBAL_SHORTCUTS.map((shortcut) => (
          <ShortcutRow key={shortcut.label} shortcut={shortcut} />
        ))}
        <h3 className="caps mt-6 mb-1">While reading</h3>
        {READER_SHORTCUTS.map((shortcut) => (
          <ShortcutRow key={shortcut.label} shortcut={shortcut} />
        ))}
      </Section>
    );
  }

  if (section === "assist") {
    return (
      <Section
        title="Assist"
        lede="Summarize a document, outline it, explain a highlight, or ask a question. A highlight can also run a prompt and keep the answer as its note. Libra sends that passage to the host below, and only when you ask."
      >
        <AssistSettings status={assist} />
        <AssistPromptSettings prompts={prompts} />
      </Section>
    );
  }

  return (
    <Section
      title="Your data"
      lede="Documents, highlights, and preferences stay on this device. Fetching a page contacts that site. Assist sends the passage to the model host you set under Assist, and only when you run it."
    >
      <Row
        title="Export everything as JSON"
        description={`Documents with their text and metadata, ${plural(stats.highlights, "highlight")} and notes, collections, tags, preferences, Assist answers, and Assist prompts. The model API key is not included. Original PDF and EPUB files stay in the storage folder.`}
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
    </Section>
  );
}
