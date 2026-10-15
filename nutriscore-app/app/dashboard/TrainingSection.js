"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "./Modal";
import { localDateStr, mondayOf, shiftWeek } from "./utils";
import { agoLabel, lastStravaSync, syncStrava } from "./strava";
import { SPORTS, distancesOf, estimateMinutes, sessionTypesFor, sportColor, sportOf, workoutMinutes } from "../../lib/trainingSports";

// The Training tab: one layout seen at three zooms. Week (day bars, done vs
// planned per sport, the week's workouts), Month (goal rings, progress with an
// even-pace marker, weight moved under Strength) and Season (12 weeks of
// hours, longest swim/ride/run vs the race, consistency grid). Workouts are
// Strava activities and hand-logged sessions together (/api/training-feed);
// "planned" comes from the Calendar's training_plan_items.
//
// Dates are worked out in the browser only (the server's clock is UTC and its
// date formatting differs — see TrainingPlanCalendar), so nothing renders
// until mount.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ENDURANCE = ["swim", "bike", "run"];
const RACE_KM = { swim: 1.9, bike: 90, run: 21.1 };
const LOG_SPORTS = ["swim", "bike", "run", "strength", "mobility", "other"];
const FEELS = [
  { v: 1, e: "😮‍💨", label: "Tough" },
  { v: 2, e: "😐", label: "OK" },
  { v: 3, e: "💪", label: "Good" },
  { v: 4, e: "🔥", label: "Great" }
];
const ON_TRACK = 3; // workouts in a week that count as "on track" for the streak

