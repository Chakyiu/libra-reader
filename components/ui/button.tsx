import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-sm border border-transparent text-[13px] font-medium leading-tight whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow,transform] duration-100 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35 focus-visible:border-ring disabled:pointer-events-none disabled:opacity-50 aria-[pressed=true]:border-terracotta/35 aria-[pressed=true]:bg-terracotta/14 aria-[pressed=true]:text-terracotta-text [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px]",
  {
    variants: {
      variant: {
        default:
          "bg-primary font-semibold text-primary-foreground shadow-[0_1px_0_color-mix(in_oklab,var(--ink)_20%,transparent)] hover:bg-primary-hover active:translate-y-px active:shadow-none",
        outline:
          "border-border bg-background text-foreground hover:border-foreground/25 hover:bg-well aria-expanded:bg-well",
        ghost: "text-foreground hover:bg-foreground/7 aria-expanded:bg-foreground/7",
        quiet: "text-muted-foreground hover:bg-foreground/8 hover:text-foreground aria-expanded:bg-foreground/8 aria-expanded:text-foreground",
        destructive:
          "bg-err font-semibold text-[var(--paper)] shadow-[0_1px_0_color-mix(in_oklab,var(--ink)_20%,transparent)] hover:bg-err/90 active:translate-y-px",
        link: "h-auto px-0 text-terracotta-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-[15px] pointer-coarse:min-h-11",
        sm: "h-9 px-[13px] text-[12.5px] pointer-coarse:min-h-11",
        lg: "h-11 px-5 text-sm",
        icon: "size-9 pointer-coarse:size-11 [&_svg:not([class*='size-'])]:size-[18px]",
        "icon-sm": "size-8 pointer-coarse:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
