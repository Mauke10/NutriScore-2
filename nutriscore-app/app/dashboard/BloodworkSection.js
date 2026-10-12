"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Modal from "./Modal";
import { dayMonthLabel, todayStr } from "./utils";

const MARKERS = [
  { key: "ferritin", col: "ferritin", label: "Ferritin", placeholder: "e.g. 28 ng/mL" },
  { key: "b12", col: "b12", label: "B12", placeholder: "e.g. 310 pg/mL" },
  { key: "folate", col: "folate", label: "Folate", placeholder: "" },
  { key: "vitaminD", col: "vitamin_d", label: "Vitamin D", placeholder: "e.g. 22 ng/mL" }
];

function rowToForm(b) {
  return {
    panelDate: b?.panel_date || todayStr(),
    ferritin: b?.ferritin || "",
    b12: b?.b12 || "",
    folate: b?.folate || "",
    vitaminD: b?.vitamin_d || "",
    notes: b?.notes || ""
  };
}

export default function BloodworkSection({ personId, isMe, bloodwork, refreshBloodwork }) {
  // null = closed, {} = new panel, a row = editing that panel. bloodwork is
  // unique on (person_id, panel_date), so the POST upserts — saving with the
  // same date overwrites that panel in place.
  const [editing, setEditing] = useState(null);
  const latest = bloodwork[0];
  const earlier = bloodwork.slice(1);

  return (
    <div className="card">
      <div className="card-head">
        <h3>Bloodwork</h3>
        {isMe && (
          <button type="button" className="ghost sm card-head-action" onClick={() => setEditing({})}>
            <Plus size={14} strokeWidth={2} /> Add panel
          </button>
        )}
      </div>

      {!latest && <p className="status-text muted">No panels logged yet.</p>}

      {latest && (
        <>
          <div className="overline">Latest · {dayMonthLabel(latest.panel_date)}</div>
          <div className="marker-grid">
            {MARKERS.map((m) => (
              <div key={m.key} className="marker-tile">
                <div className="marker-label">{m.label}</div>
                <div className={latest[m.col] ? "marker-value" : "marker-value empty"}>{latest[m.col] || "—"}</div>
              </div>
            ))}
          </div>
          {latest.notes && <p className="form-hint">{latest.notes}</p>}
          {isMe && (
            <button type="button" className="ghost sm" onClick={() => setEditing(latest)}>
              Edit this panel
            </button>
          )}
        </>
      )}

      {earlier.length > 0 && (
        <>
          <div className="overline group-list-label">Earlier panels</div>
          <div className="group-list">
            {earlier.map((b) => {
              const Row = isMe ? "button" : "div";
              const summary = MARKERS.filter((m) => b[m.col])
                .map((m) => m.label + " " + b[m.col])
                .join(" · ");
              return (
                <Row key={b.panel_date} {...(isMe ? { type: "button", onClick: () => setEditing(b) } : {})} className="group-row">
                  <span className="group-row-main">
                    <span className="group-row-title">{dayMonthLabel(b.panel_date)}</span>
                    {summary && <span className="group-row-value">{summary}</span>}
                  </span>
                </Row>
              );
            })}
          </div>
        </>
      )}

      {editing && (
        <PanelForm
          personId={personId}
          existing={editing.panel_date ? editing : null}
          onSaved={refreshBloodwork}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function PanelForm({ personId, existing, onSaved, onClose }) {
  const [form, setForm] = useState(() => rowToForm(existing));
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
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete the panel from " + dayMonthLabel(existing.panel_date) + "?")) return;
    await fetch("/api/bloodwork?panelDate=" + existing.panel_date, { method: "DELETE" });
    await onSaved();
    onClose();
  }

  return (
    <Modal title={existing ? "Panel · " + dayMonthLabel(existing.panel_date) : "New bloodwork panel"} onClose={onClose}>
      <form onSubmit={submit} className="group-form">
        <div className="field wide">
          <label htmlFor={"panel-" + personId}>Panel date</label>
          <input
            id={"panel-" + personId}
            type="date"
            value={form.panelDate}
            disabled={!!existing}
            onChange={(e) => setField("panelDate", e.target.value)}
          />
        </div>
        {MARKERS.map((m) => (
          <div key={m.key} className="field">
            <label htmlFor={m.key + "-" + personId}>{m.label}</label>
            <input id={m.key + "-" + personId} value={form[m.key]} onChange={(e) => setField(m.key, e.target.value)} placeholder={m.placeholder} />
          </div>
        ))}
        <div className="field wide">
          <label htmlFor={"bwnotes-" + personId}>Notes</label>
          <textarea id={"bwnotes-" + personId} value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Supplement doses, doctor notes…" />
        </div>
        <div className="form-actions">
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Saving…" : "Save panel"}
          </button>
          {existing && (
            <button type="button" className="danger" onClick={remove} disabled={saving}>
              Delete
            </button>
          )}
          {error && <span className="error-text inline">{error}</span>}
        </div>
      </form>
    </Modal>
  );
}
