"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { AddContentProvider } from "@/components/shell/add-content-context";
import { KeyboardShortcuts } from "@/components/shell/keyboard-shortcuts";
import { MobileTabBar, ShellDataProvider } from "@/components/shell/mobile-nav";
import { Rail } from "@/components/shell/rail";
import type { ShellData } from "@/lib/types";

export function AppShell({ shell, children }: { shell: ShellData; children: ReactNode }) {
  const pathname = usePathname();
  const inReader = pathname.startsWith("/read/");

  return (
    <ShellDataProvider shell={shell}>
      <AddContentProvider collections={shell.collections}>
        <a
          href="#main"
          className="sr-only z-[100] rounded-sm bg-primary px-4 py-2.5 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <div className="min-h-dvh lg:grid lg:grid-cols-[var(--rail-width)_minmax(0,1fr)]">
          <aside
            aria-label="Library navigation"
            className="sticky top-0 hidden h-dvh min-h-0 flex-col border-r border-border bg-surface lg:flex"
          >
            <Rail shell={shell} />
          </aside>
          <main
            id="main"
            tabIndex={-1}
            className={cn(
              "min-w-0 outline-none",
              !inReader && "pt-[env(safe-area-inset-top)] pb-[calc(84px+env(safe-area-inset-bottom))] lg:pt-0 lg:pb-0",
            )}
          >
            {children}
          </main>
        </div>
        {!inReader && <MobileTabBar />}
        <KeyboardShortcuts />
      </AddContentProvider>
    </ShellDataProvider>
  );
}
