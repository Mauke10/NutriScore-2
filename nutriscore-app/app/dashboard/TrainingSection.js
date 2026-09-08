"use client";

import { useState } from "react";
import { currentMonthStr, monthLabel } from "./utils";
import MiniBarChart from "./MiniBarChart";

export default function TrainingSection({ personId, isMe, training, refreshTraining, stravaStatus, refreshStravaStatus }) {
  const [weightMonth, setWeightMonth] = useState(currentMonthStr());
  const [weightKg, setWeightKg] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const thisMonth = currentMonthStr();
  const sorted = [...training].sort((a, b) => a.month.localeCompare(b.month));
  const historyFor = (field, round1) =>
    sorted
      .filter((t) => t[field] != null)
      .map((t) => ({
        month: t.month,
        monthLabel: monthLabel(t.month),
        value: round1 ? Math.round(t[field] * 10) / 10 : Math.round(t[field])
      }));
  const weightHistory = historyFor("weight_moved_kg", false);
  const swimHistory = historyFor("swim_km", true);
  const bikeHistory = historyFor("bike_km", true);
  const runHistory = historyFor("run_km", true);

  async function saveWeight(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: weightMonth, weightMovedKg: weightKg })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setWeightKg("");
      await refreshTraining();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setError("");
    try {
      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: personId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      await refreshTraining();
      await refreshStravaStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="card">
      <h3>
        Training volume <span className="muted">— {thisMonth}</span>
      </h3>

      <div className="bar-grid">
        <MiniBarChart label="Weight moved" unit="kg" history={weightHistory} seriesVar={personId === "laura" ? "--series-laura" : "--series-martin"} />
        <MiniBarChart label="Swim" unit="km" history={swimHistory} seriesVar={personId === "laura" ? "--series-laura" : "--series-martin"} />
        <MiniBarChart label="Bike" unit="km" history={bikeHistory} seriesVar={personId === "laura" ? "--series-laura" : "--series-martin"} />
        <MiniBarChart label="Run" unit="km" history={runHistory} seriesVar={personId === "laura" ? "--series-laura" : "--series-martin"} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {stravaStatus && stravaStatus.connected ? (
          <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            Strava connected{stravaStatus.athleteId ? " (athlete " + stravaStatus.athleteId + ")" : ""}
          </span>
        ) : isMe ? (
          <a href="/api/strava/connect">
            <button type="button" className="ghost">
              Connect Strava
            </button>
          </a>
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Strava not connected yet</span>
        )}
        {stravaStatus && stravaStatus.connected && (
          <button type="button" className="ghost" onClick={syncNow} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        )}
      </div>

      {isMe && (
        <form onSubmit={saveWeight} style={{ marginBottom: 6 }}>
          <div className="field">
            <label htmlFor={"wm-month-" + personId}>Month</label>
            <input id={"wm-month-" + personId} type="month" value={weightMonth} onChange={(e) => setWeightMonth(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={"wm-kg-" + personId}>Weight moved (kg, total)</label>
            <input
              id={"wm-kg-" + personId}
              type="number"
              step="1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="e.g. 24000"
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="primary" disabled={saving}>
              {saving ? "Saving…" : "Save weight moved"}
            </button>
            {error && <span className="error-text" style={{ marginTop: 0 }}>{error}</span>}
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Weight moved</th>
              <th>Swim</th>
              <th>Bike</th>
              <th>Run</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {training.length === 0 && (
              <tr className="row-empty">
                <td colSpan={6}>No training history yet.</td>
              </tr>
            )}
            {training.map((t) => (
              <tr key={t.month}>
                <td className="num">{t.month}</td>
                <td className="num">{t.weight_moved_kg != null ? Math.round(t.weight_moved_kg) + " kg" : "—"}</td>
                <td className="num">{t.swim_km != null ? t.swim_km + " km" : "—"}</td>
                <td className="num">{t.bike_km != null ? t.bike_km + " km" : "—"}</td>
                <td className="num">{t.run_km != null ? t.run_km + " km" : "—"}</td>
                <td>{t.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
