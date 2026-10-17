import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { getLibraryStats, getPreferences } from "@/lib/queries";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [preferences, stats] = await Promise.all([getPreferences(), getLibraryStats()]);
  return <SettingsView preferences={preferences} stats={stats} />;
}
