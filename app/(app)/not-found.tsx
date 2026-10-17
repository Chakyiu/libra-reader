import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1080px] px-[22px] pt-8 pb-24 sm:px-[26px] lg:px-[52px]">
      <EmptyState
        title="That isn't in your library"
        action={
          <Button variant="outline" asChild>
            <Link href="/library">Open the library</Link>
          </Button>
        }
      >
        It may have been deleted, or the link is from somewhere else. Everything you&apos;ve kept is in the library.
      </EmptyState>
    </div>
  );
}
