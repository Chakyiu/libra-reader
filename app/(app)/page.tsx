import Link from "next/link";
import { ReadingProgress } from "@/components/common/progress";
import { HighlightCard } from "@/components/highlights/highlight-card";
import { Bookplate } from "@/components/library/bookplate";
import { AddContentButton } from "@/components/shell/add-content-button";
import { MobileMenuButton, ThemeToggleButton } from "@/components/shell/mobile-nav";
import { collectionVar } from "@/lib/colors";
import { formatLongDate, formatMinutes, greeting, lengthLabel, minutesLeft, percent, plural } from "@/lib/format";
import { getHomeData } from "@/lib/queries";

function SectionHead({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-[18px] flex items-baseline gap-3">
      <h2 className="caps text-[12px]">{title}</h2>
      {href && linkLabel && (
        <Link
          href={href}
          className="ml-auto border-b border-border pb-1 text-[13px] text-muted-foreground transition-colors hover:border-current hover:text-foreground"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const now = new Date();
  const home = await getHomeData(now);
  const cont = home.continueReading;

  const lede =
    home.total === 0
      ? "Nothing saved yet. Start with an article you've been meaning to read, a PDF, or a note."
      : home.inProgress > 0
        ? `${home.inProgress} ${home.inProgress === 1 ? "piece is" : "pieces are"} part-read. Nothing here is overdue — a library doesn't have deadlines.`
        : "Nothing in progress. A good moment to start something from the inbox.";

  return (
    <div className="mx-auto max-w-[1080px] px-[22px] pt-5 pb-24 sm:px-[26px] sm:pt-8 lg:px-[52px] lg:pt-11">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[32px] leading-[1.15] font-medium tracking-[-0.022em] sm:text-[38px]">{`${greeting(now)}.`}</h1>
          <p className="mt-2 max-w-[62ch] text-muted-foreground">
            {formatLongDate(now)}. {lede}
          </p>
        </div>
        <div className="-mr-2 flex items-center lg:hidden">
          <ThemeToggleButton />
          <MobileMenuButton />
        </div>
      </header>

      {home.total === 0 ? (
        <section className="mt-12 rounded-lg border border-dashed border-border px-8 py-16 text-center">
          <h2 className="font-serif text-[22px] font-medium tracking-[-0.01em]">Your library starts here</h2>
          <p className="mx-auto mt-2 mb-6 max-w-[48ch] text-[13.5px] leading-relaxed text-muted-foreground">
            Paste a link and Libra keeps a clean, readable copy on this device. Upload PDFs and EPUBs, or write a note. Highlight
            anything worth keeping and it shows up here to revisit.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <AddContentButton>Add your first thing</AddContentButton>
            <AddContentButton tab="note" variant="outline">
              Write a note
            </AddContentButton>
          </div>
        </section>
      ) : (
        <>
          <section className="mt-12">
            <SectionHead title="Continue reading" href="/library?status=reading" linkLabel="All in progress" />
            {cont ? (
              <Link
                href={`/read/${cont.id}`}
                className="grid grid-cols-[124px_minmax(0,1fr)] items-center gap-7 rounded-lg border border-border bg-well p-[26px] transition-colors hover:border-terracotta/55 max-sm:grid-cols-[78px_minmax(0,1fr)] max-sm:gap-4 max-sm:p-5"
              >
                <Bookplate type={cont.type} publication={cont.publication} title={cont.title} size="feature" />
                <span className="min-w-0">
                  <span className="block font-serif text-[27px] leading-[1.2] font-semibold tracking-[-0.02em] text-balance max-sm:text-[21px]">
                    {cont.title}
                  </span>
                  <span className="mt-1.5 block text-[13px] text-muted-foreground">
                    {[cont.author, cont.publication, cont.readingMinutes ? formatMinutes(cont.readingMinutes) : lengthLabel(cont)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {cont.excerpt && (
                    <span className="mt-[11px] line-clamp-2 block text-[13.5px] text-muted-foreground max-sm:hidden">{cont.excerpt}</span>
                  )}
                  <ReadingProgress
                    progress={cont.progress}
                    className="mt-4 max-w-[420px]"
                    label={`${percent(cont.progress)}%${cont.readingMinutes ? ` · about ${minutesLeft(cont.readingMinutes, cont.progress)} min left` : ""}`}
                  />
                </span>
              </Link>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-[13.5px] text-muted-foreground">
                Nothing part-read. When you leave something half-finished it shows up here.
              </p>
            )}
          </section>

          <section className="mt-12">
            <SectionHead title="Recently saved" href="/library" linkLabel="Open library" />
            <ul className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 sm:gap-6">
              {home.recent.map((doc) => (
                <li key={doc.id} className="group relative flex flex-col gap-[13px]">
                  <Bookplate type={doc.type} publication={doc.publication} title={doc.title} importStatus={doc.importStatus} size="card" className="group-hover:border-foreground/30" />
                  <div>
                    <h3 className="font-serif text-[17px] leading-[1.3] font-medium tracking-[-0.01em] text-balance">
                      <Link href={`/read/${doc.id}`} className="after:absolute after:inset-0">
                        {doc.title}
                      </Link>
                    </h3>
                    <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                      {[
                        doc.author ?? doc.publication,
                        lengthLabel(doc),
                        doc.progress > 0 && doc.progress < 1 ? `${percent(doc.progress)}% read` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12">
            <SectionHead title="Revisit a highlight" href="/highlights" linkLabel="All highlights" />
            {home.revisit ? (
              <HighlightCard highlight={home.revisit} />
            ) : (
              <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-[13.5px] text-muted-foreground">
                Select a sentence while reading to keep it. One highlight a day comes back here.
              </p>
            )}
          </section>

          {home.favoriteCollections.length > 0 && (
            <section className="mt-12">
              <SectionHead title="Favorite collections" href="/collections" linkLabel="Manage" />
              <ul className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                {home.favoriteCollections.map((collection) => (
                  <li key={collection.id}>
                    <Link
                      href={`/collections/${collection.id}`}
                      className="block h-full rounded-lg border border-border bg-background px-5 py-[18px] transition-colors hover:border-foreground/30 hover:bg-well"
                    >
                      <span className="mb-[13px] block h-[3px] w-[26px] rounded-full" style={{ background: collectionVar(collection.color) }} aria-hidden />
                      <span className="block font-serif text-[17px] leading-[1.3] font-medium tracking-[-0.01em]">{collection.name}</span>
                      <span className="font-mono text-[12.5px] text-muted-foreground">{plural(collection.documentCount, "item")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
