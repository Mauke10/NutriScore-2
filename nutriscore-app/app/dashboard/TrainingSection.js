"use client";

import { useState } from "react";
import { Trash2, Pencil } from "lucide-react";
import { currentMonthStr, monthLabel, shortDateLabel, todayStr } from "./utils";
import MiniBarChart from "./MiniBarChart";
import Modal from "./Modal";

const SESSION_TYPES = [
  { key: "swim", label: "Swim" },
  { key: "bike", label: "Bike" },
  { key: "run", label: "Run" },
  { key: "strength", label: "Strength" },
  { key: "other", label: "Other" }
];

const emptySessionForm = { activityType: "swim", sessionDate: todayStr(), distanceKm: "", durationMin: "", notes: "" };
const emptyEditSessionForm = { activityType: "swim", sessionDate: todayStr(), distanceKm: "", durationMin: "", notes: "" };

export default function TrainingSection({
  personId,
  isMe,
  training,
  refreshTraining,
  sessions,
  refreshSessions,
  swimGoalKm,
  bikeGoalKm,
  runGoalKm,
  stravaStatus,
  refreshStravaStatus
}) {
  const [weightMonth, setWeightMonth] = useState(currentMonthStr());
  const [weightKg, setWeightKg] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const [sessionForm, setSessionForm] = useState(emptySessionForm);
  const [savingSession, setSavingSession] = useState(false);
  const [sessionError, setSessionError] = useState("");

  // Editing an existing manually-logged session, in its own modal — mirrors
  // the edit feature on meals/snacks (see SnackSection.js).
  const [editingSession, setEditingSession] = useState(null); // null | the session being edited
  const [editSessionForm, setEditSessionForm] = useState(emptyEditSessionForm);
  const [editSessionSaving, setEditSessionSaving] = useState(false);
  const [editSessionError, setEditSessionError] = useState("");

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

  // Goal progress combines whatever Strava synced for this month with
  // whatever's been logged by hand here — the two live in separate tables
  // (see migration_007) so a re-sync can never wipe out a manual entry.
  const stravaThisMonth = sorted.find((t) => t.month === thisMonth) || {};
  const manualKm = (type) =>
    (sessions || []).filter((s) => s.activity_type === type).reduce((sum, s) => sum + (Number(s.distance_km) || 0), 0);
  const actualSwimKm = (Number(stravaThisMonth.swim_km) || 0) + manualKm("swim");
  const actualBikeKm = (Number(stravaThisMonth.bike_km) || 0) + manualKm("bike");
  const actualRunKm = (Number(stravaThisMonth.run_km) || 0) + manualKm("run");

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

  function setSessionField(key, value) {
    setSessionForm((f) => ({ ...f, [key]: value }));
  }

  async function addSession(e) {
    e.preventDefault();
    if (sessionForm.distanceKm === "" && sessionForm.durationMin === "") {
      setSessionError("Add a distance or a duration.");
      return;
    }
    setSavingSession(true);
    setSessionError("");
    try {
      const res = await fetch("/api/training-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSessionForm({ ...emptySessionForm, activityType: sessionForm.activityType });
      await refreshSessions();
    } catch (err) {
      setSessionError(err.message);
    } finally {
      setSavingSession(false);
    }
  }

  async function removeSession(id) {
    await fetch("/api/training-sessions?id=" + id, { method: "DELETE" });
    await refreshSessions();
  }

  function setEditSessionField(key, value) {
    setEditSessionForm((f) => ({ ...f, [key]: value }));
  }

  function openEditSession(s) {
    setEditingSession(s);
    setEditSessionForm({
      activityType: s.activity_type || "swim",
      sessionDate: s.session_date || todayStr(),
      distanceKm: s.distance_km != null ? String(s.distance_km) : "",
      durationMin: s.duration_min != null ? String(s.duration_min) : "",
      notes: s.notes || ""
    });
    setEditSessionError("");
  }

  function closeEditSession() {
    setEditingSession(null);
  }

  async function saveEditSession(e) {
    e.preventDefault();
    if (editSessionForm.distanceKm === "" && editSessionForm.durationMin === "") {
      setEditSessionError("Add a distance or a duration.");
      return;
    }
    setEditSessionSaving(true);
    setEditSessionError("");
    try {
      const res = await fetch("/api/training-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingSession.id, ...editSessionForm })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setEditingSession(null);
      await refreshSessions();
    } catch (err) {
      setEditSessionError(err.message);
    } finally {
      setEditSessionSaving(false);
    }
  }

  return (
    <div className="card">
      <h3>
        Training volume <span className="muted">— {thisMonth}</span>
      </h3>

      <div className="bar-grid">
        <div className="bar-stat-wrap">
          <MiniBarChart label="Weight moved" unit="kg" history={weightHistory} seriesVar={personId === "laura" ? "--series-laura" : "--series-martin"} />
        </div>
        <div className="bar-stat-wrap">
          <MiniBarChart label="Swim" unit="km" history={swimHistory} seriesVar={personId === "laura" ? "--series-laura" : "--series-martin"} />
          <GoalProgress actual={actualSwimKm} goal={swimGoalKm} personId={personId} />
        </div>
        <div className="bar-stat-wrap">
          <MiniBarChart label="Bike" unit="km" history={bikeHistory} seriesVar={personId === "laura" ? "--series-laura" : "--series-martin"} />
          <GoalProgress actual={actualBikeKm} goal={bikeGoalKm} personId={personId} />
        </div>
        <div className="bar-stat-wrap">
          <MiniBarChart label="Run" unit="km" history={runHistory} seriesVar={personId === "laura" ? "--series-laura" : "--series-martin"} />
          <GoalProgress actual={actualRunKm} goal={runGoalKm} personId={personId} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2-5)", marginBottom: "var(--space-3-5)", flexWrap: "wrap" }}>
        {stravaStatus && stravaStatus.connected ? (
          <span className="status-text">
            Strava connected{stravaStatus.athleteId ? " (athlete " + stravaStatus.athleteId + ")" : ""}
          </span>
        ) : isMe ? (
          <a href="/api/strava/connect">
            <button type="button" className="ghost">
              Connect Strava
            </button>
          </a>
        ) : (
          <span className="status-text muted">Strava not connected yet</span>
        )}
        {stravaStatus && stravaStatus.connected && (
          <button type="button" className="ghost" onClick={syncNow} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        )}
      </div>

      {isMe && (
        <form onSubmit={saveWeight} style={{ marginBottom: "var(--space-5)" }}>
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
            {error && <span className="error-text inline">{error}</span>}
          </div>
        </form>
      )}

      {isMe && (
        <div style={{ marginBottom: "var(--space-5)" }}>
          <h4 className="panel-heading">Log a workout</h4>
          <form onSubmit={addSession}>
            <div className="field wide">
              <div className="segmented">
                {SESSION_TYPES.map((t) => (
                  <button
                    type="button"
                    key={t.key}
                    className={sessionForm.activityType === t.key ? "seg-btn selected" : "seg-btn"}
                    onClick={() => setSessionField("activityType", t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor={"sess-date-" + personId}>Date</label>
              <input
                id={"sess-date-" + personId}
                type="date"
                value={sessionForm.sessionDate}
                onChange={(e) => setSessionField("sessionDate", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={"sess-dist-" + personId}>Distance (km)</label>
              <input
                id={"sess-dist-" + personId}
                type="number"
                value={sessionForm.distanceKm}
                onChange={(e) => setSessionField("distanceKm", e.target.value)}
                placeholder="e.g. 2.5"
              />
            </div>
            <div className="field">
              <label htmlFor={"sess-dur-" + personId}>Duration (min)</label>
              <input
                id={"sess-dur-" + personId}
                type="number"
                value={sessionForm.durationMin}
                onChange={(e) => setSessionField("durationMin", e.target.value)}
                placeholder="e.g. 45"
              />
            </div>
            <div className="field wide">
              <label htmlFor={"sess-notes-" + personId}>Notes</label>
              <input
                id={"sess-notes-" + personId}
                value={sessionForm.notes}
                onChange={(e) => setSessionField("notes", e.target.value)}
                placeholder="optional"
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="primary" disabled={savingSession}>
                {savingSession ? "Saving…" : "Log it"}
              </button>
              {sessionError && <span className="error-text inline">{sessionError}</span>}
            </div>
          </form>

          {sessions && sessions.length > 0 && (
            <div className="log-cards" style={{ marginTop: "var(--space-2-5)" }}>
              {sessions.map((s) => (
                <div className="log-card-row" key={s.id}>
                  <div className="log-card-main">
                    <div className="log-card-top">
                      <span className="type-badge snack">{SESSION_TYPES.find((t) => t.key === s.activity_type)?.label || s.activity_type}</span>
                      <span className="log-card-desc">{s.notes || "—"}</span>
                    </div>
                    <div className="log-card-macros">
                      <span className="log-card-macro-text">
                        {s.distance_km != null ? s.distance_km + " km" : ""}
                        {s.distance_km != null && s.duration_min != null ? "  ·  " : ""}
                        {s.duration_min != null ? s.duration_min + " min" : ""}
                      </span>
                      <span className="log-card-date" title={s.session_date}>{shortDateLabel(s.session_date)}</span>
                    </div>
                  </div>
                  <div className="log-card-actions">
                    <button type="button" className="log-card-edit" onClick={() => openEditSession(s)} aria-label="Edit session">
                      <Pencil size={15} strokeWidth={2} />
                    </button>
                    <button type="button" className="log-card-remove" onClick={() => removeSession(s.id)} aria-label="Remove session">
                      <Trash2 size={15} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {editingSession && (
            <Modal title="Edit session" onClose={closeEditSession}>
              <form onSubmit={saveEditSession}>
                <div className="field wide">
                  <div className="segmented">
                    {SESSION_TYPES.map((t) => (
                      <button
                        type="button"
                        key={t.key}
                        className={editSessionForm.activityType === t.key ? "seg-btn selected" : "seg-btn"}
                        onClick={() => setEditSessionField("activityType", t.key)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor={"edit-sess-date-" + personId}>Date</label>
                  <input
                    id={"edit-sess-date-" + personId}
                    type="date"
                    value={editSessionForm.sessionDate}
                    onChange={(e) => setEditSessionField("sessionDate", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={"edit-sess-dist-" + personId}>Distance (km)</label>
                  <input
                    id={"edit-sess-dist-" + personId}
                    type="number"
                    value={editSessionForm.distanceKm}
                    onChange={(e) => setEditSessionField("distanceKm", e.target.value)}
                    placeholder="e.g. 2.5"
                  />
                </div>
                <div className="field">
                  <label htmlFor={"edit-sess-dur-" + personId}>Duration (min)</label>
                  <input
                    id={"edit-sess-dur-" + personId}
                    type="number"
                    value={editSessionForm.durationMin}
                    onChange={(e) => setEditSessionField("durationMin", e.target.value)}
                    placeholder="e.g. 45"
                  />
                </div>
                <div className="field wide">
                  <label htmlFor={"edit-sess-notes-" + personId}>Notes</label>
                  <input
                    id={"edit-sess-notes-" + personId}
                    value={editSessionForm.notes}
                    onChange={(e) => setEditSessionField("notes", e.target.value)}
                    placeholder="optional"
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="primary" disabled={editSessionSaving}>
                    {editSessionSaving ? "Saving…" : "Save changes"}
                  </button>
                  {editSessionError && <span className="error-text inline">{editSessionError}</span>}
                </div>
              </form>
            </Modal>
          )}
        </div>
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

function GoalProgress({ actual, goal, personId }) {
  if (goal == null || goal <= 0) return null;
  const pct = Math.max(0, Math.min(1, actual / goal));
  const met = actual >= goal;
  const color = met ? "var(--status-good)" : "var(" + (personId === "laura" ? "--series-laura" : "--series-martin") + ")";
  return (
    <div className="goal-progress">
      <div className="goal-progress-track">
        <div className="goal-progress-fill" style={{ width: pct * 100 + "%", background: color }} />
      </div>
      <div className="goal-progress-label">
        {Math.round(actual * 10) / 10} / {goal} km goal
      </div>
    </div>
  );
}
