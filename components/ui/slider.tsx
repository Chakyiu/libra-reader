"use client"

import * as React from "react"
import { cn } from "cn"
import { Slider as SliderPrimitive } from "radix-ui"

function Slider({ className, defaultValue, value, min = 0, max = 100, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]),
    [value, defaultValue, min]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex h-6 w-full touch-none items-center select-none data-disabled:opacity-50 pointer-coarse:h-8",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-foreground/14">
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-terracotta" />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={props["aria-label"]}
          className="block size-4 shrink-0 rounded-full border border-terracotta bg-background shadow-[0_1px_2px_color-mix(in_oklab,var(--ink)_18%,transparent)] transition-[box-shadow] outline-none hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--terracotta)_16%,transparent)] focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--terracotta)_28%,transparent)] pointer-coarse:size-5"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
