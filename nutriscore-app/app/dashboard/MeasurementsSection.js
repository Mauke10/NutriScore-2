"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import Modal from "./Modal";
import { dayMonthLabel, localDateStr, todayStr } from "./utils";
import { MEASUREMENT_PARTS, CUSTOM_PREFIX, partInfo } from "./measurementParts";

const SPARK_W = 56;
const SPARK_H = 20;
const SPARK_POINTS = 8; // last n measurements in the trend line

// Body tab → Measurements. Each person picks which parts they track by
// tapping chips (in a section that folds away once set up); each tracked
// part shows its latest number, a small trend line and the change over
// roughly the last 4 weeks. "Log" opens one form with just the tracked parts.
// Data: /api/measurements (body_measurements table + settings.measurement_parts).
export default function MeasurementsSection({ personId, isMe }) {
  const [tracked, setTracked] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [error, setError] = useState("");
  const [customName, setCustomName] = useState(null); // null = "your own" input closed

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/measurements?person=" + personId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load measurements");
      setTracked(data.tracked || []);
      setEntries(data.entries || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }, [personId]);

  useEffect(() => {
    load();
  }, [load]);

  // Nothing chosen yet → show the chips straight away, it's the first step.
  useEffect(() => {
    if (loaded && isMe && tracked.length === 0) setPickerOpen(true);
  }, [loaded, isMe, tracked.length]);

  const byPart = useMemo(() => {
    const m = {};
    for (const e of entries) (m[e.part] ||= []).push(e); // entries arrive oldest first
    return m;
  }, [entries]);

  // Header date: the latest day any *tracked* part was measured.
  const lastDate = entries.reduce((d, e) => (tracked.includes(e.part) && (!d || e.date > d) ? e.date : d), null);

  async function saveTracked(next) {
    const prev = tracked;
    setTracked(next); // optimistic: chips should feel instant
    try {
      const res = await fetch("/api/measurements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracked: next })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      setTracked(data.tracked);
      setError("");
    } catch (err) {
      setTracked(prev);
      setError(err.message);
    }
  }

  function toggle(key) {
    saveTracked(tracked.includes(key) ? tracked.filter((k) => k !== key) : [...tracked, key]);
  }

  function addCustom() {
    const name = (customName || "").trim().slice(0, 30);
    if (!name) return setCustomName(null);
    const preset = MEASUREMENT_PARTS.find((p) => p.label.toLowerCase() === name.toLowerCase());
    const key = preset ? preset.key : CUSTOM_PREFIX + name;
    if (!tracked.includes(key)) saveTracked([...tracked, key]);
    setCustomName(null);
  }

  // Chips: every preset, plus your own parts (tracked, or with old numbers).
  const customKeys = [...new Set([...tracked, ...Object.keys(byPart)])].filter((k) => k.startsWith(CUSTOM_PREFIX));
  const chipParts = [...MEASUREMENT_PARTS, ...customKeys.map(partInfo)];
  const trackedParts = tracked.map(partInfo).filter(Boolean);

  if (!loaded) return null;
  if (!isMe && trackedParts.length === 0) return null; // nothing to show for the other person

  return (
    <div className="card measure-card">
      <div className="measure-head">
        <h3>
          Measurements {lastDate && <span className="muted">— {dayMonthLabel(lastDate)}</span>}
        </h3>
        {isMe && trackedParts.length > 0 && (
          <button type="button" className="measure-log-btn" onClick={() => setLogOpen(true)}>
            <Plus size={15} strokeWidth={2.2} /> Log
          </button>
        )}
      </div>

      {isMe && (
        <>
          <button type="button" className="measure-picker-toggle" onClick={() => setPickerOpen((o) => !o)} aria-expanded={pickerOpen}>
            <span className="overline">What you track{tracked.length ? " · " + tracked.length : ""}</span>
            <ChevronDown size={15} strokeWidth={2} className={pickerOpen ? "measure-chevron is-open" : "measure-chevron"} />
          </button>
          {pickerOpen && (
            <div className="measure-chips">
              {chipParts.map((p) => {
                const on = tracked.includes(p.key);
                return (
                  <button key={p.key} type="button" className={on ? "measure-chip on" : "measure-chip"} onClick={() => toggle(p.key)} aria-pressed={on}>
                    {on && <Check size={13} strokeWidth={2.6} />}
                    {p.label}
                    {p.unit === "%" ? " %" : ""}
                  </button>
                );
              })}
              {customName === null ? (
                <button type="button" className="measure-chip add" onClick={() => setCustomName("")}>
                  <Plus size={13} strokeWidth={2.4} /> Your own
                </button>
              ) : (
                <input
                  className="measure-chip-input"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustom();
                    }
                    if (e.key === "Escape") setCustomName(null);
                  }}
                  onBlur={addCustom}
                  placeholder="e.g. Calf (left)"
                  aria-label="Name of your own measurement"
                  maxLength={30}
                  autoFocus
                />
              )}
            </div>
          )}
        </>
      )}

      {error && <div className="error-text">{error}</div>}

      {trackedParts.length === 0 ? (
        isMe && <div className="status-text muted">Tap the parts you want to measure — you can change this any time.</div>
      ) : (
        <div className="group-list">
          {trackedParts.map((p) => {
            const series = byPart[p.key] || [];
            const Row = isMe ? "button" : "div";
            return (
              <Row key={p.key} className="group-row" {...(isMe ? { type: "button", onClick: () => setLogOpen(true) } : {})}>
                <span className="group-row-main">
                  <span className="group-row-title">{p.label}</span>
                  <span className="group-row-value">{changeText(series, p.unit)}</span>
                </span>
                {series.length > 1 && <Sparkline values={series.slice(-SPARK_POINTS).map((e) => e.value)} />}
                <span className="group-row-figure">{series.length ? fmt(series[series.length - 1].value) + " " + p.unit : isMe ? <span className="group-row-add">Add</span> : "—"}</span>
              </Row>
            );
          })}
        </div>
      )}

      {logOpen && (
        <LogForm
          parts={trackedParts}
          byPart={byPart}
          onClose={() => setLogOpen(false)}
          onSaved={async () => {
            setLogOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function LogForm({ parts, byPart, onClose, onSaved }) {
  const [date, setDate] = useState(todayStr());
  const [values, setValues] = useState(() => {
    // Re-opening a day you already logged shows what you entered.
    const v = {};
    for (const p of parts) v[p.key] = "";
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setValues((prev) => {
      const v = { ...prev };
      for (const p of parts) {
        const sameDay = (byPart[p.key] || []).find((e) => e.date === date && !e.fromWeekly);
        v[p.key] = sameDay ? String(sameDay.value) : "";
      }
      return v;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, values })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      await onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title="Log measurements" onClose={onClose}>
      <form onSubmit={submit} className="group-form">
        <div className="field wide">
          <label htmlFor="ms-date">Date</label>
          <input id="ms-date" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
        </div>
        {parts.map((p) => {
          const series = byPart[p.key] || [];
          const last = series.length ? series[series.length - 1] : null;
          return (
            <div key={p.key} className="field">
              <label htmlFor={"ms-" + p.key}>
                {p.label} ({p.unit})
              </label>
              <input
                id={"ms-" + p.key}
                type="number"
                inputMode="decimal"
                step="0.1"
                value={values[p.key] ?? ""}
                placeholder={last ? fmt(last.value) : ""}
                onChange={(e) => setValues((v) => ({ ...v, [p.key]: e.target.value }))}
              />
            </div>
          );
        })}
        <div className="form-actions">
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          {error ? <span className="error-text inline">{error}</span> : <span className="status-text muted">Leave blank what you didn't measure.</span>}
        </div>
      </form>
    </Modal>
  );
}

function Sparkline({ values }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = 2 + (i / (values.length - 1)) * (SPARK_W - 4);
      const y = max === min ? SPARK_H / 2 : 2 + (1 - (v - min) / span) * (SPARK_H - 4);
      return x.toFixed(1) + "," + y.toFixed(1);
    })
    .join(" ");
  return (
    <svg className="measure-spark" viewBox={"0 0 " + SPARK_W + " " + SPARK_H} aria-hidden="true">
      <polyline points={pts} />
    </svg>
  );
}

// "−1.2 cm in 4 weeks": latest vs the last number from at least 4 weeks
// earlier (or the first one, if there's less history than that). Neutral
// colour on purpose — smaller is good for waist, bad for an arm.
function changeText(series, unit) {
  if (series.length === 0) return "Not measured yet";
  if (series.length === 1) return "First measurement";
  const last = series[series.length - 1];
  const cutoff = shiftDays(last.date, -28);
  const base = [...series].reverse().find((e) => e.date <= cutoff) || series[0];
  const diff = Math.round((last.value - base.value) * 10) / 10;
  const days = daysBetween(base.date, last.date);
  const span = days >= 7 ? Math.round(days / 7) + (Math.round(days / 7) === 1 ? " week" : " weeks") : null;
  if (diff === 0) return span ? "No change in " + span : "No change since " + dayMonthLabel(base.date);
  const amount = (diff > 0 ? "+" : "−") + fmt(Math.abs(diff)) + " " + unit;
  return span ? amount + " in " + span : amount + " since " + dayMonthLabel(base.date);
}

function fmt(v) {
  return Number(v).toFixed(1);
}

function shiftDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  return localDateStr(new Date(y, m - 1, d + n));
}

function daysBetween(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}
