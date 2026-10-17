"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { cn } from "cn";
import { Folder, Highlighter, House, Library, Plus, Search, Settings } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/brand/logo-mark";
import { useAddContent } from "@/components/shell/add-content-context";
import { collectionVar } from "@/lib/colors";
import { plural } from "@/lib/format";
import type { ShellData } from "@/lib/types";

type Icon = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number }>;

function NavLink({
  href,
  current,
  icon: IconComponent,
  count,
  children,
  sub = false,
  onNavigate,
}: {
  href: string;
  current: boolean;
  icon?: Icon;
  count?: ReactNode;
  children: ReactNode;
  sub?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-[11px] rounded-sm px-3 py-[9px] text-left text-foreground transition-colors hover:bg-foreground/6 pointer-coarse:py-3",
        sub ? "pl-[38px] text-[13px] font-normal" : "font-medium",
        "aria-[current=page]:bg-terracotta/13 aria-[current=page]:font-semibold aria-[current=page]:text-terracotta-text",
      )}
    >
      {sub && (
        <span
          aria-hidden
          className="absolute top-1/2 left-[21px] size-1 -translate-y-1/2 rounded-full bg-muted-foreground opacity-60 group-aria-[current=page]:bg-terracotta group-aria-[current=page]:opacity-100"
        />
      )}
      {IconComponent && <IconComponent className="size-[18px] shrink-0" strokeWidth={1.6} aria-hidden />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined && (
        <span className="ml-auto font-mono text-[11px] font-normal text-muted-foreground tabular-nums group-aria-[current=page]:text-terracotta-text">
          {count}
        </span>
      )}
    </Link>
  );
}

/** The library rail: brand, Add content, primary views, collections, and tags. */
export function Rail({ shell, onNavigate }: { shell: ShellData; onNavigate?: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { openAddContent } = useAddContent();
  const onLibrary = pathname === "/library";
  const status = onLibrary ? (params.get("status") ?? "all") : null;
  const scoped = onLibrary && (params.get("tag") || params.get("collection") || params.get("type"));
  const activeTag = onLibrary ? params.get("tag") : null;
  const { counts } = shell;

  const libraryLink = (value: string) => onLibrary && status === value && !scoped;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-[22px] pb-4">
        <LogoMark className="size-[26px] shrink-0 text-terracotta" />
        <Wordmark />
      </div>

      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          openAddContent();
        }}
        className="mx-3 mb-[18px] flex items-center gap-[9px] rounded-sm bg-primary px-4 py-3 text-left font-semibold tracking-[-0.005em] text-primary-foreground shadow-[0_1px_0_color-mix(in_oklab,var(--ink)_22%,transparent),inset_0_1px_0_color-mix(in_oklab,white_18%,transparent)] transition-[background-color,transform] duration-100 hover:bg-primary-hover active:translate-y-px"
      >
        <Plus className="size-[18px]" strokeWidth={1.8} aria-hidden />
        Add content
        <kbd className="ml-auto font-mono text-[11px] font-normal opacity-85">A</kbd>
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <nav aria-label="Primary" className="mb-[18px] grid gap-px">
          <NavLink href="/" current={pathname === "/"} icon={House} onNavigate={onNavigate}>
            Home
          </NavLink>
          <NavLink href="/library" current={libraryLink("all")} icon={Library} count={counts.library} onNavigate={onNavigate}>
            Library
          </NavLink>
          <NavLink href="/library?status=inbox" current={libraryLink("inbox")} count={counts.inbox} sub onNavigate={onNavigate}>
            Inbox
          </NavLink>
          <NavLink href="/library?status=reading" current={libraryLink("reading")} count={counts.reading} sub onNavigate={onNavigate}>
            Reading
          </NavLink>
          <NavLink href="/library?status=archived" current={libraryLink("archived")} count={counts.archived} sub onNavigate={onNavigate}>
            Archived
          </NavLink>
          <NavLink href="/library?status=favorites" current={libraryLink("favorites")} count={counts.favorites} sub onNavigate={onNavigate}>
            Favorites
          </NavLink>
          <NavLink
            href="/highlights"
            current={pathname.startsWith("/highlights")}
            icon={Highlighter}
            count={counts.highlights}
            onNavigate={onNavigate}
          >
            Highlights
          </NavLink>
          <NavLink href="/collections" current={pathname === "/collections"} icon={Folder} onNavigate={onNavigate}>
            Collections
          </NavLink>
          <NavLink href="/search" current={pathname === "/search"} icon={Search} count="/" onNavigate={onNavigate}>
            Search
          </NavLink>
        </nav>

        <section aria-labelledby="rail-collections" className="mb-[18px]">
          <h2 id="rail-collections" className="caps px-3 pb-2">
            Collections
          </h2>
          {shell.collections.length === 0 ? (
            <p className="px-3 text-[12.5px] leading-relaxed text-muted-foreground">
              None yet.{" "}
              <Link href="/collections" onClick={onNavigate} className="underline decoration-border underline-offset-4 hover:text-foreground">
                Make one
              </Link>
            </p>
          ) : (
            <div className="grid gap-px">
              {shell.collections.map((collection) => (
                <Link
                  key={collection.id}
                  href={`/collections/${collection.id}`}
                  onClick={onNavigate}
                  aria-current={pathname === `/collections/${collection.id}` ? "page" : undefined}
                  className="group flex items-center gap-[11px] rounded-sm px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-foreground/6 aria-[current=page]:bg-terracotta/13 aria-[current=page]:font-semibold aria-[current=page]:text-terracotta-text pointer-coarse:py-3"
                >
                  <span className="swatch" style={{ background: collectionVar(collection.color) }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{collection.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{collection.documentCount}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {shell.tags.length > 0 && (
          <section aria-labelledby="rail-tags">
            <h2 id="rail-tags" className="caps px-3 pb-2">
              Tags
            </h2>
            <div className="grid gap-px">
              {shell.tags.map((tag) => (
                <Link
                  key={tag.name}
                  href={`/library?tag=${encodeURIComponent(tag.name)}`}
                  onClick={onNavigate}
                  aria-current={activeTag === tag.name ? "page" : undefined}
                  className="group flex items-center gap-[11px] rounded-sm px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-foreground/6 aria-[current=page]:bg-terracotta/13 aria-[current=page]:font-semibold aria-[current=page]:text-terracotta-text pointer-coarse:py-3"
                >
                  <span className="w-[9px] font-mono text-[12px] text-muted-foreground" aria-hidden>
                    #
                  </span>
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{tag.count}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="grid gap-0.5 border-t border-border px-3 pt-2.5 pb-3">
        <NavLink href="/settings" current={pathname.startsWith("/settings")} icon={Settings} onNavigate={onNavigate}>
          Settings
        </NavLink>
        <p className="flex items-center gap-2 px-3 pt-1.5 text-[11.5px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-[oklch(0.62_0.09_152)]" aria-hidden />
          Stored on this device · {plural(counts.total, "document")}
        </p>
      </div>
    </div>
  );
}
