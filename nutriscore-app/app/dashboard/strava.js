// Shared by the drawer's Sync button and "Sync Strava on open".
const SYNCED_AT_KEY = "nutriscore-strava-synced-at";

export function lastStravaSync() {
  try {
    const t = Number(localStorage.getItem(SYNCED_AT_KEY));
    return t > 0 ? t : null;
  } catch {
    return null;
  }
}

export async function syncStrava(personId) {
  const res = await fetch("/api/strava/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ person: personId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Sync failed");
  try {
    localStorage.setItem(SYNCED_AT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
  return data;
}

// "just now" / "12 min ago" / "3 h ago" / "2 days ago"
export function agoLabel(t) {
  if (!t) return null;
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 2) return "just now";
  if (min < 60) return min + " min ago";
  const h = Math.round(min / 60);
  if (h < 24) return h + " h ago";
  const d = Math.round(h / 24);
  return d + (d === 1 ? " day ago" : " days ago");
}
