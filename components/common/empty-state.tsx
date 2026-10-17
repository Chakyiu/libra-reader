import type { ReactNode } from "react";
import { cn } from "cn";
import { LogoMark } from "@/components/brand/logo-mark";

export function EmptyState({
  icon,
  title,
  children,
  action,
  bordered = true,
  className,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-7 px-8 py-16 text-center sm:py-20",
        bordered && "rounded-lg border border-dashed border-border",
        className,
      )}
    >
      <div className="mx-auto mb-4 grid size-[34px] place-items-center text-muted-foreground [&_svg]:size-[34px] [&_svg]:stroke-[1.4]">
        {icon ?? <LogoMark />}
      </div>
      <h2 className="mb-2 font-serif text-[21px] leading-snug font-medium tracking-[-0.01em] text-balance">{title}</h2>
      {children && <div className="mx-auto mb-[22px] max-w-[42ch] text-[13.5px] leading-relaxed text-muted-foreground">{children}</div>}
      {action}
    </div>
  );
}
