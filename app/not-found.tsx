import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <LogoMark className="mx-auto size-9 text-terracotta" />
        <h1 className="mt-5 font-serif text-[26px] font-medium tracking-[-0.015em]">Nothing on this shelf</h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground">That page doesn&apos;t exist in Libra.</p>
        <Button variant="outline" className="mt-6" asChild>
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </main>
  );
}