function parse(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(ymd, n) {
  const d = parse(ymd);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}
function dayMonth(ymd) {
  return Number(ymd.slice(8)) + " " + MONTHS[Number(ymd.slice(5, 7)) - 1];
}
function weekdayOf(ymd) {
  return WD[(parse(ymd).getDay() + 6) % 7];
}
function shiftMonth(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
function monthEnd(ym) {
  const [y, m] = ym.split("-").map(Number);
  return localDateStr(new Date(y, m, 0));
}
// 175 → "2:55"
function hhmm(min) {
  const m = Math.round(min || 0);
  return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
}
// 57 → "57 min", 85 → "1 h 25"
function duration(min) {
  const m = Math.round(min || 0);
  return m < 60 ? m + " min" : Math.floor(m / 60) + " h" + (m % 60 ? " " + String(m % 60).padStart(2, "0") : "");
}
function km(n) {
  const v = Number(n) || 0;
  return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString("en-GB");
}
const minutesOf = workoutMinutes;
// "5:15 /km", "2:04 /100m", "26.1 km/h"
function paceOf(w) {
  if (!w.distanceKm || !w.minutes) return w.speedKmh ? w.speedKmh + " km/h" : null;
  if (w.sport === "bike") return (w.speedKmh || Math.round((w.distanceKm / w.minutes) * 600) / 10) + " km/h";
  const perKm = w.minutes / w.distanceKm;
  const mmss = (x) => Math.floor(x) + ":" + String(Math.round((x % 1) * 60)).padStart(2, "0");
  if (w.sport === "run") return mmss(perKm) + " /km";
  if (w.sport === "swim") return mmss(perKm / 10) + " /100m";
  return null;
}
function planDone(plan, workouts) {
  if (plan.done) return true;
  const types = sessionTypesFor(sportOf(plan.activity));
  return workouts.some((w) => w.date === plan.plan_date && types.includes(w.sport));
}
function matchesPlan(w, plans) {
  return plans.some((p) => p.plan_date === w.date && sessionTypesFor(sportOf(p.activity)).includes(w.sport));
}

export default function TrainingSection(props) {
  const [today, setToday] = useState(null);
  useEffect(() => setToday(localDateStr(new Date())), []);
  if (!today) return <div className="tr" />;
  return <TrainingView {...props} today={today} />;
}

function TrainingView({ personId, isMe, training, refreshTraining, refreshSessions, swimGoalKm, bikeGoalKm, runGoalKm, stravaStatus, refreshStravaStatus, raceDate, today }) {
  const thisMonday = mondayOf(parse(today));
  const thisMonth = today.slice(0, 7);
  const seasonFrom = shiftWeek(thisMonday, -11);
  const seasonTo = addDays(thisMonday, 6);

  const [scope, setScope] = useState("week");
  const [monday, setMonday] = useState(thisMonday);
  const [month, setMonth] = useState(thisMonth);
  const [season, setSeason] = useState(null); // { workouts, plans, records } for the last 12 weeks
  const [scoped, setScoped] = useState(null); // { key, workouts, plans } for the week/month on screen
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState(null); // { workout? } — log / edit a hand-logged workout
  const [weightOpen, setWeightOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(() => lastStravaSync());

  async function feed(from, to, records) {
    const res = await fetch("/api/training-feed?person=" + personId + "&from=" + from + "&to=" + to + (records ? "&records=1" : ""));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't load training.");
    return { workouts: data.workouts || [], plans: data.plans || [], records: data.records || null };
  }

  useEffect(() => {
    let cancelled = false;
    feed(seasonFrom, seasonTo, true)
      .then((d) => !cancelled && (setSeason(d), setError("")))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, version]);

  // The week or month on screen (a month also loads the one before, for "vs last month").
  const scopedKey = scope === "week" ? "w" + monday : scope === "month" ? "m" + month : null;
  useEffect(() => {
    if (!scopedKey) return;
    let cancelled = false;
    const [from, to] = scope === "week" ? [monday, addDays(monday, 6)] : [shiftMonth(month, -1) + "-01", monthEnd(month)];
    feed(from, to, false)
      .then((d) => !cancelled && setScoped({ key: scopedKey + ":" + version, ...d }))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, scopedKey, version]);

  function changed() {
    setVersion((v) => v + 1);
    refreshSessions?.();
  }

  async function syncNow() {
    setSyncing(true);
    setError("");
    try {
      await syncStrava(personId);
      setSyncedAt(Date.now());
      changed();
      refreshTraining?.();
      refreshStravaStatus?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  const streak = season ? streakOf(season.workouts, thisMonday) : null;
  const scopedReady = scoped && scoped.key === scopedKey + ":" + version;

  return (
    <div className="tr" data-person={personId}>
      <div className="tr-controls">
        <div className="tr-seg" role="tablist" aria-label="Time range">
          {["week", "month", "season"].map((k) => (
            <button key={k} type="button" role="tab" aria-selected={scope === k} className={scope === k ? "is-on" : ""} onClick={() => setScope(k)}>
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
        {isMe && (
          <button type="button" className="tr-log-btn" onClick={() => setSheet({})}>
            <Plus size={16} strokeWidth={2.6} /> Log
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {scope === "week" && (
        <WeekView
          ready={scopedReady}
          data={scopedReady ? scoped : null}
          monday={monday}
          thisMonday={thisMonday}
          today={today}
          streak={streak}
          onShift={(n) => setMonday((m) => shiftWeek(m, n))}
          onToday={() => setMonday(thisMonday)}
          onOpen={(w) => setSheet({ workout: w })}
          isMe={isMe}
        />
      )}
      {scope === "month" && (
        <MonthView
          ready={scopedReady}
          data={scopedReady ? scoped : null}
          month={month}
          thisMonth={thisMonth}
          today={today}
          goals={{ swim: swimGoalKm, bike: bikeGoalKm, run: runGoalKm }}
          training={training || []}
          onShift={(n) => setMonth((m) => shiftMonth(m, n))}
          onToday={() => setMonth(thisMonth)}
          onOpen={(w) => setSheet({ workout: w })}
          onEditWeight={isMe ? () => setWeightOpen(true) : null}
          isMe={isMe}
        />
      )}
      {scope === "season" && <SeasonView data={season} seasonFrom={seasonFrom} thisMonday={thisMonday} today={today} streak={streak} raceDate={raceDate} />}

      <div className="tr-strava">
        {stravaStatus?.connected ? (
          <>
            <span className="tr-strava-badge">Strava</span>
            <span>{isMe ? (syncedAt ? "synced " + agoLabel(syncedAt) : "connected") : "connected"}</span>
            {isMe && (
              <button type="button" className="ghost" onClick={syncNow} disabled={syncing}>
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            )}
          </>
        ) : isMe ? (
          <>
            <span>Connect Strava to bring your rides, runs and swims in automatically.</span>
            <a className="ghost-link" href="/api/strava/connect">
              Connect
            </a>
          </>
        ) : (
          <span>Strava not connected · workouts are logged by hand</span>
        )}
      </div>

      {sheet && (
        <LogSheet
          today={today}
          workout={sheet.workout}
          todaysPlans={(season?.plans || []).filter((p) => p.plan_date === today && !planDone(p, season?.workouts || []))}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            changed();
          }}
        />
      )}
      {weightOpen && (
        <WeightSheet
          month={month}
          current={(training || []).find((t) => t.month === month)?.weight_moved_kg}
          onClose={() => setWeightOpen(false)}
          onSaved={async () => {
            setWeightOpen(false);
            await refreshTraining?.();
          }}
        />
      )}
    </div>
  );
}

// Consecutive weeks with ON_TRACK+ workouts, counting back from this week —
// or from last week while this one hasn't got there yet (the week isn't over).
function streakOf(workouts, thisMonday) {
  const count = (mon) => workouts.filter((w) => w.date >= mon && w.date <= addDays(mon, 6)).length;
  let mon = count(thisMonday) >= ON_TRACK ? thisMonday : shiftWeek(thisMonday, -1);
  let n = 0;
  while (n < 12 && count(mon) >= ON_TRACK) {
    n += 1;
    mon = shiftWeek(mon, -1);
  }
  return n;
}

function StreakChip({ streak }) {
  if (!streak) return null;
  return (
    <span className="tr-chip is-hot" title={"Weeks in a row with " + ON_TRACK + "+ workouts"}>
      🔥 {streak >= 12 ? "12+" : streak} {streak === 1 ? "wk" : "wks"} on track
    </span>
  );
}

function Nav({ label, onPrev, onNext, nextDisabled, onToday, showToday }) {
  return (
    <div className="tr-nav">
      <span className="tr-eyebrow">{label}</span>
      {showToday && (
        <button type="button" className="tr-nav-today" onClick={onToday}>
          Now
        </button>
      )}
      <button type="button" className="tr-nav-btn" onClick={onPrev} aria-label="Previous">
        <ChevronLeft size={16} strokeWidth={2.4} />
      </button>
      <button type="button" className="tr-nav-btn" onClick={onNext} disabled={nextDisabled} aria-label="Next">
        <ChevronRight size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
}

function WeekView({ ready, data, monday, thisMonday, today, streak, onShift, onToday, onOpen, isMe }) {
  const sunday = addDays(monday, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const workouts = data?.workouts || [];
  const plans = data?.plans || [];

  // Minutes per day, stacked by sport; plans still to do from today on show dashed.
  const bars = days.map((d) => {
    const done = workouts.filter((w) => w.date === d).reduce((acc, w) => ((acc[w.sport] = (acc[w.sport] || 0) + minutesOf(w)), acc), {});
    const ghost = d >= today ? plans.filter((p) => p.plan_date === d && !planDone(p, workouts)).reduce((s, p) => s + estimateMinutes(p.activity), 0) : 0;
    return { d, done, ghost };
  });
  const totalMin = workouts.reduce((s, w) => s + minutesOf(w), 0);
  const scale = Math.max(60, ...bars.map((b) => Object.values(b.done).reduce((s, v) => s + v, 0) + b.ghost));

  const planned = { swim: 0, bike: 0, run: 0, strength: 0 };
  for (const p of plans) {
    const dist = distancesOf(p.activity);
    for (const k of ENDURANCE) planned[k] += dist[k];
    if (sportOf(p.activity) === "strength") planned.strength += 1;
  }
  const done = { swim: 0, bike: 0, run: 0, strength: 0 };
  for (const w of workouts) {
    if (ENDURANCE.includes(w.sport)) done[w.sport] += w.distanceKm || 0;
    if (w.sport === "strength") done.strength += 1;
  }

  const label = monday.slice(5, 7) === sunday.slice(5, 7) ? Number(monday.slice(8)) + " – " + dayMonth(sunday) : dayMonth(monday) + " – " + dayMonth(sunday);

  return (
    <>
      <div className="card tr-hero">
        <Nav label={label} onPrev={() => onShift(-1)} onNext={() => onShift(1)} onToday={onToday} showToday={monday !== thisMonday} />
        <div className="tr-headline">
          <div className="tr-big">
            {hhmm(totalMin)}
            <small> h</small>
          </div>
          <span className="tr-headline-sub">
            {workouts.length} {workouts.length === 1 ? "workout" : "workouts"}
          </span>
          {monday === thisMonday && <StreakChip streak={streak} />}
        </div>
        <div className={"tr-days" + (ready ? "" : " is-loading")}>
          {bars.map((b) => (
            <div key={b.d} className="tr-day" title={weekdayOf(b.d) + " " + dayMonth(b.d)}>
              {b.ghost > 0 && <i className="tr-ghost" style={{ height: (b.ghost / scale) * 100 + "%" }} />}
              {Object.entries(b.done).map(([sport, min]) => (
                <i key={sport} style={{ height: Math.max(4, (min / scale) * 100) + "%", background: sportColor(sport) }} />
              ))}
            </div>
          ))}
        </div>
        <div className="tr-day-labels">
          {days.map((d) => (
            <span key={d} className={d === today ? "is-today" : ""}>
              {weekdayOf(d)[0]}
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        {ENDURANCE.map((k) => (
          <SportRow key={k} sport={k} value={done[k]} of={planned[k] || null} unit="km" />
        ))}
        {(done.strength > 0 || planned.strength > 0) && <SportRow sport="strength" value={done.strength} of={planned.strength || null} unit="" />}
        {plans.length === 0 && <div className="tr-note">Nothing planned this week — plan sessions on the Calendar tab to see done vs planned.</div>}
      </div>

      <WorkoutList title={monday === thisMonday ? "This week's workouts" : "Workouts"} workouts={workouts} plans={plans} ready={ready} onOpen={onOpen} isMe={isMe} empty="No workouts this week yet." />
    </>
  );
}

function MonthView({ ready, data, month, thisMonth, today, goals, training, onShift, onToday, onOpen, onEditWeight, isMe }) {
  const all = data?.workouts || [];
  const workouts = all.filter((w) => w.date.startsWith(month));
  const prev = all.filter((w) => w.date.startsWith(shiftMonth(month, -1)));
  const plans = (data?.plans || []).filter((p) => p.plan_date.startsWith(month));
  const minutes = workouts.reduce((s, w) => s + minutesOf(w), 0);
  const prevMinutes = prev.reduce((s, w) => s + minutesOf(w), 0);
  const change = prevMinutes > 0 ? Math.round(((minutes - prevMinutes) / prevMinutes) * 100) : null;

  const [y, m] = month.split("-").map(Number);
  const daysIn = new Date(y, m, 0).getDate();
  const isNow = month === thisMonth;
  const dayNum = Number(today.slice(8));
  const pace = isNow ? (dayNum - 0.5) / daysIn : null; // where an even pace would be by now
  const daysLeft = daysIn - dayNum;

  const done = { swim: 0, bike: 0, run: 0, strength: 0 };
  for (const w of workouts) {
    if (ENDURANCE.includes(w.sport)) done[w.sport] += w.distanceKm || 0;
    if (w.sport === "strength") done.strength += 1;
  }
  const plannedStrength = plans.filter((p) => sportOf(p.activity) === "strength").length;

  // Weight moved: this month vs the best of the last 6 months with a number.
  const weight = Number(training.find((t) => t.month === month)?.weight_moved_kg) || 0;
  const recent = training.filter((t) => t.month <= month && t.month > shiftMonth(month, -6) && t.weight_moved_kg != null);
  const weightBest = Math.max(weight, ...recent.map((t) => Number(t.weight_moved_kg) || 0));
  const lastWeight = Number(training.find((t) => t.month === shiftMonth(month, -1))?.weight_moved_kg) || 0;

  return (
    <>
      <div className="card tr-hero">
        <Nav
          label={MONTHS_LONG[m - 1] + (y !== Number(thisMonth.slice(0, 4)) ? " " + y : "") + (isNow ? " · " + daysLeft + (daysLeft === 1 ? " day" : " days") + " left" : "")}
          onPrev={() => onShift(-1)}
          onNext={() => onShift(1)}
          onToday={onToday}
          showToday={!isNow}
        />
        <div className="tr-headline">
          <div className="tr-big">
            {hhmm(minutes)}
            <small> h</small>
          </div>
          <span className="tr-headline-sub">
            {workouts.length} {workouts.length === 1 ? "workout" : "workouts"}
          </span>
          {change !== null && (
            <span className={"tr-chip" + (change >= 0 ? " is-up" : "")}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs {MONTHS[(m + 10) % 12]}
            </span>
          )}
        </div>
        <div className={"tr-rings" + (ready ? "" : " is-loading")}>
          {ENDURANCE.map((k) => (
            <Ring key={k} sport={k} value={done[k]} goal={goals[k]} />
          ))}
        </div>
      </div>

      <div className="card">
        {ENDURANCE.map((k) => (
          <SportRow key={k} sport={k} value={done[k]} of={Number(goals[k]) || null} unit="km" pace={pace} />
        ))}
        <SportRow sport="strength" value={done.strength} of={plannedStrength || null} unit="" pace={plannedStrength ? pace : null}>
          <div className="tr-weight">
            <div className="tr-weight-top">
              <span>Weight moved</span>
              <b>{weight ? Math.round(weight).toLocaleString("en-GB") + " kg" : "—"}</b>
              {onEditWeight && (
                <button type="button" className="tr-weight-edit" onClick={onEditWeight} aria-label="Edit weight moved">
                  <Pencil size={13} strokeWidth={2.2} />
                </button>
              )}
            </div>
            <div className="tr-track is-thin">
              <i style={{ width: (weightBest ? (weight / weightBest) * 100 : 0) + "%", background: sportColor("strength") }} />
            </div>
            <div className="tr-weight-sub">
              {weight && weight >= weightBest && recent.length > 1 ? "Best month in the last six" : lastWeight ? MONTHS[(m + 10) % 12] + ": " + Math.round(lastWeight).toLocaleString("en-GB") + " kg" : weightBest ? "Bar = your best month in the last six" : "Total kg lifted this month"}
            </div>
          </div>
        </SportRow>
        {pace !== null && <div className="tr-note">The tick shows where an even pace would put you today.</div>}
      </div>

      <WorkoutList title={MONTHS_LONG[m - 1] + "'s workouts"} workouts={workouts} plans={plans} ready={ready} onOpen={onOpen} isMe={isMe} limit={5} empty="No workouts this month yet." />
    </>
  );
}

function SeasonView({ data, seasonFrom, thisMonday, today, streak, raceDate }) {
  const workouts = data?.workouts || [];
  const weeks = Array.from({ length: 12 }, (_, i) => shiftWeek(seasonFrom, i));
  const weekMin = weeks.map((mon) => workouts.filter((w) => w.date >= mon && w.date <= addDays(mon, 6)).reduce((s, w) => s + minutesOf(w), 0));
  const full = weekMin.slice(0, 11); // the current week isn't over, so it's left out of the average
  const avg = full.reduce((s, v) => s + v, 0) / full.length;
  const scale = Math.max(60, ...weekMin);

  const dayMin = {};
  for (const w of workouts) dayMin[w.date] = (dayMin[w.date] || 0) + minutesOf(w);
  const cells = Array.from({ length: 84 }, (_, i) => addDays(seasonFrom, i));
  const activeDays = cells.filter((d) => d < thisMonday && dayMin[d] > 0).length;

  let weeksToRace = null;
  if (raceDate && raceDate >= today) weeksToRace = Math.floor((parse(raceDate) - parse(today)) / (7 * 86400000));

  // Month labels under the first week that starts in that month.
  const monthTicks = weeks.map((mon, i) => (i === 0 || mon.slice(5, 7) !== weeks[i - 1].slice(5, 7) ? MONTHS[Number(mon.slice(5, 7)) - 1] : ""));

  return (
    <>
      <div className="card tr-hero">
        <div className="tr-nav">
          <span className="tr-eyebrow">Average week · last 12</span>
        </div>
        <div className="tr-headline">
          <div className="tr-big">
            {hhmm(avg)}
            <small> h</small>
          </div>
          {weeksToRace !== null && <span className="tr-chip">🏁 {weeksToRace} wks to race</span>}
        </div>
        <div className={"tr-trend" + (data ? "" : " is-loading")} style={{ "--avg": (avg / scale) * 100 + "%" }}>
          {weekMin.map((v, i) => (
            <i key={weeks[i]} className={weeks[i] === thisMonday ? "is-now" : ""} style={{ height: Math.max(3, (v / scale) * 100) + "%" }} title={dayMonth(weeks[i]) + ": " + hhmm(v) + " h"} />
          ))}
        </div>
        <div className="tr-trend-labels">
          {monthTicks.map((t, i) => (
            <span key={weeks[i]}>{t}</span>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="tr-card-head">
          <h3>Race distances</h3>
          <span>longest so far</span>
        </div>
        {ENDURANCE.map((k) => {
          const best = data?.records?.[k]?.km || 0;
          return (
            <div key={k} className="tr-race">
              <span className="tr-emoji" aria-hidden="true">
                {SPORTS[k].emoji}
              </span>
              <div className="tr-race-main">
                <div className="tr-race-top">
                  <b>
                    {SPORTS[k].label} · {best ? km(best) + " km" : "—"}
                  </b>
                  <span>
                    {RACE_KM[k]} km{best ? " · " + Math.min(100, Math.round((best / RACE_KM[k]) * 100)) + "%" : ""}
                  </span>
                </div>
                <div className="tr-track">
                  <i style={{ width: Math.min(100, (best / RACE_KM[k]) * 100) + "%", background: sportColor(k) }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="tr-card-head">
          <h3>Consistency</h3>
          <StreakChip streak={streak} />
        </div>
        <div className="tr-heat-wrap">
          <div className="tr-heat-days" aria-hidden="true">
            {WD.map((w, i) => (
              <span key={w}>{i % 2 === 0 ? w[0] : ""}</span>
            ))}
          </div>
          <div className="tr-heat">
            {cells.map((d) => {
              const v = dayMin[d] || 0;
              const cls = d > today ? "is-future" : v >= 45 ? "is-2" : v > 0 ? "is-1" : "";
              return <i key={d} className={cls + (d === today ? " is-today" : "")} title={weekdayOf(d) + " " + dayMonth(d) + (v ? " · " + duration(v) : "")} />;
            })}
          </div>
        </div>
        <div className="tr-heat-foot">
          <span>{(activeDays / 11).toFixed(1)} active days a week</span>
          <span className="tr-heat-key">
            less <i /> <i className="is-1" /> <i className="is-2" /> more
          </span>
        </div>
      </div>
    </>
  );
}

function SportRow({ sport, value, of, unit, pace, children }) {
  const pct = of ? Math.min(100, (value / of) * 100) : 0;
  const met = of && value >= of;
  return (
    <div className="tr-sport">
      <span className="tr-emoji" aria-hidden="true">
        {SPORTS[sport].emoji}
      </span>
      <div className="tr-sport-main">
        <div className="tr-sport-top">
          <b>{SPORTS[sport].label}</b>
          <span className="tr-sport-val">
            {unit ? km(value) : value}
            {of ? <small> / {unit ? km(of) + " " + unit : of}</small> : <small>{unit ? " " + unit : value === 1 ? " session" : " sessions"}</small>}
            {met && <span className="tr-met"> ✓</span>}
          </span>
        </div>
        {of ? (
          <div className="tr-track">
            <i style={{ width: pct + "%", background: sportColor(sport) }} />
            {pace != null && <b style={{ left: pace * 100 + "%" }} />}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function Ring({ sport, value, goal }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const g = Number(goal) || 0;
  const p = g ? Math.min(1, value / g) : 0;
  return (
    <div className="tr-ring-item">
      <div className="tr-ring">
        <svg viewBox="0 0 86 86" aria-hidden="true">
          <circle cx="43" cy="43" r={r} className="tr-ring-track" />
          {g > 0 && <circle cx="43" cy="43" r={r} className="tr-ring-fill" style={{ stroke: sportColor(sport), strokeDasharray: c, strokeDashoffset: c * (1 - p) }} />}
        </svg>
        <div className="tr-ring-val">
          {km(value)}
          <small>{g ? "/ " + km(g) + " km" : "km"}</small>
        </div>
      </div>
      <div className="tr-ring-label">
        {SPORTS[sport].emoji} {SPORTS[sport].label} <span>{g ? Math.round((value / g) * 100) + "%" : "no goal"}</span>
      </div>
    </div>
  );
}

function WorkoutList({ title, workouts, plans, ready, onOpen, isMe, limit, empty }) {
  const [all, setAll] = useState(false);
  const shown = limit && !all ? workouts.slice(0, limit) : workouts;
  return (
    <div className="card">
      <div className="tr-card-head">
        <h3>{title}</h3>
        <span>{ready ? workouts.length : ""}</span>
      </div>
      {ready && workouts.length === 0 && <div className="tr-empty">{empty}</div>}
      {shown.map((w) => {
        const pace = paceOf(w);
        const feel = FEELS.find((f) => f.v === w.feel);
        const meta = [weekdayOf(w.date) + " " + Number(w.date.slice(8)), pace, w.avgHr ? "♥ " + w.avgHr : null, feel ? "felt " + feel.e : null].filter(Boolean).join(" · ");
        const inner = (
          <>
            <span className="tr-act-icon" style={{ "--c": sportColor(w.sport) }} aria-hidden="true">
              {SPORTS[w.sport]?.emoji || SPORTS.other.emoji}
            </span>
            <span className="tr-act-main">
              <span className="tr-act-title">
                <span className="tr-act-name">{w.name || SPORTS[w.sport]?.label || "Workout"}</span>
                {w.source === "strava" && <span className="tr-pill is-strava">Strava</span>}
                {matchesPlan(w, plans) && <span className="tr-pill is-plan">✓ Plan</span>}
              </span>
              <span className="tr-act-meta">{meta}</span>
            </span>
            <span className="tr-act-nums">
              <b>{w.distanceKm ? km(w.distanceKm) + " km" : w.minutes ? duration(w.minutes) : "—"}</b>
              <span>{w.distanceKm && w.minutes ? duration(w.minutes) : " "}</span>
            </span>
          </>
        );
        if (w.source === "strava") {
          return (
            <a key={w.id} className="tr-act" href={"https://www.strava.com/activities/" + w.stravaId} target="_blank" rel="noreferrer">
              {inner}
            </a>
          );
        }
        return isMe ? (
          <button key={w.id} type="button" className="tr-act" onClick={() => onOpen(w)}>
            {inner}
          </button>
        ) : (
          <div key={w.id} className="tr-act">
            {inner}
          </div>
        );
      })}
      {limit && workouts.length > limit && (
        <button type="button" className="tr-more" onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : "Show " + (workouts.length - limit) + " more"}
        </button>
      )}
    </div>
  );
}

function LogSheet({ today, workout, todaysPlans, onClose, onSaved }) {
  const editing = !!workout;
  const [form, setForm] = useState(() => ({
    sessionDate: workout?.date || today,
    activityType: workout?.sport || "run",
    durationMin: workout?.minutes != null ? String(workout.minutes) : "",
    distanceKm: workout?.distanceKm != null ? String(workout.distanceKm) : "",
    feel: workout?.feel || null,
    notes: workout?.name || ""
  }));
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function usePlan(p) {
    let sport = sportOf(p.activity);
    if (sport === "brick") sport = "bike";
    if (!LOG_SPORTS.includes(sport)) sport = "other";
    const dist = distancesOf(p.activity);
    const total = ENDURANCE.includes(sport) ? dist[sport] : 0;
    setForm((f) => ({ ...f, activityType: sport, distanceKm: total ? String(total) : f.distanceKm, notes: p.activity }));
  }

  async function send(method, body, url = "/api/training-sessions") {
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
    if (form.distanceKm === "" && form.durationMin === "") return setError("Add a time or a distance.");
    if (editing) send("PATCH", { id: workout.sessionId, ...form });
    else send("POST", form);
  }

  return (
    <Modal title={editing ? "Edit workout" : "Log a workout"} onClose={onClose}>
      <form className="tr-sheet" onSubmit={save}>
        {!editing && form.sessionDate === today && todaysPlans.length > 0 && (
          <div className="tr-sheet-plans">
            <span>From your plan</span>
            {todaysPlans.map((p) => (
              <button type="button" key={p.id} className="tr-sheet-plan" onClick={() => usePlan(p)}>
                {SPORTS[sportOf(p.activity)].emoji} {p.activity}
              </button>
            ))}
          </div>
        )}

        <div className="tr-sheet-label">What</div>
        <div className="plan-chips">
          {LOG_SPORTS.map((k) => (
            <button type="button" key={k} className={"plan-chip" + (form.activityType === k ? " is-on" : "")} onClick={() => set("activityType", k)}>
              {SPORTS[k].emoji} {SPORTS[k].label}
            </button>
          ))}
        </div>

        <div className="tr-sheet-grid">
          <label>
            <span className="tr-sheet-label">Time</span>
            <span className="tr-unit-input">
              <input type="number" inputMode="numeric" min="0" value={form.durationMin} onChange={(e) => set("durationMin", e.target.value)} placeholder="45" />
              <em>min</em>
            </span>
          </label>
          <label>
            <span className="tr-sheet-label">Distance</span>
            <span className="tr-unit-input">
              <input type="number" inputMode="decimal" min="0" step="any" value={form.distanceKm} onChange={(e) => set("distanceKm", e.target.value)} placeholder="–" />
              <em>km</em>
            </span>
          </label>
          <label>
            <span className="tr-sheet-label">Date</span>
            <input type="date" value={form.sessionDate} onChange={(e) => set("sessionDate", e.target.value)} />
          </label>
        </div>

        <div className="tr-sheet-label">How did it feel?</div>
        <div className="tr-feel">
          {FEELS.map((f) => (
            <button type="button" key={f.v} className={form.feel === f.v ? "is-on" : ""} onClick={() => set("feel", form.feel === f.v ? null : f.v)} aria-label={f.label} aria-pressed={form.feel === f.v}>
              <span aria-hidden="true">{f.e}</span>
              <small>{f.label}</small>
            </button>
          ))}
        </div>

        <label>
          <span className="tr-sheet-label">Note</span>
          <input type="text" value={form.notes} maxLength={120} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Legs + core" />
        </label>

        {error && <div className="error">{error}</div>}

        <div className="form-actions">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save" : "Log it"}
          </button>
          {editing &&
            (confirmDelete ? (
              <button type="button" className="danger" disabled={busy} onClick={() => send("DELETE", null, "/api/training-sessions?id=" + encodeURIComponent(workout.sessionId))}>
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

function WeightSheet({ month, current, onClose, onSaved }) {
  const [kg, setKg] = useState(current != null ? String(Math.round(current)) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [y, m] = month.split("-").map(Number);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, weightMovedKg: kg })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save.");
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={"Weight moved · " + MONTHS_LONG[m - 1] + " " + y} onClose={onClose}>
      <form className="tr-sheet" onSubmit={save}>
        <label>
          <span className="tr-sheet-label">Total for the month</span>
          <span className="tr-unit-input">
            <input type="number" inputMode="numeric" min="0" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="e.g. 24000" autoFocus />
            <em>kg</em>
          </span>
        </label>
        <p className="tr-note">Everything you lifted this month added up (sets × reps × kg) — your gym app usually shows it.</p>
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
