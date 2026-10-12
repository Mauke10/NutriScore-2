"use client";

import { useState } from "react";
import Modal from "./Modal";

const emptyPinForm = { currentPin: "", newPin: "", confirmPin: "" };

export default function SettingsPanel({ personId, stravaStatus, refreshStravaStatus, refreshTraining, onClose }) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");

  const [pinForm, setPinForm] = useState(emptyPinForm);
  const [pinSaving, setPinSaving] = useState(false);
  const [pinMsg, setPinMsg] = useState("");
  const [pinError, setPinError] = useState("");

  function setPinField(key, value) {
    setPinForm((f) => ({ ...f, [key]: value }));
  }

  async function changePin(e) {
    e.preventDefault();
    setPinError("");
    setPinMsg("");
    if (!pinForm.currentPin || !pinForm.newPin) {
      setPinError("Fill in your current PIN and a new one.");
      return;
    }
    if (pinForm.newPin !== pinForm.confirmPin) {
      setPinError("New PIN and confirmation don't match.");
      return;
    }
    setPinSaving(true);
    try {
      const res = await fetch("/api/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin: pinForm.currentPin, newPin: pinForm.newPin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't change your PIN.");
      setPinForm(emptyPinForm);
      setPinMsg("PIN changed.");
    } catch (err) {
      setPinError(err.message);
    } finally {
      setPinSaving(false);
    }
  }

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
        <h4 className="panel-heading">Strava</h4>
        {stravaStatus && stravaStatus.connected ? (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2-5)", flexWrap: "wrap" }}>
            <span className="status-text">Connected{stravaStatus.athleteId ? " (athlete " + stravaStatus.athleteId + ")" : ""}</span>
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

      {msg && <p className="status-text spaced">{msg}</p>}

      <div className="panel-section">
        <h4 className="panel-heading">Change your PIN</h4>
        <p className="panel-desc">
          This only changes your own login PIN — {personId === "laura" ? "Martin's" : "Laura's"} stays whatever it is now.
        </p>
        <form onSubmit={changePin}>
          <div className="field wide">
            <label htmlFor="pin-current">Current PIN</label>
            <input
              id="pin-current"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pinForm.currentPin}
              onChange={(e) => setPinField("currentPin", e.target.value)}
              placeholder="••••"
            />
          </div>
          <div className="field">
            <label htmlFor="pin-new">New PIN</label>
            <input
              id="pin-new"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pinForm.newPin}
              onChange={(e) => setPinField("newPin", e.target.value)}
              placeholder="••••"
            />
          </div>
          <div className="field">
            <label htmlFor="pin-confirm">Confirm new PIN</label>
            <input
              id="pin-confirm"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pinForm.confirmPin}
              onChange={(e) => setPinField("confirmPin", e.target.value)}
              placeholder="••••"
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="primary" disabled={pinSaving}>
              {pinSaving ? "Saving…" : "Change PIN"}
            </button>
            {pinError && <span className="error-text inline">{pinError}</span>}
            {!pinError && pinMsg && <span className="success-text">{pinMsg}</span>}
          </div>
        </form>
      </div>
    </Modal>
  );
}
