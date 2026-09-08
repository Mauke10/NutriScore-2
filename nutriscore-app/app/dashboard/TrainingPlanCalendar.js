"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { todayStr, otherOf, monthLabel } from "./utils";

const DISPLAY_NAME = { martin: "Martin", laura: "Laura" };
const SERIES_VAR = { martin: "--series-martin", laura: "--series-laura" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function currentMonthStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function buildMonthGrid(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const startWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(monthStr + "-" + String(d).padStart(2, "0"));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatSelected(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export default function TrainingPlanCalendar({ me }) {
  const partnerId = otherOf(me);
  const today = todayStr();
  const [month, setMonth] = useState(currentMonthStr());
  const [entries, setEntries] = useState({}); // "YYYY-MM-DD" -> { martin, laura }
  const [selected, setSelected] = useState(today);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const loadedFor = useRef(null);
  const saveTimer = useRef(null);

  async function refresh() {
    const res = await fetch("/api/training-plan?month=" + month);
    const data = await res.json();
    const map = {};
    for (const row of data.entries || []) {
      if (!map[row.plan_date]) map[row.plan_date] = { martin: null, laura: null };
      map[row.plan_date][row.person_id] = row.activity || null;
    }
    setEntries(map);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    if (loadedFor.current === selected) return;
    loadedFor.current = selected;
    setSaved(false);
    // Use whatever's already loaded for this month if we have it; otherwise
    // pull just this one day (covers a selection outside the loaded month).
    const known = entries[selected];
    if (known) {
      setDraft(known[me] || "");
    } else {
      fetch("/api/training-plan?date=" + selected)
        .then((res) => res.json())
        .then((data) => setDraft((data.entries && data.entries[me]) || ""))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, entries]);

  async function saveActivity(dateStr, activity) {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/training-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planDate: dateStr, activity })
      });
      setEntries((prev) => ({
        ...prev,
        [dateStr]: { ...(prev[dateStr] || { martin: null, laura: null }), [me]: activity || null }
      }));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function onDraftChange(v) {
    setDraft(v);
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveActivity(selected, v), 800);
  }

  function onBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveActivity(selected, draft);
  }

  const cells = buildMonthGrid(month);
  const [yearStr] = month.split("-");
  const partnerActivity = (entries[selected] && entries[selected][partnerId]) || "";

  return (
    <div className="card plan-calendar">
      <h3>
        Training calendar <span className="muted">— what's planned each day</span>
      </h3>

      <div className="plan-cal-nav">
        <button type="button" className="plan-cal-nav-btn" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month">
          <ChevronLeft size={16} strokeWidth={2.2} />
        </button>
        <div className="plan-cal-month">
          {monthLabel(month)} {yearStr}
        </div>
        <button type="button" className="plan-cal-nav-btn" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month">
          <ChevronRight size={16} strokeWidth={2.2} />
        </button>
        {month !== currentMonthStr() && (
          <button
            type="button"
            className="ghost plan-cal-today-btn"
            onClick={() => {
              setMonth(currentMonthStr());
              setSelected(today);
            }}
          >
            Today
          </button>
        )}
      </div>

      <div className="plan-cal-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="plan-cal-grid">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={"blank-" + i} className="plan-cal-cell empty" />;
          const dayNum = Number(dateStr.slice(-2));
          const dayEntries = entries[dateStr];
          const isToday = dateStr === today;
          const isSelected = dateStr === selected;
          return (
            <button
              type="button"
              key={dateStr}
              className={"plan-cal-cell" + (isToday ? " is-today" : "") + (isSelected ? " is-selected" : "")}
              onClick={() => setSelected(dateStr)}
            >
              <span className="plan-cal-daynum">{dayNum}</span>
              {dayEntries?.martin && (
                <span className="plan-cal-chip" style={{ color: "var(--series-martin)" }}>
                  {dayEntries.martin}
                </span>
              )}
              {dayEntries?.laura && (
                <span className="plan-cal-chip" style={{ color: "var(--series-laura)" }}>
                  {dayEntries.laura}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="plan-cal-editor">
        <div className="plan-cal-editor-date">{formatSelected(selected)}</div>
        <div className="plan-cal-editor-row">
          <span className="dot" style={{ background: "var(" + SERIES_VAR[me] + ")" }} />
          <input
            type="text"
            value={draft}
            maxLength={120}
            placeholder="e.g. Swim 1.5km"
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onBlur}
          />
        </div>
        <div className="plan-cal-editor-meta">{saving ? "Saving…" : saved ? "Saved" : " "}</div>
        <div className="plan-cal-editor-row plan-cal-editor-partner">
          <span className="dot" style={{ background: "var(" + SERIES_VAR[partnerId] + ")" }} />
          <span className={partnerActivity ? "" : "empty"}>{partnerActivity || DISPLAY_NAME[partnerId] + " hasn't planned this day yet."}</span>
        </div>
      </div>
    </div>
  );
}
