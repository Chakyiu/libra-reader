export default function Loading() {
  return (
    <div className="mx-auto max-w-[1080px] px-[22px] pt-8 pb-24 sm:px-[26px] lg:px-[52px] lg:pt-11" role="status" aria-label="Loading">
      <span className="skel h-8 w-48" />
      <span className="skel mt-4 h-3.5 w-80 max-w-full" />
      <div className="mt-10 grid gap-0">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="grid grid-cols-[60px_minmax(0,1fr)] gap-4 border-b border-border py-[18px]">
            <span className="plate size-[60px]">
              <span className="plate-frame" />
            </span>
            <span className="grid content-start gap-3 pt-1">
              <span className="skel h-4 w-[60%]" />
              <span className="skel w-[40%]" />
              <span className="skel w-[25%]" />
            </span>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
