import { SettingsFrame } from "@/components/settings/settings-view";
import { getAssistStatus, getLibraryStats, getPreferences } from "@/lib/queries";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [preferences, stats, assist] = await Promise.all([getPreferences(), getLibraryStats(), getAssistStatus()]);
  return (
    <SettingsFrame preferences={preferences} stats={stats} assist={assist}>
      {children}
    </SettingsFrame>
  );
}
