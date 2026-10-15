"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import Modal from "./Modal";
import { PEOPLE, localDateStr, mondayOf, otherOf, shiftWeek } from "./utils";
import { AMOUNTS, SPORTS, SPORT_KEYS, distancesOf, sessionTypesFor, sportOf } from "../../lib/trainingSports";

// The Calendar tab: one week at a time, a card per day with both people's
// planned sessions (any number each). Tap "+ Plan" or one of your own
// sessions to plan/edit it in a sheet. A session counts as done when you tick
// it, or when a training session of the same sport was logged that day.
//
// "Today" here is the real calendar day (localDateStr(new Date())), not the
// food tab's "Day ends at" shifted one — see CLAUDE.md. It's only worked out
// in the browser (the server's clock is UTC and its date formatting differs),
// so the week renders after mount; dates are formatted by hand for the same
// reason.

export const PLAN_CHANGED = "nutriscore-plan-changed"; // window event, the header strip listens

const NAME = Object.fromEntries(PEOPLE.map((p) => [p.key, p.name]));
const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  return localDateStr(new Date(y, m - 1, d + n));
}

function dayNum(ymd) {
  return Number(ymd.slice(8));
}

function dayMonth(ymd) {
  return dayNum(ymd) + " " + MONTH[Number(ymd.slice(5, 7)) - 1];
}

// "12 – 18 Oct", or "28 Sep – 4 Oct" across a month end.
function rangeLabel(monday) {
  const sunday = addDays(monday, 6);
  return (monday.slice(5, 7) === sunday.slice(5, 7) ? dayNum(monday) : dayMonth(monday)) + " – " + dayMonth(sunday);
}

// "Thu 15 Oct"
function longDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return WEEKDAY[(new Date(y, m - 1, d).getDay() + 6) % 7] + " " + dayMonth(ymd);
}

function weeksTo(raceDate, today) {
  if (!raceDate || raceDate < today) return null;
  const [y1, m1, d1] = today.split("-").map(Number);
  const [y2, m2, d2] = raceDate.split("-").map(Number);
  const days = Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
  return Math.floor(days / 7);
}

function sameText(a, b) {
  return a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");
}

function fmtKm(n) {
  return (Math.round(n * 10) / 10).toLocaleString("en-GB") + " km";
}

export default function TrainingPlanCalendar(props) {
  const [today, setToday] = useState(null);
  useEffect(() => setToday(localDateStr(new Date())), []);
  if (!today) return <div className="plan-week" />;
  return <WeekView {...props} today={today} />;
}

