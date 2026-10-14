"use client";

import { useCallback, useEffect, useState } from "react";
import { setDayEndHour } from "./utils";

export const DEFAULT_PREFS = { raceName: "Ironman 70.3 Tallinn", raceDate: null, dayEndHour: 0, shareMeals: true, showFiber: true, stravaAutosync: true };

// The signed-in person's drawer → Settings choices (/api/prefs). Changes
// apply instantly and save in the background; a failed save rolls back.
export function usePrefs() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prefs")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load settings"))))
      .then((p) => {
        if (cancelled) return;
        setDayEndHour(p.dayEndHour);
        setPrefs(p);
      })
      .catch(() => {}) // keep defaults; the app works without them
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (patch) => {
    let previous;
    setPrefs((p) => {
      previous = p;
      return { ...p, ...patch };
    });
    if ("dayEndHour" in patch) setDayEndHour(patch.dayEndHour);
    setError("");
    try {
      const res = await fetch("/api/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      setPrefs(data);
      setDayEndHour(data.dayEndHour);
      return true;
    } catch (err) {
      setPrefs(previous);
      setDayEndHour(previous.dayEndHour);
      setError(err.message);
      return false;
    }
  }, []);

  return { prefs, loaded, error, update };
}
