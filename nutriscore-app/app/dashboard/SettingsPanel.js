"use client";

import { useState } from "react";
import Modal from "./Modal";

export default function SettingsPanel({ personId, stravaStatus, refreshStravaStatus, refreshTraining, onClose }) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");

  async function syncNow() {
    setSyncing(true);
    setMsg("");
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
      setMsg("Synced " + data.activityCount + " activities.");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      <div>
        <h4 style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Strava</h4>
        {stravaStatus && stravaStatus.connected ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Connected{stravaStatus.athleteId ? " (athlete " + stravaStatus.athleteId + ")" : ""}</span>
            <button type="button" className="ghost" onClick={syncNow} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          </div>
        ) : (
          <a href="/api/strava/connect">
            <button type="button" className="ghost">
              Connect Strava
            </button>
          </a>
        )}
      </div>

      {msg && <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 16 }}>{msg}</p>}
    </Modal>
  );
}
