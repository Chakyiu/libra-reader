import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionDetailView } from "@/components/collections/collection-detail-view";
import { getCollection, listCollectionRefs, listTagNames } from "@/lib/queries";
import { idSchema } from "@/lib/validation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = idSchema.safeParse((await params).id);
  const data = id.success ? await getCollection(id.data) : null;
  return { title: data?.collection.name ?? "Collection not found" };
}

export default async function CollectionPage({ params }: Props) {
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const [data, collections, tags] = await Promise.all([getCollection(id.data), listCollectionRefs(), listTagNames()]);
  if (!data) notFound();
  return <CollectionDetailView collection={data.collection} documents={data.documents} collections={collections} tags={tags} />;
}
