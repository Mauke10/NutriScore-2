"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import Modal from "./Modal";
import { sumIngredients } from "./recipeMath";
import FoodSearch from "./FoodSearch";

const blankRecipe = { id: null, name: "", meal_type: "meal", portion_note: "", ingredients: [] };
const blankIngredient = { name: "", grams: "", caloriesPer100g: "", proteinPer100g: "", carbsPer100g: "", fatPer100g: "", fiberPer100g: "" };

export default function RecipesPanel({ onClose }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null); // null = list view, object = detail/edit view
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
        <RecipeList
          list={list}
          loading={loading}
          q={q}
          onSearch={onSearch}
          onPick={(r) => setSelected({ ...r, ingredients: (r.ingredients || []).map(withStringFields) })}
          onNew={() => setSelected(blankRecipe)}
        />
      ) : (
        <RecipeDetail
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
  return (
    <div>
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3-5)" }}>
        <input type="text" value={q} onChange={(e) => onSearch(e.target.value)} placeholder="Search recipes…" style={{ flex: 1 }} />
        <button type="button" className="primary" onClick={onNew}>
          + New
        </button>
      </div>
      {loading && <p className="status-text muted">Loading…</p>}
      {!loading && list.length === 0 && <p className="status-text muted">No saved recipes yet — log something and tick "save as a recipe," or add one here.</p>}
      <div className="recipe-list">
        {list.map((r) => (
          <button type="button" key={r.id} className="recipe-list-row" onClick={() => onPick(r)}>
            <span className="recipe-list-name">{r.name}</span>
            <span className="recipe-list-meta">
              {r.calories != null ? Math.round(r.calories) + " kcal" : "—"} · {r.meal_type}
              {r.protein_g != null ? " · " + Math.round(r.protein_g) + "g protein" : ""}
              {r.ingredients && r.ingredients.length ? " · " + r.ingredients.length + " ingredient" + (r.ingredients.length === 1 ? "" : "s") : ""}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function withStringFields(ing) {
  return {
    name: ing.name || "",
    grams: ing.grams != null ? String(ing.grams) : "",
    caloriesPer100g: ing.caloriesPer100g != null ? String(ing.caloriesPer100g) : "",
    proteinPer100g: ing.proteinPer100g != null ? String(ing.proteinPer100g) : "",
    carbsPer100g: ing.carbsPer100g != null ? String(ing.carbsPer100g) : "",
    fatPer100g: ing.fatPer100g != null ? String(ing.fatPer100g) : "",
    fiberPer100g: ing.fiberPer100g != null ? String(ing.fiberPer100g) : "",
    foodId: ing.foodId || null
  };
}

function RecipeDetail({ recipe, onBack, onSaved }) {
  const [name, setName] = useState(recipe.name || "");
  const [mealType, setMealType] = useState(recipe.meal_type || "meal");
  const [portionNote, setPortionNote] = useState(recipe.portion_note || "");
  const [ingredients, setIngredients] = useState(recipe.ingredients && recipe.ingredients.length ? recipe.ingredients : []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const totals = sumIngredients(ingredients);

  function setIngredientField(idx, key, value) {
    setIngredients((rows) => rows.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  }

  function addIngredient() {
    setIngredients((rows) => [...rows, { ...blankIngredient }]);
  }

  // From the food database — macros filled in, you just set the grams.
  function addFood(ing) {
    setIngredients((rows) => [...rows, withStringFields(ing)]);
  }

  function removeIngredient(idx) {
    setIngredients((rows) => rows.filter((_, i) => i !== idx));
  }

  async function save(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Needs a name.");
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
          ingredients: ingredients.filter((ing) => ing.name.trim())
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
    if (!recipe.id) return;
    setDeleting(true);
    try {
      await fetch("/api/recipes?id=" + recipe.id, { method: "DELETE" });
      onSaved();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <button type="button" className="ghost" onClick={onBack} style={{ marginBottom: "var(--space-3-5)", display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
        <ChevronLeft strokeWidth={2} size={16} /> Back to recipes
      </button>
      <form onSubmit={save} className="section-form">
        <div className="field wide">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lõhe ja riis" />
        </div>
        <div className="field wide">
          <div className="segmented">
            <button type="button" className={mealType === "meal" ? "seg-btn selected" : "seg-btn"} onClick={() => setMealType("meal")}>
              Meal
            </button>
            <button type="button" className={mealType === "snack" ? "seg-btn selected" : "seg-btn"} onClick={() => setMealType("snack")}>
              Snack
            </button>
          </div>
        </div>

        <div className="field wide">
          <label htmlFor="recipe-food-search">Ingredients — grams &amp; macros per 100g</label>
          <div className="ingredient-editor">
            {ingredients.map((ing, idx) => (
              <div className="ingredient-row" key={idx}>
                <input
                  className="ingredient-name"
                  value={ing.name}
                  onChange={(e) => setIngredientField(idx, "name", e.target.value)}
                  placeholder="e.g. Lõhe"
                />
                <div className="ingredient-nums">
                  <label>
                    <span>Grams</span>
                    <input type="number" value={ing.grams} onChange={(e) => setIngredientField(idx, "grams", e.target.value)} placeholder="100" />
                  </label>
                  <label>
                    <span>kcal/100g</span>
                    <input type="number" value={ing.caloriesPer100g} onChange={(e) => setIngredientField(idx, "caloriesPer100g", e.target.value)} placeholder="208" />
                  </label>
                  <label>
                    <span>P/100g</span>
                    <input type="number" value={ing.proteinPer100g} onChange={(e) => setIngredientField(idx, "proteinPer100g", e.target.value)} placeholder="20" />
                  </label>
                  <label>
                    <span>C/100g</span>
                    <input type="number" value={ing.carbsPer100g} onChange={(e) => setIngredientField(idx, "carbsPer100g", e.target.value)} placeholder="0" />
                  </label>
                  <label>
                    <span>F/100g</span>
                    <input type="number" value={ing.fatPer100g} onChange={(e) => setIngredientField(idx, "fatPer100g", e.target.value)} placeholder="13" />
                  </label>
                  <label>
                    <span>Fiber/100g</span>
                    <input type="number" value={ing.fiberPer100g} onChange={(e) => setIngredientField(idx, "fiberPer100g", e.target.value)} placeholder="2" />
                  </label>
                </div>
                <button type="button" className="ingredient-remove" onClick={() => removeIngredient(idx)} aria-label="Remove ingredient">
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
            <FoodSearch id="recipe-food-search" onPick={addFood} />
            <button type="button" className="ghost ingredient-add" onClick={addIngredient}>
              <Plus size={14} strokeWidth={2} /> Add manually
            </button>
          </div>
        </div>

        <div className="field wide recipe-totals-bar">
          <span>Total</span>
          <strong>{Math.round(totals.calories)} kcal</strong>
          <span className="muted">
            P {Math.round(totals.protein)}g · C {Math.round(totals.carbs)}g · F {Math.round(totals.fat)}g · Fiber {Math.round(totals.fiber)}g
          </span>
        </div>

        <div className="field wide">
          <label>Portion note</label>
          <input value={portionNote} onChange={(e) => setPortionNote(e.target.value)} placeholder="e.g. 1 mealprep container" />
        </div>
        <div className="form-actions">
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Saving…" : "Save recipe"}
          </button>
          {recipe.id && (
            <button type="button" className="danger" onClick={remove} disabled={deleting} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
              <Trash2 strokeWidth={2} size={14} /> {deleting ? "Removing…" : "Delete"}
            </button>
          )}
          {error && <span className="error-text inline">{error}</span>}
        </div>
      </form>
    </div>
  );
}
