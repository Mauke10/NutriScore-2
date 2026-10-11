"use client";

import { useEffect } from "react";

// Registers the offline-shell service worker (public/sw.js). Production
// only — in dev, Next.js rebuilds constantly and a cached shell would just
// get in the way of seeing real changes.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Nothing to show for this — the app works fine online either way,
      // this only ever affects the offline fallback experience.
    });
  }, []);

  return null;
}
