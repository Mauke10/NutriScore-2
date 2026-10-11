"use client";

import { useEffect, useState } from "react";

// A visible "you're offline" strip across the top of the app. Logging a
// meal or saving a weekly entry fails silently otherwise — this at least
// explains why, the moment the connection actually drops, rather than
// leaving it to look like the save button just didn't work.
export default function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    function goOnline() {
      setOnline(true);
    }
    function goOffline() {
      setOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="offline-banner" role="status">
      You're offline — changes won't save until you're back online.
    </div>
  );
}
