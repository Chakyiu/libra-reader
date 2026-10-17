import { cn } from "cn";
import { percent } from "@/lib/format";

export function ReadingProgress({
  progress,
  label,
  className,
}: {
  progress: number;
  label?: string;
  className?: string;
}) {
  const value = percent(progress);
  return (
    <span className={cn("flex max-w-[300px] items-center gap-[9px]", className)}>
      <span
        className="prog-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label="Reading progress"
      >
        <span className="prog-fill block" style={{ width: `${value}%` }} />
      </span>
      <span className="font-mono text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
        {label ?? (value >= 100 ? "Finished" : `${value}%`)}
      </span>
    </span>
  );
}
