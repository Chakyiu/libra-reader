import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-sm border border-border bg-well px-[15px] text-[14px] text-foreground outline-none transition-[border-color,box-shadow] duration-100 placeholder:text-muted-foreground focus-visible:border-terracotta focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--terracotta)_16%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-err aria-invalid:shadow-[0_0_0_3px_color-mix(in_oklab,var(--err)_14%,transparent)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
