import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-[104px] w-full resize-y rounded-sm border border-border bg-well px-[15px] py-3 text-[14px] leading-normal text-foreground outline-none transition-[border-color,box-shadow] duration-100 placeholder:text-muted-foreground focus-visible:border-terracotta focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--terracotta)_16%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-err",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
