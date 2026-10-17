"use client"

import * as React from "react"
import { cn } from "cn"
import { Label as LabelPrimitive } from "radix-ui"

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("mb-2 block text-[12.5px] font-medium text-muted-foreground select-none", className)}
      {...props}
    />
  )
}

export { Label }
