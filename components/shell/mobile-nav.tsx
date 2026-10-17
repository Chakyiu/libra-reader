"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { cn } from "cn";
import { Highlighter, House, Library, Menu, Moon, Plus, Search, Sun } from "lucide-react";
import { useAddContent } from "@/components/shell/add-content-context";
import { Rail } from "@/components/shell/rail";
import { applyTheme, effectiveTheme } from "@/components/shell/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { updatePreferences } from "@/lib/actions/preferences";
import type { ShellData } from "@/lib/types";

const ShellContext = createContext<ShellData | null>(null);

export function ShellDataProvider({ shell, children }: { shell: ShellData; children: ReactNode }) {
  return <ShellContext.Provider value={shell}>{children}</ShellContext.Provider>;
}

/**
 * Phones have no global header (as in the mobile comp); each page's appbar
 * carries this button, which opens the full rail: collections, tags, settings.
 */
export function MobileMenuButton({ className }: { className?: string }) {
  const shell = useContext(ShellContext);
  const [open, setOpen] = useState(false);
  if (!shell) return null;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="quiet" size="icon" aria-label="Open navigation" onClick={() => setOpen(true)} className={cn("lg:hidden", className)}>
        <Menu />
      </Button>
      <SheetContent side="left" className="p-0 pt-[env(safe-area-inset-top)]" aria-describedby={undefined}>
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Rail shell={shell} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function ThemeToggleButton({ className }: { className?: string }) {
  const toggle = () => {
    const next = effectiveTheme() === "dark" ? "LIGHT" : "DARK";
    applyTheme(next);
    void updatePreferences({ theme: next });
  };
  return (
    <Button variant="quiet" size="icon" className={className} aria-label="Switch between light and dark" onClick={toggle}>
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

const TABS = [
  { href: "/", label: "Home", icon: House, match: (p: string) => p === "/" },
  { href: "/library", label: "Library", icon: Library, match: (p: string) => p.startsWith("/library") || p.startsWith("/collections") },
  { href: "/highlights", label: "Highlights", icon: Highlighter, match: (p: string) => p.startsWith("/highlights") },
  { href: "/search", label: "Search", icon: Search, match: (p: string) => p.startsWith("/search") },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();
  const { openAddContent } = useAddContent();
  const [first, second, third, fourth] = TABS;

  const tab = (item: (typeof TABS)[number]) => {
    const Icon = item.icon;
    const current = item.match(pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={current ? "page" : undefined}
        className="grid min-h-[54px] justify-items-center gap-[5px] rounded-xl px-1 py-[9px] text-muted-foreground aria-[current=page]:text-terracotta"
      >
        <Icon className="size-[21px]" strokeWidth={1.6} aria-hidden />
        <span className="text-[11.5px] leading-tight font-medium tracking-[0.01em] [[aria-current=page]_&]:font-semibold">
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-start border-t border-border bg-background/92 px-1.5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-[16px] lg:hidden"
    >
      {tab(first)}
      {tab(second)}
      <button
        type="button"
        onClick={() => openAddContent()}
        aria-label="Add content"
        className="mt-px grid size-[52px] place-items-center justify-self-center rounded-[17px] bg-primary text-primary-foreground shadow-[0_2px_0_color-mix(in_oklab,var(--ink)_26%,transparent),0_8px_20px_color-mix(in_oklab,var(--ink-fill)_30%,transparent)] active:translate-y-0.5 active:shadow-none"
      >
        <Plus className="size-[22px]" strokeWidth={1.8} aria-hidden />
      </button>
      {tab(third)}
      {tab(fourth)}
    </nav>
  );
}
