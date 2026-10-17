"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CircleAlert, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[560px] px-[22px] pt-16 pb-24">
      <div className="state-box" data-tone="error" role="alert">
        <CircleAlert className="mt-px size-[18px] shrink-0 text-err" aria-hidden />
        <div>
          <h1 className="mb-1 text-[15px] font-semibold">Something went wrong on this page</h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Your library is safe on disk; this view just failed to load. Try again, and if it keeps happening, check the terminal running
            Libra for details{error.digest ? ` (reference ${error.digest})` : ""}.
          </p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={reset}>
              <RotateCw />
              Try again
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/">Go home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
