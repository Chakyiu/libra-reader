import type { SnippetSegment } from "@/lib/types";

/** Renders search text with matches marked, without injecting HTML. */
export function Snippet({ segments }: { segments: SnippetSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.hit ? (
          <mark key={index} className="search-hit">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
