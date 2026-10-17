import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSettingsSection, settingsSection } from "@/components/settings/sections";
import { SettingsPanel } from "@/components/settings/settings-view";

type Props = { params: Promise<{ section: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const section = settingsSection((await params).section);
  return { title: section ? section.label : "Settings" };
}

export default async function SettingsSectionPage({ params }: Props) {
  const { section } = await params;
  if (!isSettingsSection(section)) notFound();
  return <SettingsPanel section={section} />;
}
