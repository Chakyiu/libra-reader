import type { Metadata, Viewport } from "next";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "@fontsource-variable/archivo/wght.css";
import "./globals.css";
import { PwaRegister } from "@/components/shell/pwa";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getPreferences } from "@/lib/queries";

// Every page reads the local database; nothing is prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Libra Reader", template: "%s · Libra Reader" },
  description: "A local-first place to save, read, highlight, and organize articles, PDFs, EPUBs, and notes.",
  applicationName: "Libra Reader",
  appleWebApp: { capable: true, title: "Libra", statusBarStyle: "default" },
  // Safari still looks for the prefixed tag when saving to the home screen.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F9F8F6" },
    { media: "(prefers-color-scheme: dark)", color: "#171513" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const preferences = await getPreferences();
  return (
    <html lang="en" data-theme={preferences.theme.toLowerCase()} suppressHydrationWarning>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
