"use client";

import Link from "next/link";
import { useState } from "react";
import { Folder, Plus } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { CollectionFormDialog } from "@/components/collections/collection-form-dialog";
import { MobileMenuButton } from "@/components/shell/mobile-nav";
import { Button } from "@/components/ui/button";
import { collectionVar } from "@/lib/colors";
import { plural } from "@/lib/format";
import type { CollectionSummary } from "@/lib/types";

export function CollectionsView({ collections }: { collections: CollectionSummary[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="mx-auto max-w-[1080px] px-[22px] pt-4 pb-24 sm:px-[26px] sm:pt-8 lg:px-[52px] lg:pt-11">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:items-baseline">
        <h1 className="font-serif text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[30px]">Collections</h1>
        <span className="count max-sm:hidden">{plural(collections.length, "collection")}</span>
        <span className="ml-auto flex items-center gap-1">
          <Button size="sm" onClick={() => setCreating(true)} aria-label="New collection">
            <Plus />
            <span className="max-sm:sr-only">New collection</span>
          </Button>
          <MobileMenuButton />
        </span>
      </header>
      <p className="mt-2 max-w-[62ch] text-muted-foreground">
        Collections are groups you make on purpose. Tags stay loose; reading status is its own thing.
      </p>

      {collections.length === 0 ? (
        <EmptyState
          icon={<Folder />}
          title="No collections yet"
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Make your first collection
            </Button>
          }
        >
          Group things you want to keep together — a project, a course of reading, a long argument with yourself.
        </EmptyState>
      ) : (
        <ul className="mt-[26px] grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-5">
          {collections.map((collection) => (
            <li key={collection.id}>
              <Link
                href={`/collections/${collection.id}`}
                className="block h-full rounded-lg border border-border bg-background p-6 transition-colors hover:border-foreground/30 hover:bg-well"
              >
                <span className="mb-[15px] block h-[3px] w-[30px] rounded-full" style={{ background: collectionVar(collection.color) }} aria-hidden />
                <h2 className="font-serif text-[19px] leading-[1.3] font-medium tracking-[-0.012em]">{collection.name}</h2>
                {collection.description && <p className="mt-2 text-[13px] leading-normal text-muted-foreground">{collection.description}</p>}
                <p className="mt-[15px] font-mono text-[11.5px] text-muted-foreground">
                  {plural(collection.documentCount, "item")}
                  {collection.isFavorite ? " · on Home" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CollectionFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
