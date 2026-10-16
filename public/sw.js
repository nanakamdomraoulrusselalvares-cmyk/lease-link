// LeaseLink PWA Service Worker v1.0
const CACHE_NAME = "leaselink-cache-v1";
const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/brand/leaselink-logo.png",
  "/brand/leaselink-symbol.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/favicon.ico"
];

// Install: Pre-cache core branding & app shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn("[SW] Cache preload warning:", err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Network first with cache fallback (required for PWA installability)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Bypass API and external database calls so we don't hold stale state
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase.co") ||
    url.protocol.startsWith("chrome-extension")
  ) {
    return;
  }

  // Static assets (images, fonts, icons) -> Stale-While-Revalidate
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".svg")
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // HTML and dynamic routes -> Network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Offline fallback to root shell
        return caches.match("/");
      })
  );
});
