"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { applyTheme } from "@/components/shell/theme";
import { updatePreferences } from "@/lib/actions/preferences";
import type { Preferences } from "@/lib/types";

/** Applies reading preferences instantly and persists them after the user pauses. */
export function useReaderPreferences(initial: Preferences) {
  const [preferences, setPreferences] = useState(initial);
  const pending = useRef<Partial<Preferences>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const change = (patch: Partial<Preferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
    if (patch.theme) applyTheme(patch.theme);
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const batch = pending.current;
      pending.current = {};
      void updatePreferences(batch).then((result) => {
        if (!result.ok) toast.error("Couldn't save your reading preferences.");
      });
    }, 500);
  };

  return { preferences, change };
}
