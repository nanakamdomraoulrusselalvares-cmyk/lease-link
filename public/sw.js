// LeaseLink PWA Service Worker v7.0 - Smooth Scroll & Full Offline Suite
const CACHE_NAME = "leaselink-cache-v7";

const PRECACHE_ASSETS = [
  "/",
  "/?source=pwa",
  "/manifest.json",
  "/offline",
  "/brand/leaselink-logo.png",
  "/brand/leaselink-symbol.png",
  "/icons/icon-192x192.png",
  "/icons/icon-384x384.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-32x32.png",
  "/favicon.ico"
];

// 1. Install Event: Pre-cache app shell, offline page, and core branding
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

// 2. Activate Event: Clean up stale legacy caches and claim active clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log("[SW] Removing outdated cache:", name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Multi-tiered caching strategy tailored for offline resilience
self.addEventListener("fetch", (event) => {
  // Only handle standard HTTP/HTTPS GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (!url.protocol.startsWith("http")) return;

  // Bypass dynamic external backend databases and authenticated API routes
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Strategy A: Next.js Static Chunks & Styles (/_next/static/...)
  // These are immutable content-hashed assets -> Cache-First
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Cannot serve chunk offline if not yet cached
            return new Response("", { status: 408, statusText: "Offline Chunk Unavailable" });
          });
      })
    );
    return;
  }

  // Strategy B: Media, Images, Fonts, Branding Assets -> Stale-While-Revalidate
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff")
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

  // Strategy C: Page Navigation Requests (HTML Documents)
  // Network-First with cache fallback -> Fallback to /offline page
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // 1. Try matching the exact requested page from cache
          const cached = await caches.match(event.request);
          if (cached) return cached;

          // 2. Try the dedicated offline fallback page
          const offlineFallback = await caches.match("/offline");
          if (offlineFallback) return offlineFallback;

          // 3. Fallback to cached root shell
          return caches.match("/");
        })
    );
    return;
  }

  // Strategy D: Data & Generic GET Requests
  // Network-First with Cache Fallback (Never serve HTML to non-HTML requests)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

// 4. Push Event: System Web Push Notifications
self.addEventListener("push", (event) => {
  let data = { title: "LeaseLink", body: "Nouvelle mise à jour", url: "/" };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const title = data.title || "LeaseLink";
  const options = {
    body: data.body || "Vous avez reçu une notification LeaseLink.",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    vibrate: [200, 100, 200],
    tag: data.tag || "leaselink-notification",
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 5. Message Event: In-app system alerts trigger
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const title = event.data.title || "LeaseLink";
    const options = {
      body: event.data.body || "",
      icon: event.data.icon || "/icons/icon-192x192.png",
      badge: event.data.badge || "/icons/icon-192x192.png",
      tag: event.data.tag || "leaselink-" + Date.now(),
      vibrate: [200, 100, 200],
      data: {
        url: event.data.url || "/",
      },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// 6. Notification Click: Focus existing window or open target URL
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client && targetUrl !== "/") {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
