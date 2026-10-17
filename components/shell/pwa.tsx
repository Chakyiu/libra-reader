"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MonitorDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallSnapshot {
  canInstall: boolean;
  installed: boolean;
}

const SERVER_SNAPSHOT: InstallSnapshot = { canInstall: false, installed: false };
let deferred: InstallPromptEvent | null = null;
let installed = false;
let snapshot: InstallSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function publish() {
  const next = { canInstall: deferred !== null && !installed, installed };
  if (next.canInstall === snapshot.canInstall && next.installed === snapshot.installed) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== "undefined") {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) installed = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    publish();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    publish();
  });
  publish();
}

async function installApp() {
  if (!deferred) return;
  await deferred.prompt();
  const choice = await deferred.userChoice;
  deferred = null;
  if (choice.outcome === "accepted") installed = true;
  publish();
}

/** Registers the service worker that makes Libra installable. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The site keeps working as a normal page when registration fails.
    });
  }, []);
  return null;
}

/** Settings row control: the browser install prompt when this device can take it. */
export function InstallAppButton() {
  const { canInstall, installed: isInstalled } = useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);

  if (isInstalled) return <span className="chip">Installed</span>;
  if (!canInstall) return null;
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void installApp()}>
      <MonitorDown />
      Install
    </Button>
  );
}
