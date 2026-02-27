// CashBoxes Pro — Offline caching (stale-while-revalidate)
const CACHE_NAME = "cashboxes-pro-v17";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=17",
  "./app.js?v=17",
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
    await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET
  if (req.method !== "GET" || url.origin !== location.origin) return;

  const isCritical = url.pathname.endsWith("/app.js") || url.pathname.endsWith("/styles.css") || url.search.includes("app.js") || url.search.includes("styles.css");

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Network-first for critical assets to avoid stale JS/CSS causing runtime errors
    if (isCritical) {
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        const cached = await cache.match(req, { ignoreSearch: false });
        return cached || Response.error();
      }
    }

    // stale-while-revalidate for everything else
    const cached = await cache.match(req, { ignoreSearch: false });
    const fetchPromise = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);

    return cached || fetchPromise;
  })());
});

