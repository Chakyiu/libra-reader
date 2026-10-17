import type { Metadata } from "next";
import { CollectionsView } from "@/components/collections/collections-view";
import { listCollectionRefs } from "@/lib/queries";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const collections = await listCollectionRefs();
  return <CollectionsView collections={collections} />;
}
