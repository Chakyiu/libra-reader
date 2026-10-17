import type { SVGProps } from "react";

/** An open book on a stand: the Libra mark. Always drawn as a stroke in currentColor. */
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 7.2v12.1M8.3 20.8h7.4M12 7.2C10 5.6 6.6 5 3.4 5.5v9.4c3.2-.5 6.6.1 8.6 1.7M12 7.2c2-1.6 5.4-2.2 8.6-1.7v9.4c-3.2-.5-6.6.1-8.6 1.7M12 3.4v1.6" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="font-serif text-[20px] leading-tight font-semibold tracking-[-0.015em]">Libra</span>
      <span className="ml-[5px] text-[13px] font-medium text-muted-foreground">Reader</span>
    </span>
  );
}
