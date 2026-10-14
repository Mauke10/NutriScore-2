"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Pencil, ListPlus, ChevronLeft, ChevronRight, CopyPlus, BookmarkPlus, Check } from "lucide-react";
import { shortDateLabel, todayStr, dateDaysAgo, dayViewLabel, dayMonthLabel, DAY_VIEW_DAYS } from "./utils";
import RecipePicker from "./RecipePicker";
import { scaledIngredient, sumIngredients } from "./recipeMath";
import FoodSearch from "./FoodSearch";
import { foodIcon } from "../../lib/foodIcons";
import WeekCalorieTrend from "./WeekCalorieTrend";
import Modal from "./Modal";

const RING_SIZE = 128;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;
const SWIPE_COMMIT_PX = 50; // how far a horizontal swipe must travel to change day

const emptyForm = {
  description: "",
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  fiberG: "",
  notes: "",
  logDate: todayStr(),
  mealType: "meal",
  recipeId: "",
  ingredients: [], // from a saved recipe or built from the food database — grams can be tweaked per log ("only had 150g of the rice")
  buildMode: false, // "Build from ingredients" open: shows the food search even before anything's been added
  saveAsRecipe: false
};

const emptyEditForm = {
  description: "",
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  fiberG: "",
  mealType: "meal",
  logDate: todayStr()
};

function newKey() {
  return Math.random().toString(36).slice(2);
}

