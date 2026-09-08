"use client";

import { useState } from "react";
import { mondayOf } from "./utils";

const emptyForm = {
  weekStart: mondayOf(new Date()),
  weightKg: "",
  waistCm: "",
  sessions: "",
  avgRpe: "",
  hrBaseMin: "",
  hrHardMin: "",
  sleepAvgHrs: "",
  supplementDays: "",
  nutritionAdherencePct: "",
  caloriesAvg: "",
  proteinAvg: "",
  notes: ""
};

export default function WeeklySection({ personId, isMe, weekly, refreshWeekly }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.weekStart) {
      setError("Pick the Monday this week starts on.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setForm({ ...emptyForm, weekStart: form.weekStart });
      await refreshWeekly();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(weekStart) {
    await fetch("/api/weekly?weekStart=" + weekStart, { method: "DELETE" });
    await refreshWeekly();
  }

  const recent = weekly.slice(0, 12);

  return (
    <div className="card">
      <h3>Weekly log</h3>

      {isMe && (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor={"ws-" + personId}>Week of (Mon)</label>
            <input id={"ws-" + personId} type="date" value={form.weekStart} onChange={(e) => setField("weekStart", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={"wk-" + personId}>Weight (kg)</label>
            <input id={"wk-" + personId} type="number" step="0.1" value={form.weightKg} onChange={(e) => setField("weightKg", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={"waist-" + personId}>Waist (cm)</label>
            <input id={"waist-" + personId} type="number" step="0.1" value={form.waistCm} onChange={(e) => setField("waistCm", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={"sess-" + personId}>Sessions</label>
            <input id={"sess-" + personId} type="number" value={form.sessions} onChange={(e) => setField("sessions", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={"rpe-" + personId}>Avg RPE</label>
            <input id={"rpe-" + personId} type="number" step="0.5" value={form.avgRpe} onChange={(e) => setField("avgRpe", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={"hrb-" + personId}>HR base (min)</label>
            <input id={"hrb-" + personId} type="number" value={form.hrBaseMin} onChange={(e) => setField("hrBaseMin", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={"hrh-" + personId}>HR hard (min)</label>
            <input id={"hrh-" + personId} type="number" value={form.hrHardMin} onChange={(e) => setField("hrHardMin", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={"sleep-" + personId}>Avg sleep (h)</label>
            <input id={"sleep-" + personId} type="number" step="0.1" value={form.sleepAvgHrs} onChange={(e) => setField("sleepAvgHrs", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={"supp-" + personId}>Supplement days (/7)</label>
            <input id={"supp-" + personId} type="number" max="7" value={form.supplementDays} onChange={(e) => setField("supplementDays", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={"nutr-" + personId}>Nutrition adherence (%)</label>
            <input id={"nutr-" + personId} type="number" value={form.nutritionAdherencePct} onChange={(e) => setField("nutritionAdherencePct", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={"calavg-" + personId}>Avg kcal/day</label>
            <input id={"calavg-" + personId} type="number" value={form.caloriesAvg} onChange={(e) => setField("caloriesAvg", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={"protavg-" + personId}>Avg protein (g/day)</label>
            <input id={"protavg-" + personId} type="number" value={form.proteinAvg} onChange={(e) => setField("proteinAvg", e.target.value)} />
          </div>
          <div className="field wide">
            <label htmlFor={"notes-" + personId}>Notes</label>
            <textarea id={"notes-" + personId} value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
          </div>
          <div className="form-actions">
            <button type="submit" className="primary" disabled={saving}>
              {saving ? "Saving…" : "Save week"}
            </button>
            {error && <span className="error-text" style={{ marginTop: 0 }}>{error}</span>}
          </div>
        </form>
      )}

      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr>
              <th>Week of</th>
              <th>Weight</th>
              <th>Sessions</th>
              <th>Sleep</th>
              <th>Supps</th>
              <th>Nutrition</th>
              <th>Notes</th>
              {isMe && <th></th>}
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr className="row-empty">
                <td colSpan={isMe ? 8 : 7}>No weeks logged yet.</td>
              </tr>
            )}
            {recent.map((w) => (
              <tr key={w.week_start}>
                <td className="num">{w.week_start}</td>
                <td className="num">{w.weight_kg != null ? w.weight_kg + " kg" : "—"}</td>
                <td className="num">{w.sessions != null ? w.sessions : "—"}</td>
                <td className="num">{w.sleep_avg_hrs != null ? w.sleep_avg_hrs + "h" : "—"}</td>
                <td className="num">{w.supplement_days != null ? w.supplement_days + "/7" : "—"}</td>
                <td className="num">{w.nutrition_adherence_pct != null ? w.nutrition_adherence_pct + "%" : "—"}</td>
                <td className="notes">{w.notes}</td>
                {isMe && (
                  <td>
                    <button type="button" className="danger" onClick={() => removeEntry(w.week_start)}>
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
