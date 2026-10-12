"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

// Type-ahead over the food database (/api/foods: Fineli + your own foods,
// searchable by Estonian, English or Finnish name or any synonym). Picking a
// result calls onPick with an ingredient in the shape recipeMath expects
// (name, grams, *Per100g, foodId), grams defaulting to 100. If nothing fits,
// the last row offers to add what you typed as your own food.
export default function FoodSearch({ id, onPick, placeholder }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(null); // null | draft for a new custom food
  const boxRef = useRef(null);
  const debounceRef = useRef(null);
  const requestRef = useRef(0);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function search(v) {
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const req = ++requestRef.current;
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/foods?q=" + encodeURIComponent(v));
        const data = await res.json();
        if (req !== requestRef.current) return; // a newer keystroke's search already went out
        if (!res.ok) throw new Error(data.error || "Search failed");
        setResults(data.entries || []);
      } catch (err) {
        if (req === requestRef.current) setError(err.message);
      } finally {
        if (req === requestRef.current) setLoading(false);
      }
    }, 200);
  }

  function pick(food) {
    onPick({
      name: food.name,
      grams: "100",
      caloriesPer100g: food.caloriesPer100g,
      proteinPer100g: food.proteinPer100g,
      carbsPer100g: food.carbsPer100g,
      fatPer100g: food.fatPer100g,
      fiberPer100g: food.fiberPer100g,
      foodId: food.id
    });
    setQ("");
    setResults([]);
    setOpen(false);
  }

  function startCreate() {
    setCreating({ name: q.trim(), aliases: "", caloriesPer100g: "", proteinPer100g: "", carbsPer100g: "", fatPer100g: "", fiberPer100g: "" });
    setOpen(false);
  }

  const trimmed = q.trim();

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        id={id}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          search(e.target.value);
        }}
        onFocus={() => search(q)}
        onKeyDown={(e) => {
          // This sits inside the log/recipe form — Enter should pick the top
          // match, not submit the whole meal half-built.
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (results.length && !loading) pick(results[0]);
        }}
        placeholder={placeholder || "Add ingredient — e.g. riis, kana, skyr"}
        autoComplete="off"
        enterKeyHint="search"
      />
      {open && (loading || results.length > 0 || trimmed || error) && (
        <div className="recipe-dropdown food-dropdown">
          {loading && results.length === 0 && <div className="recipe-dropdown-hint">Searching…</div>}
          {error && <div className="recipe-dropdown-hint">{error}</div>}
          {results.map((f) => (
            <button type="button" key={f.id} className="recipe-option food-option" onClick={() => pick(f)}>
              <span className="food-option-text">
                <span className="recipe-option-name">{f.name}</span>
                {(f.nameEn || f.source === "custom" || f.kind === "dish") && (
                  <span className="food-option-sub">
                    {f.source === "custom" ? "Your food" : f.kind === "dish" ? "Dish" : ""}
                    {f.nameEn ? (f.source === "custom" || f.kind === "dish" ? " · " : "") + f.nameEn : ""}
                  </span>
                )}
              </span>
              <span className="recipe-option-meta">
                {f.caloriesPer100g != null ? Math.round(f.caloriesPer100g) + " kcal" : "—"} · P {Math.round(f.proteinPer100g || 0)}g
                <span className="food-option-per">/100g</span>
              </span>
            </button>
          ))}
          {!loading && !error && !trimmed && results.length === 0 && (
            <div className="recipe-dropdown-hint">
              Type to search — Estonian, English or Finnish names all work.
              <span className="food-credit">Food data: Fineli, THL (CC BY 4.0)</span>
            </div>
          )}
          {!loading && trimmed && results.length === 0 && !error && <div className="recipe-dropdown-hint">No match for “{trimmed}”.</div>}
          {trimmed && (
            <button type="button" className="recipe-option food-option-add" onClick={startCreate}>
              <Plus size={14} strokeWidth={2} /> Add “{trimmed}” as your own food
            </button>
          )}
        </div>
      )}
      {creating && (
        <CustomFoodForm
          draft={creating}
          onCancel={() => setCreating(null)}
          onSaved={(food) => {
            setCreating(null);
            pick(food);
          }}
        />
      )}
    </div>
  );
}

// Inline "add your own food" form — for branded stuff (Profeel, a specific
// protein bar) Fineli doesn't have. Values are per 100g, straight off the
// packaging. Saved to the shared food list, so it's searchable next time.
function CustomFoodForm({ draft, onCancel, onSaved }) {
  const [f, setF] = useState(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key, value) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  // Not a <form>: this renders inside the log form / recipe form, and
  // nested forms aren't valid HTML — Enter in here would submit the outer one.
  async function save() {
    if (!f.name.trim() || f.caloriesPer100g === "") {
      setError("Needs a name and kcal per 100g.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved(data.food);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
  }

  const nums = [
    ["caloriesPer100g", "kcal"],
    ["proteinPer100g", "Protein"],
    ["carbsPer100g", "Carbs"],
    ["fatPer100g", "Fat"],
    ["fiberPer100g", "Fiber"]
  ];

  return (
    <div className="custom-food-form" onKeyDown={onKeyDown}>
      <div className="custom-food-title">New food — values per 100g, from the packaging</div>
      <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Name, e.g. Profeel metsmarja jook" aria-label="Food name" />
      <input value={f.aliases} onChange={(e) => set("aliases", e.target.value)} placeholder="Other search words, comma-separated (optional)" aria-label="Search words" />
      <div className="recipe-num-grid">
        {nums.map(([key, label]) => (
          <label key={key} className="recipe-num">
            <span>{label}</span>
            <input type="number" inputMode="decimal" value={f[key]} onChange={(e) => set(key, e.target.value)} />
          </label>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save & add"}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
        {error && <span className="error-text inline">{error}</span>}
      </div>
    </div>
  );
}
