import type { ThemePreference } from "@/lib/generated/prisma/enums";

export function applyTheme(theme: ThemePreference): void {
  document.documentElement.dataset.theme = theme.toLowerCase();
}

export function effectiveTheme(): "light" | "dark" {
  const current = document.documentElement.dataset.theme;
  if (current === "light" || current === "dark") return current;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
