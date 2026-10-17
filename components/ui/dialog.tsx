"use client"

import * as React from "react"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-[2px] duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * A centred modal on wider screens, a bottom sheet on phones. Compose with
 * DialogHeader / DialogBody / DialogFooter for the hairline-divided layout.
 */
function DialogContent({
  className,
  children,
  size = "default",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  size?: "default" | "wide"
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden border border-border bg-background text-foreground shadow-pop outline-none",
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[22px] duration-200 data-open:animate-in data-open:slide-in-from-bottom-10 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-10",
          "sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:max-h-[88vh] sm:w-[calc(100%-3.5rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-[0.98] sm:data-closed:slide-out-to-bottom-0",
          size === "wide" ? "sm:max-w-[720px]" : "sm:max-w-[560px]",
          className
        )}
        {...props}
      >
        <div aria-hidden className="mx-auto mt-2.5 mb-0.5 h-1 w-[38px] shrink-0 rounded-full bg-foreground/22 sm:hidden" />
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<"div"> & { showCloseButton?: boolean }) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex shrink-0 items-center gap-3 border-b border-border px-[22px] py-4 sm:px-[26px] sm:py-5", className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="quiet" size="icon" className="-mr-2 ml-auto">
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("min-h-0 flex-1 overflow-y-auto px-[22px] py-6 sm:px-[26px]", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2.5 border-t border-border bg-well px-[22px] pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-[26px] sm:py-5",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-serif text-xl leading-snug font-semibold tracking-[-0.015em] sm:text-[21px]", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-[13px] leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
