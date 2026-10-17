import type { Metadata } from "next";
import { LibraryView } from "@/components/library/library-view";
import { db } from "@/lib/db";
import { listCollectionRefs, listDocuments, listTagNames } from "@/lib/queries";
import { firstParams, librarySearchParamsSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = librarySearchParamsSchema.parse(firstParams(await searchParams));
  const [documents, collections, tags, total] = await Promise.all([
    listDocuments(filters),
    listCollectionRefs(),
    listTagNames(),
    db.document.count(),
  ]);

  return (
    <LibraryView
      filters={filters}
      documents={documents}
      collections={collections}
      tags={tags}
      libraryIsEmpty={total === 0}
    />
  );
}
