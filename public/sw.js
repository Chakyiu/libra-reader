// Installed Libra opens in its own window. Pages are never cached: the library
// is rendered by the local server, and a stale page would show the wrong books.
// Static build files are content-addressed, so those are safe to keep.

const VERSION = "libra-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached ?? new Response("Libra isn't running.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }),
    );
    return;
  }

  const cacheable = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/vendor/");
  if (!cacheable) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      try {
        const response = await fetch(request);
        if (response.ok && response.headers.get("cache-control")?.includes("immutable")) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return (await cache.match(request)) ?? Response.error();
      }
    })(),
  );
});
