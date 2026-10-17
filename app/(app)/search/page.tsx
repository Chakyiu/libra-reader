import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { FileText, NotebookPen, Search } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Snippet } from "@/components/common/snippet";
import { UrlSearchField } from "@/components/common/url-search-field";
import { MobileMenuButton } from "@/components/shell/mobile-nav";
import { Button } from "@/components/ui/button";
import { highlightVar } from "@/lib/colors";
import { TYPE_LABEL } from "@/lib/format";
import { getShellData, searchLibrary } from "@/lib/queries";

export const metadata: Metadata = { title: "Search" };

function Group({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="mt-9">
      <h2 className="caps border-b border-border pb-3">
        {label} · {count}
      </h2>
      <ul>{children}</ul>
    </section>
  );
}

function Result({ href, title, snippet, where }: { href: string; title: ReactNode; snippet?: ReactNode; where: ReactNode }) {
  return (
    <li>
      <Link href={href} className="-mx-3.5 block rounded-sm border-b border-border px-3.5 py-[18px] transition-colors hover:bg-foreground/4">
        <h3 className="font-serif text-[17px] leading-[1.35] font-medium tracking-[-0.01em]">{title}</h3>
        {snippet && <p className="mt-[7px] text-[13px] leading-relaxed text-muted-foreground">{snippet}</p>}
        <p className="mt-2.5 flex items-center gap-[7px] text-[12px] text-muted-foreground [&_svg]:size-[15px]">{where}</p>
      </Link>
    </li>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 200) ?? "";
  const [results, shell] = await Promise.all([searchLibrary(query), getShellData()]);
  const suggestions = [...shell.tags].sort((a, b) => b.count - a.count).slice(0, 5).map((tag) => tag.name);
  const total = results.documents.length + results.text.length + results.highlights.length + results.notes.length;

  return (
    <div className="mx-auto max-w-[1080px] px-[22px] pt-4 pb-24 sm:px-[26px] sm:pt-8 lg:px-[52px] lg:pt-11">
      <header className="flex items-center gap-3">
        <h1 className="font-serif text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[30px]">Search</h1>
        <MobileMenuButton className="ml-auto -mr-2" />
      </header>
      <p className="mt-2 max-w-[62ch] text-muted-foreground max-sm:hidden">Across titles, authors, document text, highlights, and your own notes.</p>
      <div className="mt-6">
        <UrlSearchField label="Search everything" placeholder="Search your library" autoFocus large />
      </div>
      {suggestions.length > 0 && !query && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="caps mr-1">Try</span>
          {suggestions.map((tag) => (
            <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`} className="chip">
              {tag}
            </Link>
          ))}
        </div>
      )}

      {!query ? (
        <EmptyState icon={<Search />} title="Search your whole library" bordered={false} className="pt-14">
          Titles, authors and publications, the text of saved articles and books, your highlights, and your notes.
        </EmptyState>
      ) : total === 0 ? (
        <EmptyState
          icon={<Search />}
          title={`No results for “${query}”`}
          action={
            <Button variant="outline" asChild>
              <Link href="/search">Clear search</Link>
            </Button>
          }
        >
          Nothing in titles, document text, highlights, or notes. Check the spelling, or try a single word.
        </EmptyState>
      ) : (
        <div aria-live="polite">
          <Group label="Documents" count={results.documents.length}>
            {results.documents.map((hit) => (
              <Result
                key={hit.document.id}
                href={`/read/${hit.document.id}`}
                title={<Snippet segments={hit.title} />}
                snippet={<Snippet segments={hit.snippet} />}
                where={
                  <>
                    <FileText aria-hidden />
                    {[hit.document.author, hit.document.publication, TYPE_LABEL[hit.document.type]].filter(Boolean).join(" · ")}
                  </>
                }
              />
            ))}
          </Group>
          <Group label="In document text" count={results.text.length}>
            {results.text.map((hit) => (
              <Result
                key={hit.document.id}
                href={`/read/${hit.document.id}`}
                title={hit.document.title}
                snippet={<Snippet segments={hit.snippet} />}
                where={
                  <>
                    <FileText aria-hidden />
                    {TYPE_LABEL[hit.document.type]} · opens the reader
                  </>
                }
              />
            ))}
          </Group>
          <Group label="Highlights" count={results.highlights.length}>
            {results.highlights.map((hit) => (
              <Result
                key={hit.highlight.id}
                href={`/read/${hit.highlight.document.id}?hl=${hit.highlight.id}`}
                title={<Snippet segments={hit.quote} />}
                snippet={hit.note ? <>Note — <Snippet segments={hit.note} /></> : undefined}
                where={
                  <>
                    <span className="swatch" style={{ background: highlightVar(hit.highlight.color) }} aria-hidden />
                    {hit.highlight.document.title} · back to the passage
                  </>
                }
              />
            ))}
          </Group>
          <Group label="Notes" count={results.notes.length}>
            {results.notes.map((hit) => (
              <Result
                key={`${hit.kind}-${hit.id}`}
                href={hit.kind === "highlight" ? `/read/${hit.documentId}?hl=${hit.id}` : `/read/${hit.documentId}`}
                title={hit.title}
                snippet={<Snippet segments={hit.snippet} />}
                where={
                  <>
                    <NotebookPen aria-hidden />
                    {hit.kind === "highlight" ? "Note on a highlight" : "Personal note"}
                  </>
                }
              />
            ))}
          </Group>
        </div>
      )}
    </div>
  );
}
