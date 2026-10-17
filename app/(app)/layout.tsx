import { AppShell } from "@/components/shell/app-shell";
import { getShellData } from "@/lib/queries";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const shell = await getShellData();
  return <AppShell shell={shell}>{children}</AppShell>;
}
