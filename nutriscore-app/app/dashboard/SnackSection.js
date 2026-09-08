"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { todayStr } from "./utils";
import RecipePicker from "./RecipePicker";
import { sumIngredients } from "./recipeMath";

const RING_SIZE = 128;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

const emptyForm = {
  description: "",
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  notes: "",
  logDate: todayStr(),
  mealType: "snack",
  recipeId: "",
  ingredients: [], // set when logging from a saved recipe — lets grams be tweaked per log ("only had 150g of the rice")
  saveAsRecipe: false
};

export default function SnackSection({ personId, isMe, snacks, refreshSnacks, calorieTarget, registerCameraTrigger }) {
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [assumption, setAssumption] = useState("");
  const fileInputRef = useRef(null);

  const today = todayStr();
  const todaysEntries = snacks.filter((s) => s.log_date === today);
  const mealTotal = todaysEntries.filter((s) => s.meal_type === "meal").reduce((sum, s) => sum + (Number(s.calories) || 0), 0);
  const snackTotal = todaysEntries.filter((s) => s.meal_type !== "meal").reduce((sum, s) => sum + (Number(s.calories) || 0), 0);
  const combinedTotal = mealTotal + snackTotal;
  const balance = calorieTarget != null ? Math.round(combinedTotal - calorieTarget) : null;

  const proteinTotal = todaysEntries.reduce((sum, s) => sum + (Number(s.protein_g) || 0), 0);
  const carbsTotal = todaysEntries.reduce((sum, s) => sum + (Number(s.carbs_g) || 0), 0);
  const fatTotal = todaysEntries.reduce((sum, s) => sum + (Number(s.fat_g) || 0), 0);

  const ringPct = calorieTarget ? Math.max(0, Math.min(1, combinedTotal / calorieTarget)) : 0;
  const ringOffset = RING_CIRC * (1 - ringPct);
  const isOver = balance != null && balance > 0;
  const ringColor = calorieTarget == null ? "var(--gridline)" : isOver ? "var(--status-warning)" : "var(--" + (personId === "laura" ? "series-laura" : "series-martin") + ")";

  useEffect(() => {
    if (!isMe || !registerCameraTrigger) return;
    registerCameraTrigger(() => fileInputRef.current?.click());
    return () => registerCameraTrigger(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMe]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function pickPhoto(file) {
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError("");
  }

  function pickRecipe(recipe) {
    const ingredients = (recipe.ingredients || []).map((ing) => ({
      name: ing.name,
      grams: ing.grams != null ? String(ing.grams) : "",
      caloriesPer100g: ing.caloriesPer100g,
      proteinPer100g: ing.proteinPer100g,
      carbsPer100g: ing.carbsPer100g,
      fatPer100g: ing.fatPer100g
    }));
    setForm((f) => {
      const next = {
        ...f,
        description: recipe.name,
        calories: recipe.calories != null ? String(Math.round(recipe.calories)) : f.calories,
        proteinG: recipe.protein_g != null ? String(Math.round(recipe.protein_g)) : f.proteinG,
        carbsG: recipe.carbs_g != null ? String(Math.round(recipe.carbs_g)) : f.carbsG,
        fatG: recipe.fat_g != null ? String(Math.round(recipe.fat_g)) : f.fatG,
        mealType: recipe.meal_type === "snack" ? "snack" : "meal",
        recipeId: recipe.id,
        ingredients,
        saveAsRecipe: false
      };
      return ingredients.length ? withRecomputedTotals(next) : next;
    });
  }

  // Recomputes calories/proteinG/carbsG/fatG from form.ingredients — called
  // whenever a picked recipe's ingredients (or their grams) change, so the
  // macro fields always reflect "however much I actually ate."
  function withRecomputedTotals(f) {
    const totals = sumIngredients(f.ingredients);
    return {
      ...f,
      calories: String(Math.round(totals.calories)),
      proteinG: String(Math.round(totals.protein)),
      carbsG: String(Math.round(totals.carbs)),
      fatG: String(Math.round(totals.fat))
    };
  }

  function setIngredientGrams(idx, grams) {
    setForm((f) => {
      const ingredients = f.ingredients.map((ing, i) => (i === idx ? { ...ing, grams } : ing));
      return withRecomputedTotals({ ...f, ingredients });
    });
  }

  async function estimateFromPhoto() {
    if (!photoFile) return;
    setEstimating(true);
    setError("");
    setAssumption("");
    try {
      const fd = new FormData();
      fd.append("photo", photoFile);
      const res = await fetch("/api/snacks/estimate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Estimate failed");
      setForm((f) => ({
        ...f,
        description: data.description || f.description,
        calories: data.calories != null ? String(Math.round(data.calories)) : f.calories,
        proteinG: data.proteinG != null ? String(Math.round(data.proteinG)) : f.proteinG,
        carbsG: data.carbsG != null ? String(Math.round(data.carbsG)) : f.carbsG,
        fatG: data.fatG != null ? String(Math.round(data.fatG)) : f.fatG,
        recipeId: "",
        ingredients: []
      }));
      if (data.assumptions) setAssumption(data.assumptions + (data.confidence ? " (" + data.confidence + " confidence)" : ""));
    } catch (err) {
      setError(err.message);
    } finally {
      setEstimating(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.description.trim() || form.calories === "") {
      setError("Need at least a description and a calorie number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("description", form.description);
      fd.append("calories", form.calories);
      fd.append("proteinG", form.proteinG);
      fd.append("carbsG", form.carbsG);
      fd.append("fatG", form.fatG);
      fd.append("notes", form.notes);
      fd.append("logDate", form.logDate);
      fd.append("mealType", form.mealType);
      if (form.recipeId) fd.append("recipeId", form.recipeId);
      if (form.saveAsRecipe) fd.append("saveAsRecipe", "1");
      if (photoFile) fd.append("photo", photoFile);
      const res = await fetch("/api/snacks", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setForm({ ...emptyForm, logDate: form.logDate, mealType: form.mealType });
      setPhotoFile(null);
      setPhotoPreview(null);
      setAssumption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshSnacks();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id) {
    await fetch("/api/snacks?id=" + id, { method: "DELETE" });
    await refreshSnacks();
  }

  const recent = snacks.slice(0, 14);

  return (
    <div className="card">
      <h3>
        Meals & snacks <span className="muted">— today</span>
      </h3>

      <div className="cal-ring-row">
        <div className="cal-ring-figure">
          <svg viewBox={"0 0 " + RING_SIZE + " " + RING_SIZE}>
            <circle className="cal-ring-track" cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} strokeWidth={RING_STROKE} />
            <circle
              className="cal-ring-progress"
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              strokeWidth={RING_STROKE}
              stroke={ringColor}
              strokeDasharray={RING_CIRC}
              strokeDashoffset={calorieTarget == null ? RING_CIRC : ringOffset}
            />
          </svg>
          <div className="cal-ring-center">
            {calorieTarget != null ? (
              <>
                <div className="cal-ring-value" style={isOver ? { color: "var(--status-warning)" } : undefined}>
                  {isOver ? "+" + balance : Math.abs(balance)}
                </div>
                <div className="cal-ring-unit">{isOver ? "kcal over" : "kcal left"}</div>
              </>
            ) : (
              <>
                <div className="cal-ring-value">{combinedTotal ? Math.round(combinedTotal) : "—"}</div>
                <div className="cal-ring-unit">{isMe ? "set target" : "kcal today"}</div>
              </>
            )}
          </div>
        </div>
        <div className="macro-chip-col">
          <div className="macro-chip">
            <span className="m-label"><span className="m-dot" style={{ background: "var(--series-martin)" }} />Protein</span>
            <span className="m-value">{Math.round(proteinTotal)} g</span>
          </div>
          <div className="macro-chip">
            <span className="m-label"><span className="m-dot" style={{ background: "var(--status-warning)" }} />Carbs</span>
            <span className="m-value">{Math.round(carbsTotal)} g</span>
          </div>
          <div className="macro-chip">
            <span className="m-label"><span className="m-dot" style={{ background: "var(--series-laura)" }} />Fat</span>
            <span className="m-value">{Math.round(fatTotal)} g</span>
          </div>
        </div>
      </div>
      <div className="split-line">
        <span>Meals: <strong>{mealTotal ? Math.round(mealTotal) : 0} kcal</strong></span>
        <span>Snacks: <strong>{snackTotal ? Math.round(snackTotal) : 0} kcal</strong></span>
      </div>

      {isMe && (
        <form onSubmit={submit}>
          <div className="field wide">
            <div className="segmented">
              <button
                type="button"
                className={form.mealType === "meal" ? "seg-btn selected" : "seg-btn"}
                onClick={() => setField("mealType", "meal")}
              >
                Meal
              </button>
              <button
                type="button"
                className={form.mealType === "snack" ? "seg-btn selected" : "seg-btn"}
                onClick={() => setField("mealType", "snack")}
              >
                Snack
              </button>
            </div>
          </div>

          <div className="field wide">
            <label>Photo (optional)</label>
            <label className="photo-drop" htmlFor={"photo-" + personId}>
              {photoPreview ? <img src={photoPreview} alt="Snack preview" /> : <span>Tap to add a photo — Claude will estimate calories & macros</span>}
            </label>
            <input
              id={"photo-" + personId}
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => pickPhoto(e.target.files?.[0])}
            />
            {photoFile && (
              <button type="button" className="ghost" onClick={estimateFromPhoto} disabled={estimating} style={{ marginTop: 6 }}>
                {estimating ? "Estimating…" : "Estimate from photo"}
              </button>
            )}
            {assumption && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{assumption}</div>}
          </div>

          <div className="field wide">
            <label htmlFor={"desc-" + personId}>{form.mealType === "meal" ? "Meal (search your saved recipes)" : "Description"}</label>
            <RecipePicker
              id={"desc-" + personId}
              value={form.description}
              onChange={(v) => setField("description", v)}
              onPick={pickRecipe}
              placeholder={form.mealType === "meal" ? "e.g. chicken curry" : "e.g. protein bar + banana"}
            />
          </div>
          {form.ingredients.length > 0 && (
            <div className="field wide">
              <label>Grams actually eaten</label>
              <div className="ingredient-log-editor">
                {form.ingredients.map((ing, idx) => (
                  <div className="ingredient-log-row" key={ing.name + idx}>
                    <span className="ingredient-log-name">{ing.name}</span>
                    <input
                      type="number"
                      value={ing.grams}
                      onChange={(e) => setIngredientGrams(idx, e.target.value)}
                      aria-label={ing.name + " grams"}
                    />
                    <span className="ingredient-log-unit">g</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="field">
            <label htmlFor={"cal-" + personId}>Calories</label>
            <input
              id={"cal-" + personId}
              type="number"
              value={form.calories}
              onChange={(e) => setField("calories", e.target.value)}
              readOnly={form.ingredients.length > 0}
            />
          </div>
          <div className="field">
            <label htmlFor={"prot-" + personId}>Protein (g)</label>
            <input
              id={"prot-" + personId}
              type="number"
              value={form.proteinG}
              onChange={(e) => setField("proteinG", e.target.value)}
              readOnly={form.ingredients.length > 0}
            />
          </div>
          <div className="field">
            <label htmlFor={"carb-" + personId}>Carbs (g)</label>
            <input
              id={"carb-" + personId}
              type="number"
              value={form.carbsG}
              onChange={(e) => setField("carbsG", e.target.value)}
              readOnly={form.ingredients.length > 0}
            />
          </div>
          <div className="field">
            <label htmlFor={"fat-" + personId}>Fat (g)</label>
            <input
              id={"fat-" + personId}
              type="number"
              value={form.fatG}
              onChange={(e) => setField("fatG", e.target.value)}
              readOnly={form.ingredients.length > 0}
            />
          </div>
          <div className="field">
            <label htmlFor={"date-" + personId}>Date</label>
            <input id={"date-" + personId} type="date" value={form.logDate} onChange={(e) => setField("logDate", e.target.value)} />
          </div>
          <div className="field wide" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <input
              id={"saverec-" + personId}
              type="checkbox"
              style={{ width: "auto" }}
              checked={form.saveAsRecipe}
              onChange={(e) => setField("saveAsRecipe", e.target.checked)}
            />
            <label htmlFor={"saverec-" + personId} style={{ fontWeight: 500 }}>
              Save this as a recipe for next time
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary" disabled={saving}>
              {saving ? "Saving…" : "Log it"}
            </button>
            {error && <span className="error-text" style={{ marginTop: 0 }}>{error}</span>}
          </div>
        </form>
      )}

      <div className="log-cards" style={{ marginTop: 14 }}>
        {recent.length === 0 && <div className="log-cards-empty">Nothing logged yet.</div>}
        {recent.map((s) => (
          <div className="log-card-row" key={s.id}>
            <div className="log-card-main">
              <div className="log-card-top">
                <span className={s.meal_type === "meal" ? "type-badge meal" : "type-badge snack"}>{s.meal_type === "meal" ? "Meal" : "Snack"}</span>
                <span className="log-card-desc">{s.description}</span>
                <span className="log-card-date">{s.log_date}</span>
              </div>
              <div className="log-card-macros">
                {s.protein_g != null ? "P " + Math.round(s.protein_g) + "g" : "P —"}
                {"  ·  "}
                {s.carbs_g != null ? "C " + Math.round(s.carbs_g) + "g" : "C —"}
                {"  ·  "}
                {s.fat_g != null ? "F " + Math.round(s.fat_g) + "g" : "F —"}
              </div>
            </div>
            <div className="log-card-cal">
              <div className="v">{s.calories != null ? Math.round(s.calories) : "—"}</div>
              <div className="u">kcal</div>
            </div>
            {isMe && (
              <button type="button" className="log-card-remove" onClick={() => removeEntry(s.id)} aria-label="Remove entry">
                <Trash2 size={15} strokeWidth={2} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
