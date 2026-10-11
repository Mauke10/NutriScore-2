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
const RELOADED_FOR_KEY = "nutriscore-reloaded-for-build";

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
        if (!data.buildTime || data.buildTime === BUILT_AT) return;

        // We only ever reload ONCE per distinct server build. Without this,
        // a reload lands on a brand-new page load (lastCheckRef resets to 0,
        // so the MIN_GAP_MS guard above doesn't apply to it), and if the
        // mismatch is still there for any reason â€” a slow CDN edge, a flaky
        // deploy, anything â€” it reloads again immediately, forever, which is
        // exactly the "reloading every second, can't log in" loop. sessionStorage
        // survives the reload (unlike the in-memory ref above) so we can tell
        // "already tried this one" apart from "genuinely new version."
        let alreadyReloadedFor = null;
        try {
          alreadyReloadedFor = window.sessionStorage.getItem(RELOADED_FOR_KEY);
        } catch {
          // Storage blocked (private mode etc) â€” fall back to reloading once
          // per page load, which is still better than never checking at all.
        }
        if (alreadyReloadedFor === data.buildTime) return;

        try {
          window.sessionStorage.setItem(RELOADED_FOR_KEY, data.buildTime);
        } catch {
          // If we can't remember it, don't risk a reload loop over it.
          return;
        }
        window.location.reload();
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
