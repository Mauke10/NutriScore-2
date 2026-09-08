"use client";

import { useState } from "react";
import { todayStr } from "./utils";

const emptyForm = {
  panelDate: todayStr(),
  ferritin: "",
  b12: "",
  folate: "",
  vitaminD: "",
  notes: ""
};

export default function BloodworkSection({ personId, isMe, bloodwork, refreshBloodwork }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.panelDate) {
      setError("Panel date is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/bloodwork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setForm({ ...emptyForm, panelDate: form.panelDate });
      await refreshBloodwork();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(panelDate) {
    await fetch("/api/bloodwork?panelDate=" + panelDate, { method: "DELETE" });
    await refreshBloodwork();
  }

  return (
    <div className="card">
      <h3>Bloodwork & supplements</h3>

      {isMe && (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor={"panel-" + personId}>Panel date</label>
            <input id={"panel-" + personId} type="date" value={form.panelDate} onChange={(e) => setField("panelDate", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={"ferr-" + personId}>Ferritin</label>
            <input id={"ferr-" + personId} value={form.ferritin} onChange={(e) => setField("ferritin", e.target.value)} placeholder="e.g. 28 ng/mL" />
          </div>
          <div className="field">
            <label htmlFor={"b12-" + personId}>B12</label>
            <input id={"b12-" + personId} value={form.b12} onChange={(e) => setField("b12", e.target.value)} placeholder="e.g. 310 pg/mL" />
          </div>
          <div className="field">
            <label htmlFor={"fol-" + personId}>Folate</label>
            <input id={"fol-" + personId} value={form.folate} onChange={(e) => setField("folate", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={"vitd-" + personId}>Vitamin D</label>
            <input id={"vitd-" + personId} value={form.vitaminD} onChange={(e) => setField("vitaminD", e.target.value)} placeholder="e.g. 22 ng/mL" />
          </div>
          <div className="field wide">
            <label htmlFor={"bwnotes-" + personId}>Notes</label>
            <textarea id={"bwnotes-" + personId} value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Supplement doses, doctor notes…" />
          </div>
          <div className="form-actions">
            <button type="submit" className="primary" disabled={saving}>
              {saving ? "Saving…" : "Save panel"}
            </button>
            {error && <span className="error-text" style={{ marginTop: 0 }}>{error}</span>}
          </div>
        </form>
      )}

      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Ferritin</th>
              <th>B12</th>
              <th>Folate</th>
              <th>Vit D</th>
              <th>Notes</th>
              {isMe && <th></th>}
            </tr>
          </thead>
          <tbody>
            {bloodwork.length === 0 && (
              <tr className="row-empty">
                <td colSpan={isMe ? 7 : 6}>No panels logged yet.</td>
              </tr>
            )}
            {bloodwork.map((b) => (
              <tr key={b.panel_date}>
                <td className="num">{b.panel_date}</td>
                <td className="num">{b.ferritin || "—"}</td>
                <td className="num">{b.b12 || "—"}</td>
                <td className="num">{b.folate || "—"}</td>
                <td className="num">{b.vitamin_d || "—"}</td>
                <td className="notes">{b.notes}</td>
                {isMe && (
                  <td>
                    <button type="button" className="danger" onClick={() => removeEntry(b.panel_date)}>
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
