"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Plus, Search, Trash2 } from "lucide-react";
import Modal from "./Modal";
import { scaledIngredient, sumIngredients } from "./recipeMath";
import FoodSearch from "./FoodSearch";
import { foodIcon } from "../../lib/foodIcons";

const blankRecipe = { id: null, name: "", meal_type: "meal", portion_note: "", ingredients: [] };

const MACROS = [
  ["protein", "Protein", "P", "var(--macro-protein)"],
  ["carbs", "Carbs", "C", "var(--macro-carbs)"],
  ["fat", "Fat", "F", "var(--macro-fat)"],
  ["fiber", "Fiber", "Fi", "var(--macro-fiber)"]
];

function newKey() {
  return Math.random().toString(36).slice(2);
}

export default function RecipesPanel({ onClose }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null); // null = list view, object = editor
  const debounceRef = useRef(null);

  async function load(query) {
    setLoading(true);
    try {
      const res = await fetch("/api/recipes?limit=200" + (query ? "&q=" + encodeURIComponent(query) : ""));
      const data = await res.json();
      setList(data.entries || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSearch(v) {
    setQ(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(v), 250);
  }

  return (
    <Modal title={selected ? (selected.id ? "Edit recipe" : "New recipe") : "Recipes"} onClose={onClose} wide>
      {!selected ? (
        <RecipeList list={list} loading={loading} q={q} onSearch={onSearch} onPick={setSelected} onNew={() => setSelected(blankRecipe)} />
      ) : (
        <RecipeEditor
          recipe={selected}
          onBack={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            load(q);
          }}
        />
      )}
    </Modal>
  );
}

function RecipeList({ list, loading, q, onSearch, onPick, onNew }) {
  const searching = q.trim() !== "";
  return (
    <div>
      <div className="recipe-toolbar">
        <div className="recipe-search">
          <Search size={15} strokeWidth={2} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => onSearch(e.target.value)} placeholder="Search recipes" aria-label="Search recipes" />
        </div>
        <button type="button" className="primary recipe-new-btn" onClick={onNew}>
          <Plus size={15} strokeWidth={2.2} /> New
        </button>
      </div>

      {loading && list.length === 0 && <p className="status-text muted">Loading…</p>}

      {!loading && list.length === 0 && (
        <div className="recipe-empty">
          {searching ? (
            <p>No recipe matches “{q.trim()}”.</p>
          ) : (
            <>
              <p>No saved recipes yet. Build one from ingredients once, then log it in two taps.</p>
              <button type="button" className="primary recipe-new-btn" onClick={onNew}>
                <Plus size={15} strokeWidth={2.2} /> Create your first recipe
              </button>
            </>
          )}
        </div>
      )}

      {list.length > 0 && (
        <div className="recipe-cards">
          {list.map((r) => (
            <button type="button" key={r.id} className="recipe-card" onClick={() => onPick(r)}>
              <span className="recipe-card-main">
                <span className="recipe-card-top">
                  <span className="recipe-card-name">{r.name}</span>
                  <span className={r.meal_type === "snack" ? "type-badge snack" : "type-badge meal"}>{r.meal_type === "snack" ? "Snack" : "Meal"}</span>
                </span>
                <span className="recipe-card-meta">
                  P {fmt(r.protein_g)} · C {fmt(r.carbs_g)} · F {fmt(r.fat_g)}
                  {r.ingredients && r.ingredients.length ? " · " + r.ingredients.length + (r.ingredients.length === 1 ? " ingredient" : " ingredients") : ""}
                </span>
                {r.portion_note && <span className="recipe-card-note">{r.portion_note}</span>}
              </span>
              <span className="recipe-card-cal">
                <span className="v">{r.calories != null ? Math.round(r.calories) : "—"}</span>
                <span className="u">kcal</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function fmt(g) {
  return g != null ? Math.round(g) + "g" : "—";
}

function toEditable(ing, open = false) {
  const str = (v) => (v != null && v !== "" ? String(v) : "");
  return {
    key: newKey(),
    open,
    name: ing.name || "",
    grams: str(ing.grams),
    caloriesPer100g: str(ing.caloriesPer100g),
    proteinPer100g: str(ing.proteinPer100g),
    carbsPer100g: str(ing.carbsPer100g),
    fatPer100g: str(ing.fatPer100g),
    fiberPer100g: str(ing.fiberPer100g),
    foodId: ing.foodId || null
  };
}

function RecipeEditor({ recipe, onBack, onSaved }) {
  const [name, setName] = useState(recipe.name || "");
  const [mealType, setMealType] = useState(recipe.meal_type === "snack" ? "snack" : "meal");
  const [portionNote, setPortionNote] = useState(recipe.portion_note || "");
  const [ingredients, setIngredients] = useState(() => (recipe.ingredients || []).map((ing) => toEditable(ing)));
  // Recipes saved without a breakdown (the quick "save as a recipe" tick on
  // the log form) only have totals — those stay editable directly until
  // ingredients are added.
  const [fixed, setFixed] = useState(() => ({
    calories: recipe.calories != null ? String(Math.round(recipe.calories)) : "",
    protein: recipe.protein_g != null ? String(Math.round(recipe.protein_g)) : "",
    carbs: recipe.carbs_g != null ? String(Math.round(recipe.carbs_g)) : "",
    fat: recipe.fat_g != null ? String(Math.round(recipe.fat_g)) : "",
    fiber: recipe.fiber_g != null ? String(Math.round(recipe.fiber_g)) : ""
  }));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const focusKeyRef = useRef(null); // row whose first field should take focus when it mounts

  const hasIngredients = ingredients.length > 0;
  const totals = hasIngredients
    ? sumIngredients(ingredients)
    : { calories: num(fixed.calories), protein: num(fixed.protein), carbs: num(fixed.carbs), fat: num(fixed.fat), fiber: num(fixed.fiber) };
  const totalGrams = ingredients.reduce((sum, ing) => sum + num(ing.grams), 0);

  function updateRow(key, patch) {
    focusKeyRef.current = null; // only a freshly added row grabs focus, not one reopened later
    setIngredients((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key) {
    setIngredients((rows) => rows.filter((row) => row.key !== key));
  }

  function addFood(ing) {
    const row = toEditable(ing);
    focusKeyRef.current = row.key;
    setIngredients((rows) => [...rows, row]);
  }

  function addManual() {
    const row = toEditable({ grams: "100" }, true);
    focusKeyRef.current = row.key;
    setIngredients((rows) => [...rows, row]);
  }

  async function save(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give it a name.");
      return;
    }
    const unnamed = ingredients.find((ing) => !ing.name.trim());
    if (unnamed) {
      updateRow(unnamed.key, { open: true });
      setError("One ingredient has no name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: recipe.id || undefined,
          name,
          mealType,
          portionNote,
          ingredients,
          // Only used when there are no ingredients (see /api/recipes).
          calories: fixed.calories,
          proteinG: fixed.protein,
          carbsG: fixed.carbs,
          fatG: fixed.fat,
          fiberG: fixed.fiber
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/recipes?id=" + recipe.id, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
      onSaved();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={save} className="recipe-editor">
      <button type="button" className="recipe-back" onClick={onBack}>
        <ChevronLeft strokeWidth={2} size={16} /> All recipes
      </button>

      <input
        className="recipe-name-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Recipe name, e.g. Lõhe ja riis"
        aria-label="Recipe name"
        autoFocus={!recipe.id}
      />

      <div className="recipe-meta-row">
        <div className="segmented" role="group" aria-label="Logged as">
          <button type="button" className={mealType === "meal" ? "seg-btn selected" : "seg-btn"} onClick={() => setMealType("meal")}>
            Meal
          </button>
          <button type="button" className={mealType === "snack" ? "seg-btn selected" : "seg-btn"} onClick={() => setMealType("snack")}>
            Snack
          </button>
        </div>
        <input
          className="recipe-portion-input"
          value={portionNote}
          onChange={(e) => setPortionNote(e.target.value)}
          placeholder="Portion note — e.g. 1 mealprep box"
          aria-label="Portion note"
        />
      </div>

      <section className="recipe-section">
        <div className="recipe-section-head">
          <h4>Ingredients</h4>
          {hasIngredients && (
            <span className="muted">
              {ingredients.length} · {Math.round(totalGrams)} g
            </span>
          )}
        </div>

        <FoodSearch id="recipe-food-search" onPick={addFood} placeholder="Search foods to add — e.g. riis, kana" />

        {hasIngredients && (
          <ul className="recipe-ings">
            {ingredients.map((ing) => (
              <IngredientRow
                key={ing.key}
                ing={ing}
                autoFocus={ing.key === focusKeyRef.current}
                onChange={(patch) => updateRow(ing.key, patch)}
                onRemove={() => removeRow(ing.key)}
              />
            ))}
          </ul>
        )}

        <button type="button" className="recipe-add-manual" onClick={addManual}>
          <Plus size={14} strokeWidth={2} /> Add an ingredient manually
        </button>

        {!hasIngredients && (
          <div className="recipe-fixed">
            <p className="recipe-fixed-hint">
              {recipe.id && recipe.calories != null
                ? "This recipe has totals but no ingredient list. Edit them here, or add ingredients above to have them calculated."
                : "No ingredient list? Enter the recipe's totals instead."}
            </p>
            <div className="recipe-num-grid">
              <NumField label="kcal" value={fixed.calories} onChange={(v) => setFixed((f) => ({ ...f, calories: v }))} />
              {MACROS.map(([k, label]) => (
                <NumField key={k} label={label + " (g)"} value={fixed[k]} onChange={(v) => setFixed((f) => ({ ...f, [k]: v }))} />
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="recipe-footer">
        <div className="recipe-footer-totals" aria-live="polite">
          <span className="recipe-footer-kcal">
            <strong>{Math.round(totals.calories)}</strong> kcal
          </span>
          <span className="recipe-footer-macros">
            {MACROS.map(([k, label, short, color]) => (
              <span key={k} className="recipe-footer-macro" title={label}>
                <span className="m-dot" style={{ background: color }} />
                {short} {Math.round(totals[k])}g
              </span>
            ))}
          </span>
        </div>
        <div className="recipe-footer-actions">
          {recipe.id &&
            (confirmDelete ? (
              <span className="recipe-confirm">
                Delete?
                <button type="button" className="danger" onClick={remove} disabled={deleting}>
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button type="button" className="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" className="danger" onClick={() => setConfirmDelete(true)} aria-label="Delete recipe">
                <Trash2 strokeWidth={2} size={14} /> Delete
              </button>
            ))}
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Saving…" : "Save recipe"}
          </button>
        </div>
        {error && <div className="error-text inline recipe-footer-error">{error}</div>}
      </div>
    </form>
  );
}

// One ingredient: name, grams and what that amount comes to. The per-100g
// numbers live behind the chevron — picked foods already have them filled,
// so most of the time you only ever touch grams.
function IngredientRow({ ing, autoFocus, onChange, onRemove }) {
  const kcal = Math.round(scaledIngredient(ing).calories);
  const missingValues = ing.caloriesPer100g === "";
  const per100 = [
    ["caloriesPer100g", "kcal"],
    ["proteinPer100g", "Protein"],
    ["carbsPer100g", "Carbs"],
    ["fatPer100g", "Fat"],
    ["fiberPer100g", "Fiber"]
  ];

  return (
    <li className={ing.open ? "recipe-ing is-open" : "recipe-ing"}>
      <div className="recipe-ing-line">
        <span className="food-icon" aria-hidden="true">
          {foodIcon(ing)}
        </span>
        <button
          type="button"
          className="recipe-ing-toggle"
          onClick={() => onChange({ open: !ing.open })}
          aria-expanded={ing.open}
          aria-label={(ing.open ? "Hide" : "Show") + " values per 100g for " + (ing.name || "ingredient")}
        >
          <span className="recipe-ing-name">{ing.name || <span className="muted">Unnamed ingredient</span>}</span>
          {missingValues ? (
            <span className="recipe-ing-sub warn">Add values per 100g</span>
          ) : (
            <span className="recipe-ing-sub">
              <strong>{kcal} kcal</strong> · {Math.round(num(ing.caloriesPer100g))} / 100g
            </span>
          )}
          <ChevronDown size={15} strokeWidth={2} className="recipe-ing-chevron" aria-hidden="true" />
        </button>
        <label className="recipe-ing-grams">
          <input
            type="number"
            inputMode="decimal"
            value={ing.grams}
            onChange={(e) => onChange({ grams: e.target.value })}
            onFocus={(e) => e.target.select()}
            autoFocus={autoFocus && !ing.open}
            aria-label={(ing.name || "Ingredient") + " grams"}
          />
          <span>g</span>
        </label>
        <button type="button" className="ingredient-remove" onClick={onRemove} aria-label={"Remove " + (ing.name || "ingredient")}>
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>
      {ing.open && (
        <div className="recipe-ing-details">
          <input value={ing.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Ingredient name" aria-label="Ingredient name" autoFocus={autoFocus} />
          <div className="recipe-num-grid">
            {per100.map(([key, label]) => (
              <NumField key={key} label={label + " /100g"} value={ing[key]} onChange={(v) => onChange({ [key]: v })} />
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

function NumField({ label, value, onChange }) {
  return (
    <label className="recipe-num">
      <span>{label}</span>
      <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}
