// Version name (change when you update files)
const CACHE_NAME = "pwa-cache-v9";

// Static assets to pre-cache
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/assets/images/logo.png",
  "/assets/images/icon-192.png",
  "/assets/images/icon-512.png",
  "/assets/images/apple-touch-icon.png",
  "/assets/images/favicon-32.png",
  "/assets/images/favicon-16.png",
  "/assets/Js/components/sidebar.js"
];

// Pages to cache on first visit
const PAGE_ROUTES = [
  "/login", "/signup", "/dashboard", "/sale", "/stock",
  "/product", "/add-product", "/bill", "/bills", "/revenue", "/workers"
];

// 🔹 Install event – pre-cache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 🔹 Activate event – clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 🔹 Fetch event – network-first for API, cache-first for assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip unsupported schemes (like chrome-extension://)
  if (!url.protocol.startsWith("http")) return;

  // API calls: network-first (don't cache stale data)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => {
          return new Response(
            JSON.stringify({ error: "You are offline" }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        })
    );
    return;
  }

  // CDN resources (Tailwind, FontAwesome, Google Fonts): cache-first
  if (url.origin !== location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Pages & static assets: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for offline use
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // If it's a page navigation, show offline page
          if (request.mode === "navigate") {
            return caches.match("/");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});
