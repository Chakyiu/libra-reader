import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

/** On a wide screen this is Appearance beside the menu. On a phone the menu hides it. */
export default function SettingsPage() {
  return <SettingsPanel section="appearance" />;
}
