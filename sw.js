// CashBoxes Pro v5 — Offline caching
// - Cache-first for static assets
// - Network-first (with cache fallback) for navigations
// - Only cache GET + same-origin responses

const CACHE_NAME = "cashboxes-pro-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./firebase.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Never try to cache non-GET requests (e.g., uploads / form posts)
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  const isNav = req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Navigations: try network first so updates appear quickly; fallback to cached shell
    if (isNav) {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put("./index.html", fresh.clone());
        return fresh;
      } catch (e) {
        return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
      }
    }

    // Static assets: cache-first with background refresh
    const cached = await cache.match(req);
    if (cached) {
      // Update in background (best-effort)
      event.waitUntil((async () => {
        try {
          const res = await fetch(req);
          if (res && res.ok && res.type === "basic") await cache.put(req, res.clone());
        } catch (_) {}
      })());
      return cached;
    }

    // Not cached yet: fetch and cache if possible
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === "basic") await cache.put(req, res.clone());
      return res;
    } catch (e) {
      // Last resort: serve app shell for same-origin html requests, else an error response
      return (await cache.match("./index.html")) || Response.error();
    }
  })());
});
