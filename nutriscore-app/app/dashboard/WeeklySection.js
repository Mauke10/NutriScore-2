"use client";

import { useMemo, useState } from "react";
import { Scale, Activity, Moon, UtensilsCrossed, StickyNote, ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import Modal from "./Modal";
import { dayMonthLabel, mondayOf, numOrEmpty, shiftWeek } from "./utils";

// The weekly check-in is split into small groups so a person logs one thing
// at a time (weight on Monday, sleep when they remember) instead of facing
// all twelve fields at once. Each group opens its own small form.
const GROUPS = [
  {
    key: "body",
    title: "Weight & waist",
    Icon: Scale,
    fields: [
      { key: "weightKg", label: "Weight (kg)", step: "0.1" },
      { key: "waistCm", label: "Waist (cm)", step: "0.1" }
    ],
    summary: (f) => join([f.weightKg && f.weightKg + " kg", f.waistCm && f.waistCm + " cm waist"])
  },
  {
    key: "training",
    title: "Training",
    Icon: Activity,
    fields: [
      { key: "sessions", label: "Sessions" },
      { key: "avgRpe", label: "Avg RPE", step: "0.5" },
      { key: "hrBaseMin", label: "HR base (min)" },
      { key: "hrHardMin", label: "HR hard (min)" }
    ],
    summary: (f) =>
      join([
        f.sessions && f.sessions + " sessions",
        f.avgRpe && "RPE " + f.avgRpe,
        (f.hrBaseMin || f.hrHardMin) && (f.hrBaseMin || "—") + " / " + (f.hrHardMin || "—") + " min HR"
      ])
  },
  {
    key: "recovery",
    title: "Sleep & supplements",
    Icon: Moon,
    fields: [
      { key: "sleepAvgHrs", label: "Avg sleep (h)", step: "0.1" },
      { key: "supplementDays", label: "Supplement days (/7)", max: "7" }
    ],
    summary: (f) => join([f.sleepAvgHrs && f.sleepAvgHrs + " h sleep", f.supplementDays && "supps " + f.supplementDays + "/7"])
  },
  {
    key: "nutrition",
    title: "Nutrition",
    Icon: UtensilsCrossed,
    fields: [
      { key: "nutritionAdherencePct", label: "Adherence (%)" },
      { key: "caloriesAvg", label: "Avg kcal/day" },
      { key: "proteinAvg", label: "Avg protein (g/day)" }
    ],
    summary: (f) =>
      join([
        f.nutritionAdherencePct && f.nutritionAdherencePct + "%",
        f.caloriesAvg && Number(f.caloriesAvg).toLocaleString("en-US") + " kcal",
        f.proteinAvg && f.proteinAvg + " g protein"
      ])
  },
  {
    key: "notes",
    title: "Notes",
    Icon: StickyNote,
    fields: [{ key: "notes", label: "Notes", textarea: true }],
    summary: (f) => f.notes
  }
];

function join(parts) {
  return parts.filter(Boolean).join(" · ");
}

function rowToForm(w, weekStart) {
  return {
    weekStart,
    weightKg: numOrEmpty(w?.weight_kg),
    waistCm: numOrEmpty(w?.waist_cm),
    sessions: numOrEmpty(w?.sessions),
    avgRpe: numOrEmpty(w?.avg_rpe),
    hrBaseMin: numOrEmpty(w?.hr_base_min),
    hrHardMin: numOrEmpty(w?.hr_hard_min),
    sleepAvgHrs: numOrEmpty(w?.sleep_avg_hrs),
    supplementDays: numOrEmpty(w?.supplement_days),
    nutritionAdherencePct: numOrEmpty(w?.nutrition_adherence_pct),
    caloriesAvg: numOrEmpty(w?.calories_avg),
    proteinAvg: numOrEmpty(w?.protein_avg),
    notes: w?.notes || ""
  };
}

// Average kcal / protein per *tracked* day of that week from the food log —
// untracked days are left out, same rule as the 7-day trend on Today.
function foodLogAverages(snacks, weekStart) {
  const end = shiftWeek(weekStart, 1);
  const days = new Map();
  for (const s of snacks || []) {
    if (s.log_date < weekStart || s.log_date >= end) continue;
    const d = days.get(s.log_date) || { kcal: 0, protein: 0 };
    d.kcal += Number(s.calories) || 0;
    d.protein += Number(s.protein_g) || 0;
    days.set(s.log_date, d);
  }
  if (days.size === 0) return null;
  let kcal = 0;
  let protein = 0;
  for (const d of days.values()) {
    kcal += d.kcal;
    protein += d.protein;
  }
  return { days: days.size, kcal: Math.round(kcal / days.size), protein: Math.round(protein / days.size) };
}

export default function WeeklySection({ personId, isMe, weekly, refreshWeekly, snacks }) {
  const thisWeek = mondayOf(new Date());
  const [weekStart, setWeekStart] = useState(thisWeek);
  const [openGroup, setOpenGroup] = useState(null);

  const byWeek = useMemo(() => new Map(weekly.map((w) => [w.week_start, w])), [weekly]);
  const current = byWeek.get(weekStart);
  const form = rowToForm(current, weekStart);

  const weights = weekly.filter((w) => w.weight_kg != null).slice(0, 12).reverse();
  const latest = weights[weights.length - 1];
  const previous = weights[weights.length - 2];
  const delta = latest && previous ? Number(latest.weight_kg) - Number(previous.weight_kg) : null;

  async function removeWeek() {
    if (!current) return;
    if (!window.confirm("Delete everything logged for the week of " + dayMonthLabel(weekStart) + "?")) return;
    await fetch("/api/weekly?weekStart=" + weekStart, { method: "DELETE" });
    await refreshWeekly();
  }

  return (
    <div className="card">
      <h3>Weekly check-in</h3>

      {latest ? (
        <div className="weight-hero">
          <div className="weight-hero-value">
            {Number(latest.weight_kg).toLocaleString("en-US", { maximumFractionDigits: 1 })}
            <span className="weight-hero-unit">kg</span>
          </div>
          {delta !== null && Math.abs(delta) >= 0.05 && (
            <span className="weight-hero-delta">
              {delta < 0 ? <TrendingDown size={14} strokeWidth={2} /> : <TrendingUp size={14} strokeWidth={2} />}
              {Math.abs(delta).toFixed(1)} kg
            </span>
          )}
          <span className="weight-hero-date">week of {dayMonthLabel(latest.week_start)}</span>
        </div>
      ) : (
        <p className="status-text muted">No weight logged yet.</p>
      )}
      {weights.length >= 2 && <WeightChart points={weights} />}

      {isMe && (
        <div className="checkin">
          <div className="checkin-head">
            <button type="button" className="plan-cal-nav-btn" aria-label="Previous week" onClick={() => setWeekStart(shiftWeek(weekStart, -1))}>
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <div className="checkin-week">
              {weekStart === thisWeek ? "This week" : "Week of " + dayMonthLabel(weekStart)}
            </div>
            <button
              type="button"
              className="plan-cal-nav-btn"
              aria-label="Next week"
              disabled={weekStart >= thisWeek}
              onClick={() => setWeekStart(shiftWeek(weekStart, 1))}
            >
              <ChevronRight size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="group-list">
            {GROUPS.map((g) => {
              const summary = g.summary(form);
              return (
                <button key={g.key} type="button" className="group-row" onClick={() => setOpenGroup(g)}>
                  <span className="group-row-icon">
                    <g.Icon size={16} strokeWidth={2} />
                  </span>
                  <span className="group-row-main">
                    <span className="group-row-title">{g.title}</span>
                    {summary ? <span className="group-row-value">{summary}</span> : null}
                  </span>
                  {!summary && <span className="group-row-add">Add</span>}
                  <ChevronRight className="group-row-chevron" size={16} strokeWidth={2} />
                </button>
              );
            })}
          </div>
          {current && (
            <button type="button" className="danger checkin-delete" onClick={removeWeek}>
              Delete this week
            </button>
          )}
        </div>
      )}

      {weekly.length > 0 && (
        <>
          <div className="overline group-list-label">Past weeks</div>
          <div className="group-list">
            {weekly.slice(0, 6).map((w) => {
              const f = rowToForm(w, w.week_start);
              const meta = join([f.sleepAvgHrs && f.sleepAvgHrs + " h sleep", f.sessions && f.sessions + " sessions", f.nutritionAdherencePct && f.nutritionAdherencePct + "% nutrition"]);
              const Row = isMe ? "button" : "div";
              return (
                <Row
                  key={w.week_start}
                  {...(isMe ? { type: "button", onClick: () => setWeekStart(w.week_start) } : {})}
                  className={"group-row" + (isMe && w.week_start === weekStart ? " is-selected" : "")}
                >
                  <span className="group-row-main">
                    <span className="group-row-title">{dayMonthLabel(w.week_start)}</span>
                    {meta && <span className="group-row-value">{meta}</span>}
                  </span>
                  <span className="group-row-figure">{f.weightKg !== "" ? f.weightKg + " kg" : "—"}</span>
                </Row>
              );
            })}
          </div>
        </>
      )}

      {openGroup && (
        <GroupForm
          group={openGroup}
          form={form}
          weekStart={weekStart}
          foodAverages={openGroup.key === "nutrition" ? foodLogAverages(snacks, weekStart) : null}
          onSaved={refreshWeekly}
          onClose={() => setOpenGroup(null)}
        />
      )}
    </div>
  );
}

function GroupForm({ group, form, weekStart, foodAverages, onSaved, onClose }) {
  const [values, setValues] = useState(() => Object.fromEntries(group.fields.map((f) => [f.key, form[f.key]])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      // POST /api/weekly writes the whole row, so send this week's existing
      // values with only this group's fields changed — otherwise saving
      // "Sleep" would blank out the weight logged earlier in the week.
      const res = await fetch("/api/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...values, weekStart })
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

  return (
    <Modal title={group.title + " · " + dayMonthLabel(weekStart)} onClose={onClose}>
      <form onSubmit={submit} className="group-form">
        {group.fields.map((f) => (
          <div key={f.key} className={f.textarea ? "field wide" : "field"}>
            <label htmlFor={"wk-" + f.key}>{f.label}</label>
            {f.textarea ? (
              <textarea id={"wk-" + f.key} value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} autoFocus />
            ) : (
              <input
                id={"wk-" + f.key}
                type="number"
                inputMode="decimal"
                step={f.step}
                max={f.max}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            )}
          </div>
        ))}
        {foodAverages && (
          <div className="field wide">
            <button
              type="button"
              className="ghost sm"
              onClick={() => setValues((v) => ({ ...v, caloriesAvg: String(foodAverages.kcal), proteinAvg: String(foodAverages.protein) }))}
            >
              Fill from food log: {foodAverages.kcal.toLocaleString("en-US")} kcal · {foodAverages.protein} g ({foodAverages.days}{" "}
              {foodAverages.days === 1 ? "day" : "days"})
            </button>
          </div>
        )}
        <div className="form-actions">
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          {error && <span className="error-text inline">{error}</span>}
        </div>
      </form>
    </Modal>
  );
}

// Weekly weight, oldest → newest. A single series, so no legend: the card
// title names it. Hover/tap a point to read its value.
function WeightChart({ points }) {
  const [active, setActive] = useState(null);
  const W = 300;
  const H = 84;
  const PAD_X = 6;
  const PAD_Y = 10;
  const vals = points.map((p) => Number(p.weight_kg));
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (max - min < 1) {
    const mid = (max + min) / 2;
    min = mid - 0.5;
    max = mid + 0.5;
  }
  const x = (i) => PAD_X + (i * (W - PAD_X * 2)) / (points.length - 1);
  const y = (v) => PAD_Y + ((max - v) * (H - PAD_Y * 2)) / (max - min);
  const path = vals.map((v, i) => (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  const shown = active ?? points.length - 1;

  return (
    <div className="weight-chart">
      <div className="weight-chart-plot">
        <svg viewBox={"0 0 " + W + " " + H} preserveAspectRatio="none" role="img" aria-label={"Weight over the last " + points.length + " logged weeks"}>
          <line className="weight-chart-grid" x1={0} x2={W} y1={y(max)} y2={y(max)} />
          <line className="weight-chart-grid" x1={0} x2={W} y1={y(min)} y2={y(min)} />
          <path className="weight-chart-line" d={path} vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p, i) => (
          <button
            key={p.week_start}
            type="button"
            className={"weight-chart-dot" + (i === shown ? " is-active" : "")}
            style={{ left: (x(i) / W) * 100 + "%", top: (y(vals[i]) / H) * 100 + "%" }}
            aria-label={dayMonthLabel(p.week_start) + ": " + vals[i] + " kg"}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
          />
        ))}
      </div>
      <div className="weight-chart-axis">
        <span>{dayMonthLabel(points[0].week_start)}</span>
        <span className="weight-chart-readout">
          {dayMonthLabel(points[shown].week_start)} · <strong>{vals[shown]} kg</strong>
        </span>
        <span>{dayMonthLabel(points[points.length - 1].week_start)}</span>
      </div>
    </div>
  );
}
