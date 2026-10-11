"use client";

import { useState } from "react";
import Modal from "./Modal";

// Every standing target lives here now: the daily calorie/protein numbers
// that used to sit in Settings, plus the monthly swim/bike/run distance
// goals that TrainingSection measures Strava + manually-logged sessions
// against. One form, one save — /api/targets upserts whichever fields are
// present and leaves the rest alone.
export default function GoalsPanel({
  personId,
  calorieTarget,
  proteinTarget,
  swimGoalKm,
  bikeGoalKm,
  runGoalKm,
  refreshTarget,
  onClose
}) {
  const [form, setForm] = useState({
    calorieTarget: calorieTarget != null ? String(calorieTarget) : "",
    proteinTarget: proteinTarget != null ? String(proteinTarget) : "",
    swimGoalKm: swimGoalKm != null ? String(swimGoalKm) : "",
    bikeGoalKm: bikeGoalKm != null ? String(bikeGoalKm) : "",
    runGoalKm: runGoalKm != null ? String(runGoalKm) : ""
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      await refreshTarget();
      setMsg("Saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Goals" onClose={onClose}>
      <form onSubmit={save} className="section-form">
        <div className="field">
          <label htmlFor={"goal-cal-" + personId}>Daily calories</label>
          <input
            id={"goal-cal-" + personId}
            type="number"
            value={form.calorieTarget}
            onChange={(e) => setField("calorieTarget", e.target.value)}
            placeholder="kcal/day"
          />
        </div>
        <div className="field">
          <label htmlFor={"goal-prot-" + personId}>Daily protein</label>
          <input
            id={"goal-prot-" + personId}
            type="number"
            value={form.proteinTarget}
            onChange={(e) => setField("proteinTarget", e.target.value)}
            placeholder="g/day"
          />
        </div>

        <div className="field wide">
          <label style={{ marginTop: 6 }}>Monthly training distance</label>
        </div>
        <div className="field">
          <label htmlFor={"goal-swim-" + personId}>Swim</label>
          <input
            id={"goal-swim-" + personId}
            type="number"
            value={form.swimGoalKm}
            onChange={(e) => setField("swimGoalKm", e.target.value)}
            placeholder="km/month"
          />
        </div>
        <div className="field">
          <label htmlFor={"goal-bike-" + personId}>Bike</label>
          <input
            id={"goal-bike-" + personId}
            type="number"
            value={form.bikeGoalKm}
            onChange={(e) => setField("bikeGoalKm", e.target.value)}
            placeholder="km/month"
          />
        </div>
        <div className="field">
          <label htmlFor={"goal-run-" + personId}>Run</label>
          <input
            id={"goal-run-" + personId}
            type="number"
            value={form.runGoalKm}
            onChange={(e) => setField("runGoalKm", e.target.value)}
            placeholder="km/month"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          {msg && <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{msg}</span>}
        </div>
      </form>
    </Modal>
  );
}
