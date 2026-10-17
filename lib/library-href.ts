import type { LibraryFilters } from "@/lib/validation";

const DEFAULTS: Partial<Record<keyof LibraryFilters, string>> = {
  status: "all",
  type: "all",
  sort: "saved",
  view: "list",
  q: "",
};

/** Builds a /library URL that only carries non-default parameters. */
export function libraryHref(filters: Partial<LibraryFilters>, overrides: Partial<Record<keyof LibraryFilters, string | undefined>> = {}): string {
  const merged: Record<string, string | undefined> = { ...filters, ...overrides };
  const params = new URLSearchParams();
  for (const key of ["status", "type", "tag", "collection", "q", "sort", "view"] as const) {
    const value = merged[key];
    if (value === undefined || value === "" || value === DEFAULTS[key]) continue;
    params.set(key, value);
  }
  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}
