"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { foodIcon } from "../../lib/foodIcons";

const NUMS = [
  ["caloriesPer100g", "kcal"],
  ["proteinPer100g", "Protein"],
  ["carbsPer100g", "Carbs"],
  ["fatPer100g", "Fat"],
  ["fiberPer100g", "Fiber"]
];

// Drawer → My foods: the foods you two added yourselves (from the food
// search's "Add as your own food"). Tap one to fix its name or numbers, or
// delete it. Recipes keep their own copy of the numbers, so nothing already
// saved changes.
export default function MyFoodsPanel({ onClose }) {
  const [foods, setFoods] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // draft of the food being edited

  async function load() {
    try {
      const res = await fetch("/api/foods?custom=1");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load foods");
      setFoods(data.entries || []);
    } catch (err) {
      setError(err.message);
      setFoods([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Modal title="My foods" onClose={onClose}>
      <p className="panel-desc">Foods you added yourselves. Changing one doesn't change recipes you already saved.</p>
      {error && <p className="error-text">{error}</p>}
      {foods === null ? (
        <p className="status-text muted">Loading…</p>
      ) : foods.length === 0 ? (
        <p className="status-text muted">Nothing yet. When a food isn't in the search, use "Add … as your own food" and it shows up here.</p>
      ) : (
        <div className="group-list">
          {foods.map((f) =>
            editing && editing.id === f.id ? (
              <FoodEditor
                key={f.id}
                draft={editing}
                onCancel={() => setEditing(null)}
                onSaved={async () => {
                  setEditing(null);
                  await load();
                }}
              />
            ) : (
              <button key={f.id} type="button" className="group-row" onClick={() => setEditing({ ...f, aliases: (f.aliases || []).join(", ") })}>
                <span className="food-icon" aria-hidden="true">
                  {foodIcon(f)}
                </span>
                <span className="group-row-main">
                  <span className="group-row-title">{f.name}</span>
                  <span className="group-row-value">
                    {Math.round(f.caloriesPer100g)} kcal · P {Math.round(f.proteinPer100g || 0)} g per 100 g
                    {f.createdBy ? " · added by " + (f.createdBy === "laura" ? "Laura" : "Martin") : ""}
                  </span>
                </span>
              </button>
            )
          )}
        </div>
      )}
    </Modal>
  );
}

function FoodEditor({ draft, onCancel, onSaved }) {
  const [f, setF] = useState(() => {
    const d = { ...draft };
    for (const [k] of NUMS) d[k] = d[k] == null ? "" : String(d[k]);
    return d;
  });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    setBusy("save");
    setError("");
    try {
      const res = await fetch("/api/foods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: f.id, name: f.name, aliases: f.aliases, ...Object.fromEntries(NUMS.map(([k]) => [k, f[k]])) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      await onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    setError("");
    try {
      const res = await fetch("/api/foods?id=" + f.id, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      await onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  return (
    <div className="custom-food-form my-food-editor">
      <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Food name" />
      <input value={f.aliases} onChange={(e) => setF({ ...f, aliases: e.target.value })} placeholder="Other search words, comma-separated" aria-label="Search words" />
      <div className="recipe-num-grid">
        {NUMS.map(([key, label]) => (
          <label key={key} className="recipe-num">
            <span>{label}</span>
            <input type="number" inputMode="decimal" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="primary" onClick={save} disabled={busy !== null}>
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button type="button" className="ghost" onClick={onCancel} disabled={busy !== null}>
          Cancel
        </button>
        {confirmDelete ? (
          <button type="button" className="danger" onClick={remove} disabled={busy !== null} style={{ marginLeft: "auto" }}>
            {busy === "delete" ? "Deleting…" : "Yes, delete"}
          </button>
        ) : (
          <button type="button" className="danger" onClick={() => setConfirmDelete(true)} style={{ marginLeft: "auto" }}>
            Delete
          </button>
        )}
      </div>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
