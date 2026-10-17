"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import type { ReadingLocation } from "@/lib/validation";

interface PositionPayload {
  progress: number;
  location?: ReadingLocation;
}

/**
 * Debounced reading-position saves. Flushes with sendBeacon when the tab is
 * hidden, the page unloads, or the reader unmounts, so the last position
 * survives closing the window.
 */
export function usePositionSaver(documentId: string) {
  const router = useRouter();
  const latest = useRef<PositionPayload | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshed = useRef(false);
  const url = `/api/documents/${documentId}/position`;

  const send = useCallback(
    (payload: PositionPayload, beacon = false) => {
      const body = JSON.stringify(payload);
      if (beacon && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        return;
      }
      void fetch(url, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true })
        .then((response) => (response.ok ? (response.json() as Promise<{ statusChanged?: boolean }>) : null))
        .then((data) => {
          if (data?.statusChanged && !refreshed.current) {
            refreshed.current = true;
            router.refresh();
          }
        })
        .catch(() => undefined);
    },
    [router, url],
  );

  const save = useCallback(
    (payload: PositionPayload, immediate = false) => {
      latest.current = payload;
      if (timer.current) clearTimeout(timer.current);
      const flushNow = () => {
        if (latest.current) send(latest.current);
        latest.current = null;
      };
      if (immediate) flushNow();
      else timer.current = setTimeout(flushNow, 1200);
    },
    [send],
  );

  useEffect(() => {
    const flush = () => {
      if (timer.current) clearTimeout(timer.current);
      if (latest.current) send(latest.current, true);
      latest.current = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [send]);

  return save;
}