export default function SnackSection({
  personId,
  isMe,
  snacks,
  refreshSnacks,
  calorieTarget,
  proteinTarget,
  registerCameraTrigger,
  dayOffset: dayOffsetProp,
  onDayOffsetChange
}) {
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [assumption, setAssumption] = useState("");
  const fileInputRef = useRef(null);
  const justAddedRef = useRef(null); // key of the ingredient just added, so its grams field gets focus

  // Editing an already-logged entry (fixing a typo'd number, or "that was a
  // meal, not a snack") — separate from the add-new form above, opened in
  // its own modal so the main log form doesn't have to juggle two modes.
  const [editing, setEditing] = useState(null); // null | the entry being edited
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(null); // null | 'repeat' | 'recipe' — the side action in flight
  const [savedRecipeName, setSavedRecipeName] = useState(""); // set once "Save as recipe" succeeds

  // Which day the ring shows: 0 = today, up to DAY_VIEW_DAYS - 1 back. On a
  // phone DashboardClient owns this (the bottom nav tab is named after it);
  // the desktop columns just keep their own.
  const [localOffset, setLocalOffset] = useState(0);
  const dayOffset = dayOffsetProp ?? localOffset;
  const setDayOffset = onDayOffsetChange ?? setLocalOffset;
  const viewDate = dateDaysAgo(dayOffset);
  const todaysEntries = snacks.filter((s) => s.log_date === viewDate);
  const mealTotal = todaysEntries.filter((s) => s.meal_type === "meal").reduce((sum, s) => sum + (Number(s.calories) || 0), 0);
  const snackTotal = todaysEntries.filter((s) => s.meal_type !== "meal").reduce((sum, s) => sum + (Number(s.calories) || 0), 0);
  const combinedTotal = mealTotal + snackTotal;
  const balance = calorieTarget != null ? Math.round(combinedTotal - calorieTarget) : null;

  const proteinTotal = todaysEntries.reduce((sum, s) => sum + (Number(s.protein_g) || 0), 0);
  const carbsTotal = todaysEntries.reduce((sum, s) => sum + (Number(s.carbs_g) || 0), 0);
  const fatTotal = todaysEntries.reduce((sum, s) => sum + (Number(s.fat_g) || 0), 0);
  const fiberTotal = todaysEntries.reduce((sum, s) => sum + (Number(s.fiber_g) || 0), 0);

  const ringPct = calorieTarget ? Math.max(0, Math.min(1, combinedTotal / calorieTarget)) : 0;
  const ringOffset = RING_CIRC * (1 - ringPct);
  const isOver = balance != null && balance > 0;
  const ringColor = calorieTarget == null ? "var(--gridline)" : isOver ? "var(--status-warning)" : "var(--" + (personId === "laura" ? "series-laura" : "series-martin") + ")";

  // Looking at yesterday is usually "I forgot to log something yesterday", so
  // new entries default to the day on screen (the Date field shows it). Also
  // rolls the default over to the new day if the app sits open past midnight.
  useEffect(() => {
    setForm((f) => (f.logDate === viewDate ? f : { ...f, logDate: viewDate }));
  }, [viewDate]);

  // Swipe the ring left/right to step through the last 7 days, like photos:
  // swipe right (finger moves right) for the day before, left for the day
  // after. Touch/pen only — on desktop the arrows and dots do it. touch-action
  // pan-y on .day-swipe leaves vertical scrolling to the browser, which sends
  // pointercancel if the gesture turns out to be a scroll.
  const swipeRef = useRef(null);
  const swipeAreaRef = useRef(null);
  const [dragX, setDragX] = useState(0);

  function goToDay(next, fromSide) {
    const clamped = Math.max(0, Math.min(DAY_VIEW_DAYS - 1, next));
    if (clamped === dayOffset) return;
    setDayOffset(clamped);
    const el = swipeAreaRef.current;
    let reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {}
    if (el && el.animate && !reduce) {
      const from = fromSide ?? (clamped > dayOffset ? -1 : 1); // older days come in from the left
      el.animate([{ transform: "translateX(" + from * 28 + "px)", opacity: 0 }, { transform: "none", opacity: 1 }], {
        duration: 220,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)"
      });
    }
  }

  function onSwipeStart(e) {
    if (e.pointerType === "mouse") return;
    swipeRef.current = { x: e.clientX, y: e.clientY, axis: null, dx: 0 };
  }

  function onSwipeMove(e) {
    const s = swipeRef.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (s.axis !== "x") return;
    s.dx = dx;
    // Rubber-band at the ends: no day after today, nothing before 7 days back.
    const atEnd = (dx < 0 && dayOffset === 0) || (dx > 0 && dayOffset === DAY_VIEW_DAYS - 1);
    setDragX(atEnd ? dx * 0.2 : dx);
  }

  function onSwipeEnd() {
    const s = swipeRef.current;
    swipeRef.current = null;
    setDragX(0);
    if (!s || s.axis !== "x" || Math.abs(s.dx) < SWIPE_COMMIT_PX) return;
    if (s.dx > 0) goToDay(dayOffset + 1, -1);
    else goToDay(dayOffset - 1, 1);
  }

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
      key: newKey(),
      name: ing.name,
      grams: ing.grams != null ? String(ing.grams) : "",
      caloriesPer100g: ing.caloriesPer100g,
      proteinPer100g: ing.proteinPer100g,
      carbsPer100g: ing.carbsPer100g,
      fatPer100g: ing.fatPer100g,
      fiberPer100g: ing.fiberPer100g,
      foodId: ing.foodId
    }));
    setForm((f) => {
      const next = {
        ...f,
        description: recipe.name,
        calories: recipe.calories != null ? String(Math.round(recipe.calories)) : f.calories,
        proteinG: recipe.protein_g != null ? String(Math.round(recipe.protein_g)) : f.proteinG,
        carbsG: recipe.carbs_g != null ? String(Math.round(recipe.carbs_g)) : f.carbsG,
        fatG: recipe.fat_g != null ? String(Math.round(recipe.fat_g)) : f.fatG,
        fiberG: recipe.fiber_g != null ? String(Math.round(recipe.fiber_g)) : f.fiberG,
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
    if (!f.ingredients.length) return { ...f, calories: "", proteinG: "", carbsG: "", fatG: "", fiberG: "" };
    const totals = sumIngredients(f.ingredients);
    return {
      ...f,
      calories: String(Math.round(totals.calories)),
      proteinG: String(Math.round(totals.protein)),
      carbsG: String(Math.round(totals.carbs)),
      fatG: String(Math.round(totals.fat)),
      fiberG: String(Math.round(totals.fiber))
    };
  }

  function setIngredientGrams(idx, grams) {
    setForm((f) => {
      const ingredients = f.ingredients.map((ing, i) => (i === idx ? { ...ing, grams } : ing));
      return withRecomputedTotals({ ...f, ingredients });
    });
  }

  function addIngredient(ing) {
    const key = newKey();
    justAddedRef.current = key;
    setForm((f) => withRecomputedTotals({ ...f, buildMode: true, ingredients: [...f.ingredients, { ...ing, key }] }));
  }

  function removeIngredient(idx) {
    setForm((f) => withRecomputedTotals({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));
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
        fiberG: data.fiberG != null ? String(Math.round(data.fiberG)) : f.fiberG,
        recipeId: "",
        ingredients: [],
        buildMode: false
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
    // Built from ingredients without typing a name — call it what's in it.
    const description = form.description.trim() || form.ingredients.map((ing) => ing.name.split(",")[0]).join(" + ");
    if (!description || form.calories === "") {
      setError(form.buildMode ? "Add at least one ingredient." : "Need at least a description and a calorie number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("description", description);
      fd.append("calories", form.calories);
      fd.append("proteinG", form.proteinG);
      fd.append("carbsG", form.carbsG);
      fd.append("fatG", form.fatG);
      fd.append("fiberG", form.fiberG);
      fd.append("notes", form.notes);
      fd.append("logDate", form.logDate);
      fd.append("mealType", form.mealType);
      if (form.recipeId) fd.append("recipeId", form.recipeId);
      if (form.saveAsRecipe) fd.append("saveAsRecipe", "1");
      if (form.ingredients.length) fd.append("ingredients", JSON.stringify(form.ingredients));
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

  function setEditField(key, value) {
    setEditForm((f) => ({ ...f, [key]: value }));
  }

  function openEdit(entry) {
    setEditing(entry);
    setEditForm({
      description: entry.description || "",
      calories: entry.calories != null ? String(entry.calories) : "",
      proteinG: entry.protein_g != null ? String(entry.protein_g) : "",
      carbsG: entry.carbs_g != null ? String(entry.carbs_g) : "",
      fatG: entry.fat_g != null ? String(entry.fat_g) : "",
      fiberG: entry.fiber_g != null ? String(entry.fiber_g) : "",
      mealType: entry.meal_type === "meal" ? "meal" : "snack",
      logDate: entry.log_date || todayStr()
    });
    setEditError("");
    setSavedRecipeName("");
  }

  function closeEdit() {
    setEditing(null);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editForm.description.trim() || editForm.calories === "") {
      setEditError("Need at least a description and a calorie number.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch("/api/snacks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          description: editForm.description,
          calories: editForm.calories,
          proteinG: editForm.proteinG,
          carbsG: editForm.carbsG,
          fatG: editForm.fatG,
          fiberG: editForm.fiberG,
          mealType: editForm.mealType,
          logDate: editForm.logDate
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setEditing(null);
      await refreshSnacks();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  // "Log again": the same food, eaten again — a new entry with the values in
  // the edit window, dated the day on screen (today unless you've swiped
  // back). Keeps the recipe link so it counts as that recipe being used.
  async function repeatEntry() {
    if (!editForm.description.trim() || editForm.calories === "") {
      setEditError("Need at least a description and a calorie number.");
      return;
    }
    setEditBusy("repeat");
    setEditError("");
    try {
      const fd = new FormData();
      fd.append("description", editForm.description.trim());
      fd.append("calories", editForm.calories);
      fd.append("proteinG", editForm.proteinG);
      fd.append("carbsG", editForm.carbsG);
      fd.append("fatG", editForm.fatG);
      fd.append("fiberG", editForm.fiberG);
      fd.append("mealType", editForm.mealType);
      fd.append("logDate", viewDate);
      if (editing.recipe_id) fd.append("recipeId", editing.recipe_id);
      const res = await fetch("/api/snacks", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't log it again");
      setEditing(null);
      await refreshSnacks();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditBusy(null);
    }
  }

  // "Save as recipe" after the fact — for when you forgot to tick the box
  // while logging. Logs don't keep an ingredient list, so this saves the
  // totals (editable later in Recipes). Same find-or-update-by-name as the
  // log form's checkbox, then links the entry to the recipe.
  async function saveEntryAsRecipe() {
    const name = editForm.description.trim();
    if (!name || editForm.calories === "") {
      setEditError("Need at least a description and a calorie number.");
      return;
    }
    setEditBusy("recipe");
    setEditError("");
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mealType: editForm.mealType,
          calories: editForm.calories,
          proteinG: editForm.proteinG,
          carbsG: editForm.carbsG,
          fatG: editForm.fatG,
          fiberG: editForm.fiberG
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save the recipe");
      if (data.id) {
        await fetch("/api/snacks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, recipeId: data.id })
        });
        setEditing((e) => (e ? { ...e, recipe_id: data.id } : e));
      }
      setSavedRecipeName(name);
      await refreshSnacks();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditBusy(null);
    }
  }

  const recent = snacks.slice(0, 14);

  return (
    <div className="card">
      <h3>
        Meals & snacks{" "}
        <span className="muted">
          — {dayOffset < 2 ? dayViewLabel(dayOffset).toLowerCase() : dayViewLabel(dayOffset) + " " + dayMonthLabel(viewDate)}
        </span>
      </h3>

      <WeekCalorieTrend
        personId={personId}
        snacks={snacks}
        calorieTarget={calorieTarget}
        selectedDate={viewDate}
        onSelectDate={(date) => {
          for (let n = 0; n < DAY_VIEW_DAYS; n++) if (dateDaysAgo(n) === date) goToDay(n);
        }}
      />

      <div
        className="day-swipe"
        ref={swipeAreaRef}
        onPointerDown={onSwipeStart}
        onPointerMove={onSwipeMove}
        onPointerUp={onSwipeEnd}
        onPointerCancel={onSwipeEnd}
        style={dragX ? { transform: "translateX(" + dragX + "px)", opacity: 1 - Math.min(Math.abs(dragX), 160) / 400, transition: "none" } : undefined}
      >
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
                  <div className="cal-ring-unit">{isMe ? "set target" : dayOffset === 0 ? "kcal today" : "kcal"}</div>
                </>
              )}
            </div>
          </div>
          <div className="macro-chip-col">
            <div className="macro-chip">
              <span className="m-label"><span className="m-dot" style={{ background: "var(--series-martin)" }} />Protein</span>
              <span className="m-value">{proteinTarget != null ? Math.round(proteinTotal) + " / " + Math.round(proteinTarget) + " g" : Math.round(proteinTotal) + " g"}</span>
            </div>
            <div className="macro-chip">
              <span className="m-label"><span className="m-dot" style={{ background: "var(--status-warning)" }} />Carbs</span>
              <span className="m-value">{Math.round(carbsTotal)} g</span>
            </div>
            <div className="macro-chip">
              <span className="m-label"><span className="m-dot" style={{ background: "var(--series-laura)" }} />Fat</span>
              <span className="m-value">{Math.round(fatTotal)} g</span>
            </div>
            <div className="macro-chip">
              <span className="m-label"><span className="m-dot" style={{ background: "var(--status-good)" }} />Fiber</span>
              <span className="m-value">{Math.round(fiberTotal)} g</span>
            </div>
          </div>
        </div>
        <div className="split-line">
          <span>Meals: <strong>{mealTotal ? Math.round(mealTotal) : 0} kcal</strong></span>
          <span>Snacks: <strong>{snackTotal ? Math.round(snackTotal) : 0} kcal</strong></span>
        </div>
      </div>

      <div className="day-nav" role="group" aria-label="Day shown">
        <button type="button" className="day-nav-arrow" onClick={() => goToDay(dayOffset + 1)} disabled={dayOffset === DAY_VIEW_DAYS - 1} aria-label="Previous day">
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        {Array.from({ length: DAY_VIEW_DAYS }, (_, i) => DAY_VIEW_DAYS - 1 - i).map((n) => (
          <button
            key={n}
            type="button"
            className={n === dayOffset ? "day-nav-dot active" : "day-nav-dot"}
            onClick={() => goToDay(n)}
            aria-label={dayViewLabel(n)}
            aria-current={n === dayOffset ? "date" : undefined}
          />
        ))}
        <button type="button" className="day-nav-arrow" onClick={() => goToDay(dayOffset - 1)} disabled={dayOffset === 0} aria-label="Next day">
          <ChevronRight size={16} strokeWidth={2} />
        </button>
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
              <button type="button" className="ghost" onClick={estimateFromPhoto} disabled={estimating} style={{ marginTop: "var(--space-1-5)" }}>
                {estimating ? "Estimating…" : "Estimate from photo"}
              </button>
            )}
            {assumption && <div className="status-text small muted spaced-xs">{assumption}</div>}
          </div>

          <div className="field wide">
            <label htmlFor={"desc-" + personId}>{form.mealType === "meal" ? "Meal (search your saved recipes)" : "Description"}</label>
            <RecipePicker
              id={"desc-" + personId}
              value={form.description}
              onChange={(v) => setField("description", v)}
              onPick={pickRecipe}
              placeholder={form.buildMode ? "Name (optional) — e.g. lõhe ja riis" : form.mealType === "meal" ? "e.g. chicken curry" : "e.g. protein bar + banana"}
            />
            {!form.buildMode && form.ingredients.length === 0 && (
              <button type="button" className="ghost build-ingredients-btn" onClick={() => setField("buildMode", true)}>
                <ListPlus size={15} strokeWidth={2} /> Build from ingredients
              </button>
            )}
          </div>
          {(form.buildMode || form.ingredients.length > 0) && (
            <div className="field wide">
              <label htmlFor={"food-" + personId}>{form.ingredients.length ? "Ingredients — grams actually eaten" : "Ingredients"}</label>
              <div className="ingredient-log-editor">
                {form.ingredients.map((ing, idx) => (
                  <div className="ingredient-log-row" key={ing.key || ing.name + idx}>
                    <span className="food-icon" aria-hidden="true">
                      {foodIcon(ing)}
                    </span>
                    <span className="ingredient-log-name">{ing.name}</span>
                    <span className="ingredient-log-kcal">{Math.round(scaledIngredient(ing).calories)} kcal</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={ing.grams}
                      onChange={(e) => setIngredientGrams(idx, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      autoFocus={ing.key != null && ing.key === justAddedRef.current}
                      aria-label={ing.name + " grams"}
                    />
                    <span className="ingredient-log-unit">g</span>
                    <button type="button" className="ingredient-remove" onClick={() => removeIngredient(idx)} aria-label={"Remove " + ing.name}>
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
                <FoodSearch id={"food-" + personId} onPick={addIngredient} placeholder={form.ingredients.length ? "Add another ingredient…" : undefined} />
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
            <label htmlFor={"fiber-" + personId}>Fiber (g)</label>
            <input
              id={"fiber-" + personId}
              type="number"
              value={form.fiberG}
              onChange={(e) => setField("fiberG", e.target.value)}
              readOnly={form.ingredients.length > 0}
            />
          </div>
          <div className="field">
            <label htmlFor={"date-" + personId}>Date</label>
            <input id={"date-" + personId} type="date" value={form.logDate} onChange={(e) => setField("logDate", e.target.value)} />
          </div>
          <div className="field wide" style={{ flexDirection: "row", alignItems: "center", gap: "var(--space-1-5)" }}>
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
            {error && <span className="error-text inline">{error}</span>}
          </div>
        </form>
      )}

      <div className="log-cards" style={{ marginTop: "var(--space-3-5)" }}>
        {recent.length === 0 && <div className="log-cards-empty">Nothing logged yet.</div>}
        {recent.map((s) => (
          <div className="log-card-row" key={s.id}>
            <div
              className={isMe ? "log-card-main is-tappable" : "log-card-main"}
              onClick={isMe ? () => openEdit(s) : undefined}
              onKeyDown={
                isMe
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openEdit(s);
                      }
                    }
                  : undefined
              }
              role={isMe ? "button" : undefined}
              tabIndex={isMe ? 0 : undefined}
              aria-label={isMe ? "Open " + s.description : undefined}
            >
              <div className="log-card-top">
                <span className={s.meal_type === "meal" ? "type-badge meal" : "type-badge snack"}>{s.meal_type === "meal" ? "Meal" : "Snack"}</span>
                <span className="log-card-desc">{s.description}</span>
              </div>
              <div className="log-card-macros">
                <span className="log-card-macro-text">
                  {s.protein_g != null ? "P " + Math.round(s.protein_g) + "g" : "P —"}
                  {"  ·  "}
                  {s.carbs_g != null ? "C " + Math.round(s.carbs_g) + "g" : "C —"}
                  {"  ·  "}
                  {s.fat_g != null ? "F " + Math.round(s.fat_g) + "g" : "F —"}
                  {"  ·  "}
                  {s.fiber_g != null ? "Fi " + Math.round(s.fiber_g) + "g" : "Fi —"}
                </span>
                <span className="log-card-date" title={s.log_date}>{shortDateLabel(s.log_date)}</span>
              </div>
            </div>
            <div className="log-card-cal">
              <div className="v">{s.calories != null ? Math.round(s.calories) : "—"}</div>
              <div className="u">kcal</div>
            </div>
            {isMe && (
              <div className="log-card-actions">
                <button type="button" className="log-card-edit" onClick={() => openEdit(s)} aria-label="Edit entry">
                  <Pencil size={15} strokeWidth={2} />
                </button>
                <button type="button" className="log-card-remove" onClick={() => removeEntry(s.id)} aria-label="Remove entry">
                  <Trash2 size={15} strokeWidth={2} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <Modal title="Entry" onClose={closeEdit}>
          <div className="entry-quick-actions">
            <button type="button" className="entry-action" onClick={repeatEntry} disabled={editBusy !== null}>
              <CopyPlus size={18} strokeWidth={2} />
              <span>
                <strong>{editBusy === "repeat" ? "Logging…" : "Log again"}</strong>
                <span className="entry-action-sub">Same food, {dayOffset === 0 ? "today" : dayOffset === 1 ? "yesterday" : dayViewLabel(dayOffset)}</span>
              </span>
            </button>
            {editing.recipe_id ? (
              <div className="entry-action is-done" role="status">
                <Check size={18} strokeWidth={2} />
                <span>
                  <strong>{savedRecipeName ? "Saved to recipes" : "Saved recipe"}</strong>
                  <span className="entry-action-sub">{savedRecipeName ? "“" + savedRecipeName + "”" : "Pick it from the meal search"}</span>
                </span>
              </div>
            ) : (
              <button type="button" className="entry-action" onClick={saveEntryAsRecipe} disabled={editBusy !== null}>
                <BookmarkPlus size={18} strokeWidth={2} />
                <span>
                  <strong>{editBusy === "recipe" ? "Saving…" : "Save as recipe"}</strong>
                  <span className="entry-action-sub">For quick logging next time</span>
                </span>
              </button>
            )}
          </div>
          <div className="entry-edit-label">Edit this entry</div>
          <form onSubmit={saveEdit}>
            <div className="field wide">
              <div className="segmented">
                <button
                  type="button"
                  className={editForm.mealType === "meal" ? "seg-btn selected" : "seg-btn"}
                  onClick={() => setEditField("mealType", "meal")}
                >
                  Meal
                </button>
                <button
                  type="button"
                  className={editForm.mealType === "snack" ? "seg-btn selected" : "seg-btn"}
                  onClick={() => setEditField("mealType", "snack")}
                >
                  Snack
                </button>
              </div>
            </div>
            <div className="field wide">
              <label htmlFor="edit-desc">Description</label>
              <input id="edit-desc" value={editForm.description} onChange={(e) => setEditField("description", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="edit-cal">Calories</label>
              <input id="edit-cal" type="number" value={editForm.calories} onChange={(e) => setEditField("calories", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="edit-prot">Protein (g)</label>
              <input id="edit-prot" type="number" value={editForm.proteinG} onChange={(e) => setEditField("proteinG", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="edit-carb">Carbs (g)</label>
              <input id="edit-carb" type="number" value={editForm.carbsG} onChange={(e) => setEditField("carbsG", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="edit-fat">Fat (g)</label>
              <input id="edit-fat" type="number" value={editForm.fatG} onChange={(e) => setEditField("fatG", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="edit-fiber">Fiber (g)</label>
              <input id="edit-fiber" type="number" value={editForm.fiberG} onChange={(e) => setEditField("fiberG", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="edit-date">Date</label>
              <input id="edit-date" type="date" value={editForm.logDate} onChange={(e) => setEditField("logDate", e.target.value)} />
            </div>
            <div className="form-actions">
              <button type="submit" className="primary" disabled={editSaving}>
                {editSaving ? "Saving…" : "Save changes"}
              </button>
              {editError && <span className="error-text inline">{editError}</span>}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
