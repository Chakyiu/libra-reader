import { SettingsFrame } from "@/components/settings/settings-view";
import { getAssistStatus, getLibraryStats, getPreferences, listAssistPrompts } from "@/lib/queries";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [preferences, stats, assist, prompts] = await Promise.all([
    getPreferences(),
    getLibraryStats(),
    getAssistStatus(),
    listAssistPrompts(),
  ]);
  return (
    <SettingsFrame preferences={preferences} stats={stats} assist={assist} prompts={prompts}>
      {children}
    </SettingsFrame>
  );
}
