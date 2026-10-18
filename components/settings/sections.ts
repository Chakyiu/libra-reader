export const SETTINGS_SECTIONS = [
  { id: "appearance", label: "Appearance", description: "Theme for the library and the reader" },
  { id: "reading", label: "Reading", description: "Type, size, and the column" },
  { id: "shortcuts", label: "Shortcuts", description: "Keys for the library and the reader" },
  { id: "assist", label: "Assist", description: "The model, and prompts for a highlight" },
  { id: "data", label: "Your data", description: "Export, install, and where files live" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

export function isSettingsSection(value: string): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value);
}

export function settingsSection(id: string | undefined) {
  return SETTINGS_SECTIONS.find((section) => section.id === id) ?? null;
}
