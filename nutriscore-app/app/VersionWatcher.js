"use client";

import { useEffect, useRef } from "react";

// The build time baked into the bundle this page is currently running â€”
// fixed for the life of this load, no matter how long the tab/home-screen
// app stays open in the background. Compared against /api/version (server
// code, so it always reflects whatever is *currently* deployed) to notice a
// new version has shipped and reload automatically â€” the fix for "I have to
// close and reopen the app to see updates."
const BUILT_AT = process.env.NEXT_PUBLIC_BUILD_TIME || null;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // recheck every 5 min while open
const MIN_GAP_MS = 60 * 1000; // never recheck more than once a minute

export default function VersionWatcher() {
  const lastCheckRef = useRef(0);

  useEffect(() => {
    if (!BUILT_AT) return; // nothing baked in (e.g. local dev) â€” nothing to compare against

    async function checkForUpdate() {
      const now = Date.now();
      if (now - lastCheckRef.current < MIN_GAP_MS) return;
      lastCheckRef.current = now;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const data = await res.json();
        if (data.buildTime && data.buildTime !== BUILT_AT) {
          window.location.reload();
        }
      } catch {
        // Offline or a blip â€” just try again on the next check, nothing to show for it.
      }
    }

    // Catches the exact case that prompted this: reopening the home-screen
    // app after it sat backgrounded through a deploy.
    function onVisibilityChange() {
      if (document.visibilityState === "visible") checkForUpdate();
    }

    const interval = setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", checkForUpdate);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", checkForUpdate);
    };
  }, []);

  return null;
}
