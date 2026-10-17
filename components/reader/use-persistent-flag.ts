"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** A boolean kept in localStorage; renders the default on the server and during hydration. */
export function usePersistentFlag(key: string, defaultValue: boolean): [boolean, (value: boolean) => void] {
  const read = useCallback(() => {
    const stored = window.localStorage.getItem(key);
    return stored === null ? defaultValue : stored === "true";
  }, [key, defaultValue]);

  const value = useSyncExternalStore(subscribe, read, () => defaultValue);

  const write = useCallback(
    (next: boolean) => {
      window.localStorage.setItem(key, String(next));
      for (const listener of listeners) listener();
    },
    [key],
  );

  return [value, write];
}
