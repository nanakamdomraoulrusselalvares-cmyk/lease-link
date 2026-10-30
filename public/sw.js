// LeaseLink PWA Service Worker v2.0
const CACHE_NAME = "leaselink-cache-v2";
const PRECACHE_ASSETS = [
  "/",
  "/?source=pwa",
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

  // Only handle standard http and https requests (ignore chrome-extension, moz-extension, data, blob, etc.)
  if (!url.protocol.startsWith("http")) return;

  // Bypass API and external database calls so we don't hold stale state
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase.co")
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

  // HTML and dynamic routes -> Network first, cache on success, fallback to cache when offline
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
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Offline fallback to root shell
        return caches.match("/");
      })
  );
});

// Push event: Handles Web Push notifications even when the app is closed
self.addEventListener("push", (event) => {
  let data = { title: "LeaseLink", body: "Nouvelle notification", url: "/" };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const title = data.title || "LeaseLink";
  const options = {
    body: data.body || "Vous avez reçu une nouvelle mise à jour.",
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

// Message event: Allows in-app and background tabs to request native system notifications
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

// Notification click: Focus existing LeaseLink window or open target URL
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
