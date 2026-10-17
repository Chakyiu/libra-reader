"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

/** Ink pills at the bottom centre; they sit above the phone tab bar. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      offset={{ bottom: 28 }}
      mobileOffset={{ bottom: 96 }}
      gap={10}
      visibleToasts={3}
      toastOptions={{
        unstyled: true,
        classNames: { toast: "libra-toast" },
      }}
      {...props}
    />
  )
}

export { Toaster }
