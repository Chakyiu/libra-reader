import type { Metadata } from "next";
import { HighlightsView } from "@/components/highlights/highlights-view";
import { getAssistStatus, listAssistPrompts, listCollectionRefs, listHighlights } from "@/lib/queries";
import { firstParams, highlightSearchParamsSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Highlights" };

export default async function HighlightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = highlightSearchParamsSchema.parse(firstParams(await searchParams));
  const [data, collections, assist, prompts] = await Promise.all([
    listHighlights(filters),
    listCollectionRefs(),
    getAssistStatus(),
    listAssistPrompts(),
  ]);
  return (
    <HighlightsView
      highlights={data.highlights}
      total={data.total}
      filters={filters}
      sources={data.sources}
      tags={data.tags}
      collections={collections}
      assistConfigured={assist.configured}
      prompts={prompts}
    />
  );
}
