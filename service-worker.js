/**
 * service-worker.js
 *
 * __VERSION__ is replaced at deploy time by the GitHub Actions workflow
 * (see .github/workflows/deploy.yml) with the commit SHA. That's what
 * makes a real deploy actually change this file's bytes, which is what
 * makes the browser notice there's an update at all — without it, PWA
 * caching can make a new deploy invisible to already-installed devices.
 */
const VERSION = "__VERSION__";
const CACHE_NAME = `cabin-meal-planner-${VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./storage.js",
  "./api.js",
  "./render.js",
  "./main.js",
  "./sw-register.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  // Deliberately NOT calling self.skipWaiting() here. Staying "waiting"
  // is what lets the app show an update banner and let the user choose
  // when to refresh, instead of the page silently changing under them.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET requests (the app shell). Cross-origin
  // requests (the Cloudflare Worker API) are left completely alone —
  // never cached, never intercepted — so data is always fresh/live.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
