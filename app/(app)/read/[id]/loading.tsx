export default function ReaderLoading() {
  return (
    <div role="status" aria-label="Opening document">
      <div className="sticky top-0 z-30 h-14 border-b border-border bg-background/90" />
      <div className="mx-auto max-w-[680px] px-[22px] pt-10 sm:px-11">
        <span className="skel w-28" />
        <span className="skel mt-5 h-9 w-[85%]" />
        <span className="skel mt-3 h-9 w-[55%]" />
        <span className="skel mt-6 w-48" />
        <div className="mt-10 grid gap-3.5 border-t border-border pt-10">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} className="skel h-3.5" style={{ width: `${88 + ((index * 7) % 12)}%` }} />
          ))}
        </div>
      </div>
      <span className="sr-only">Opening…</span>
    </div>
  );
}
