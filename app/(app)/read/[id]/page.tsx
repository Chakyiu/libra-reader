import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReaderView } from "@/components/reader/reader-view";
import { getAssistStatus, getDocumentAssist, getPreferences, getReaderData, listCollectionRefs, listTagNames } from "@/lib/queries";
import { idSchema } from "@/lib/validation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return { title: "Not found" };
  const data = await getReaderData(id.data);
  return { title: data?.document.title ?? "Not found" };
}

export default async function ReadPage({ params, searchParams }: Props) {
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const [data, collections, tags, preferences, assist, assistStatus, query] = await Promise.all([
    getReaderData(id.data),
    listCollectionRefs(),
    listTagNames(),
    getPreferences(),
    getDocumentAssist(id.data),
    getAssistStatus(),
    searchParams,
  ]);
  if (!data) notFound();
  const hl = typeof query.hl === "string" && idSchema.safeParse(query.hl).success ? query.hl : undefined;

  return (
    <ReaderView
      document={data.document}
      highlights={data.highlights}
      collections={collections}
      allTags={tags}
      preferences={preferences}
      assist={assist}
      assistConfigured={assistStatus.configured}
      focusHighlightId={hl}
    />
  );
}
