// Basic Service Worker for Offline cache (PWA)
const CACHE = "cashboxes-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./ui.js",
  "./firebase.js",
  "./db.js",
  "./cloudinary.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event)=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=> cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event)=>{
  event.waitUntil(
    caches.keys().then(keys=> Promise.all(keys.map(k=> k!==CACHE ? caches.delete(k) : null)))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event)=>{
  const req = event.request;
  // network-first for api calls
  if (req.url.includes("firestore.googleapis.com") || req.url.includes("api.cloudinary.com")){
    event.respondWith(fetch(req).catch(()=> caches.match(req)));
    return;
  }
  event.respondWith(
    caches.match(req).then(cached=> cached || fetch(req).then(res=>{
      const copy = res.clone();
      caches.open(CACHE).then(cache=> cache.put(req, copy)).catch(()=>{});
      return res;
    }).catch(()=> cached))
  );
});