function WeekView({ me, raceDate, sessionsVersion, today }) {
  const partner = otherOf(me);
  const thisMonday = mondayOf(new Date());
  const [monday, setMonday] = useState(thisMonday);
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState(null); // { date, item? }
  const dayRefs = useRef({});

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const sunday = days[6];

  async function refresh() {
    try {
      const res = await fetch("/api/training-plan?from=" + monday + "&to=" + sunday);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load the plan.");
      setPlans(data.entries || []);
      setSessions(data.sessions || []);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday, sessionsVersion]);

  function changed() {
    refresh();
    window.dispatchEvent(new Event(PLAN_CHANGED));
  }

  function isDone(item) {
    if (item.done) return true;
    const types = sessionTypesFor(sportOf(item.activity));
    return sessions.some((s) => s.person_id === item.person_id && s.session_date === item.plan_date && types.includes(s.activity_type));
  }

  // Your planned km for the week, per sport.
  const totals = { swim: 0, bike: 0, run: 0 };
  for (const p of plans) {
    if (p.person_id !== me) continue;
    const d = distancesOf(p.activity);
    totals.swim += d.swim;
    totals.bike += d.bike;
    totals.run += d.run;
  }

  const weeks = weeksTo(raceDate, today);
  const title = monday === thisMonday ? "This week" : monday === shiftWeek(thisMonday, 1) ? "Next week" : monday === shiftWeek(thisMonday, -1) ? "Last week" : rangeLabel(monday);

  return (
    <div className="plan-week" data-person={me}>
      <div className="plan-week-head">
        <div>
          <h2 className="plan-week-title">{title}</h2>
          <div className="plan-week-sub">
            {rangeLabel(monday)}
            {weeks !== null && (
              <>
                {" · "}
                <strong>{weeks === 0 ? "race week!" : weeks + (weeks === 1 ? " week" : " weeks") + " to race"}</strong>
              </>
            )}
          </div>
        </div>
        <div className="plan-week-nav">
          {monday !== thisMonday && (
            <button type="button" className="ghost plan-cal-today-btn" onClick={() => setMonday(thisMonday)}>
              Today
            </button>
          )}
          <button type="button" className="plan-cal-nav-btn" onClick={() => setMonday((m) => shiftWeek(m, -1))} aria-label="Previous week">
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>
          <button type="button" className="plan-cal-nav-btn" onClick={() => setMonday((m) => shiftWeek(m, 1))} aria-label="Next week">
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="plan-strip">
        {days.map((d, i) => {
          const who = PEOPLE.filter((p) => plans.some((x) => x.plan_date === d && x.person_id === p.key));
          return (
            <button
              type="button"
              key={d}
              className={"plan-strip-day" + (d === today ? " is-today" : "")}
              onClick={() => dayRefs.current[d]?.scrollIntoView({ behavior: "smooth", block: "center" })}
            >
              {WEEKDAY[i]}
              <b>{dayNum(d)}</b>
              <span className="plan-strip-dots">
                {who.map((p) => (
                  <i key={p.key} style={{ background: "var(" + p.seriesVar + ")" }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="plan-totals" aria-label="Your planned distance this week">
        {["swim", "bike", "run"].map((k) => (
          <div key={k} className="plan-total">
            <span>
              {SPORTS[k].emoji} {SPORTS[k].label}
            </span>
            <b>{totals[k] ? fmtKm(totals[k]) : "–"}</b>
          </div>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="plan-days">
        {days.map((d) => {
          const mine = plans.filter((p) => p.plan_date === d && p.person_id === me);
          const theirs = plans.filter((p) => p.plan_date === d && p.person_id === partner);
          // A session you both planned with the same words shows once.
          const shared = mine.filter((m) => theirs.some((t) => sameText(t.activity, m.activity)));
          const theirsLeft = theirs.filter((t) => !shared.some((m) => sameText(t.activity, m.activity)));
          const mineLeft = mine.filter((m) => !shared.includes(m));
          const past = d < today;
          const rel = d === today ? "today" : d === addDays(today, -1) ? "yesterday" : d === addDays(today, 1) ? "tomorrow" : "";
          return (
            <div key={d} ref={(el) => (dayRefs.current[d] = el)} className={"plan-day" + (d === today ? " is-today" : "") + (past ? " is-past" : "")}>
              <div className="plan-day-head">
                <span>{longDate(d)}</span>
                {rel && <small>{rel}</small>}
                {shared.length > 0 && <span className="plan-together">together</span>}
                {mine.length > 0 && (
                  <button type="button" className="plan-head-add" onClick={() => setSheet({ date: d })} aria-label={"Add another session on " + longDate(d)}>
                    <Plus size={14} strokeWidth={2.6} /> Add
                  </button>
                )}
              </div>

              {shared.map((item) => (
                <PlanLine key={item.id} item={item} done={isDone(item)} together onClick={() => setSheet({ date: d, item })} />
              ))}
              {mineLeft.map((item) => (
                <PlanLine key={item.id} item={item} done={isDone(item)} person={me} onClick={() => setSheet({ date: d, item })} />
              ))}
              {mine.length === 0 && (
                <button type="button" className="plan-line plan-add" style={{ "--c": "var(--accent)" }} onClick={() => setSheet({ date: d })}>
                  <span className="plan-bar" />
                  <Plus size={15} strokeWidth={2.4} />
                  Plan
                </button>
              )}
              {theirsLeft.map((item) => (
                <PlanLine key={item.id} item={item} done={isDone(item)} person={partner} />
              ))}
              {theirs.length === 0 && loaded && (
                <div className="plan-line plan-empty" style={{ "--c": "var(--series-" + partner + ")" }}>
                  <span className="plan-bar" />
                  {NAME[partner]}: nothing planned
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sheet && (
        <PlanSheet
          me={me}
          date={sheet.date}
          item={sheet.item}
          partnerPlans={plans.filter((p) => p.plan_date === sheet.date && p.person_id === partner)}
          today={today}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            changed();
          }}
        />
      )}
    </div>
  );
}

function PlanLine({ item, done, person, together, onClick }) {
  const sport = sportOf(item.activity);
  const style = together ? undefined : { "--c": "var(--series-" + person + ")" };
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={"plan-line" + (together ? " is-together" : "") + (onClick ? " is-mine" : "")} style={style} onClick={onClick}>
      <span className="plan-bar" />
      <span className="plan-emoji" aria-hidden="true">
        {SPORTS[sport].emoji}
      </span>
      <span className="plan-text">{item.activity}</span>
      {done && (
        <span className="plan-done">
          <Check size={12} strokeWidth={3} /> done
        </span>
      )}
    </Tag>
  );
}

function PlanSheet({ me, date, item, partnerPlans, today, onClose, onSaved }) {
  const partner = otherOf(me);
  const [text, setText] = useState(item?.activity || "");
  const [sport, setSport] = useState(item ? sportOf(item.activity) : null);
  const [alsoPartner, setAlsoPartner] = useState(false);
  const [done, setDone] = useState(!!item?.done);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  function pickSport(k) {
    setSport(k);
    setText(SPORTS[k].label + (k === "rest" ? " day" : ""));
  }

  function pickAmount(a) {
    const base = SPORTS[sport].label;
    setText(sport === "brick" ? base + ": " + a : base + " " + a);
  }

  async function send(method, body, url = "/api/training-plan") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save.");
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  function save(e) {
    e.preventDefault();
    if (!text.trim()) return setError("What's the plan?");
    if (item) send("PATCH", { id: item.id, activity: text, done });
    else send("POST", { planDate: date, activity: text, alsoPartner });
  }

  return (
    <Modal title={(item ? "Edit · " : "Plan · ") + longDate(date)} onClose={onClose}>
      <form className="plan-sheet" onSubmit={save}>
        {partnerPlans.length > 0 && (
          <div className="plan-sheet-partner" style={{ "--c": "var(--series-" + partner + ")" }}>
            <span className="dot" />
            {NAME[partner]}: {partnerPlans.map((p) => SPORTS[sportOf(p.activity)].emoji + " " + p.activity).join(" · ")}
          </div>
        )}

        <div className="plan-sheet-label">What</div>
        <div className="plan-chips">
          {SPORT_KEYS.map((k) => (
            <button type="button" key={k} className={"plan-chip" + (sport === k ? " is-on" : "")} onClick={() => pickSport(k)}>
              {SPORTS[k].emoji} {SPORTS[k].label}
            </button>
          ))}
        </div>

        {sport && AMOUNTS[sport]?.length > 0 && (
          <>
            <div className="plan-sheet-label">How much</div>
            <div className="plan-chips">
              {AMOUNTS[sport].map((a) => (
                <button type="button" key={a} className="plan-chip" onClick={() => pickAmount(a)}>
                  {a}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="plan-sheet-label" htmlFor="plan-text">
          Plan
        </label>
        <input
          id="plan-text"
          type="text"
          value={text}
          maxLength={120}
          placeholder="e.g. Swim 1.5 km, easy"
          onChange={(e) => {
            setText(e.target.value);
            setSport(e.target.value.trim() ? sportOf(e.target.value) : null);
          }}
        />

        {!item && (
          <label className="plan-sheet-check">
            <input type="checkbox" checked={alsoPartner} onChange={(e) => setAlsoPartner(e.target.checked)} />
            Plan it for {NAME[partner]} too (doing it together)
          </label>
        )}
        {item && date <= today && (
          <label className="plan-sheet-check">
            <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
            Done
          </label>
        )}

        {error && <div className="error">{error}</div>}

        <div className="form-actions">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Saving…" : item ? "Save" : "Add to plan"}
          </button>
          {item &&
            (confirmDelete ? (
              <button type="button" className="danger" disabled={busy} onClick={() => send("DELETE", null, "/api/training-plan?id=" + encodeURIComponent(item.id))}>
                Really delete?
              </button>
            ) : (
              <button type="button" className="ghost plan-sheet-delete" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> Delete
              </button>
            ))}
        </div>
      </form>
    </Modal>
  );
}
