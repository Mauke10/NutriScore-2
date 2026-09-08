"use client";

import { useCallback, useEffect, useState } from "react";

// Pulls together everything the dashboard shows for one person (Martin or
// Laura), and exposes small refresh functions so a form submit only
// re-fetches the slice it touched instead of the whole page.
export function usePersonData(personId) {
  const [weekly, setWeekly] = useState([]);
  const [bloodwork, setBloodwork] = useState([]);
  const [snacks, setSnacks] = useState([]);
  const [training, setTraining] = useState([]);
  const [calorieTarget, setCalorieTarget] = useState(null);
  const [accentColor, setAccentColor] = useState(null);
  const [stravaStatus, setStravaStatus] = useState({ connected: false });
  const [loading, setLoading] = useState(true);

  const refreshWeekly = useCallback(async () => {
    const res = await fetch("/api/weekly?person=" + personId);
    const data = await res.json();
    setWeekly(data.entries || []);
  }, [personId]);

  const refreshBloodwork = useCallback(async () => {
    const res = await fetch("/api/bloodwork?person=" + personId);
    const data = await res.json();
    setBloodwork(data.entries || []);
  }, [personId]);

  const refreshSnacks = useCallback(async () => {
    const res = await fetch("/api/snacks?person=" + personId);
    const data = await res.json();
    setSnacks(data.entries || []);
  }, [personId]);

  const refreshTraining = useCallback(async () => {
    const res = await fetch("/api/training?person=" + personId);
    const data = await res.json();
    setTraining(data.entries || []);
  }, [personId]);

  const refreshTarget = useCallback(async () => {
    const res = await fetch("/api/targets?person=" + personId);
    const data = await res.json();
    setCalorieTarget(data.calorieTarget ?? null);
  }, [personId]);

  const refreshAccentColor = useCallback(async () => {
    const res = await fetch("/api/appearance?person=" + personId);
    const data = await res.json();
    setAccentColor(data.accentColor ?? null);
  }, [personId]);

  const refreshStravaStatus = useCallback(async () => {
    const res = await fetch("/api/strava/status?person=" + personId);
    const data = await res.json();
    setStravaStatus(data);
  }, [personId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      refreshWeekly(),
      refreshBloodwork(),
      refreshSnacks(),
      refreshTraining(),
      refreshTarget(),
      refreshAccentColor(),
      refreshStravaStatus()
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [personId, refreshWeekly, refreshBloodwork, refreshSnacks, refreshTraining, refreshTarget, refreshAccentColor, refreshStravaStatus]);

  return {
    loading,
    weekly,
    bloodwork,
    snacks,
    training,
    calorieTarget,
    accentColor,
    stravaStatus,
    refreshWeekly,
    refreshBloodwork,
    refreshSnacks,
    refreshTraining,
    refreshTarget,
    refreshAccentColor,
    refreshStravaStatus
  };
}
