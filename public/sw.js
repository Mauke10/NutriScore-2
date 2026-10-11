// Nutriscore service worker — scoped deliberately narrow. This app's data
// lives in Supabase, so there's no sensible way to read or write it while
// offline; trying to fake that with a cache would mean showing stale
// calorie totals as if they were current, or letting a save silently
// "succeed" from cache and then vanish. So this worker does one job: keep
// the app SHELL (the JS/CSS bundle, fonts, the offline fallback page)
// available so the app still opens and explains itself when the network
// drops, instead of the browser's own blank "no internet" page. Every /api/
// call and every non-GET request bypasses this worker entirely.

const CACHE_VERSION = "nutriscore-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Never touch anything but a same-origin GET. API calls, PATCH/POST/DELETE,
  // and cross-origin requests (fonts.googleapis.com etc.) go straight to the
  // network untouched.
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then((cached) => cached || Response.error())
      )
    );
    return;
  }

  // Static assets (the Next.js JS/CSS bundle, icons): try the network first
  // so a fresh deploy is never shadowed by something cached a minute ago —
  // VersionWatcher.js already depends on fresh code winning — and fall back
  // to the last cached copy only when the network genuinely isn't there.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || Response.error()))
  );
});
