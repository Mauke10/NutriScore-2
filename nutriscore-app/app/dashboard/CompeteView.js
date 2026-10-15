"use client";

import { useEffect, useState } from "react";
import Whiteboard from "./Whiteboard";
import { PEOPLE, localDateStr, mondayOf, proteinStreak, shiftWeek } from "./utils";
import { SPORTS, estimateMinutes, sportOf, sessionTypesFor, workoutMinutes } from "../../lib/trainingSports";

// The Compete tab. Everything is scored from what the app already records —
// workouts (Strava + hand-logged, via /api/training-feed), Calendar plans and
// food logs — so there's nothing extra to fill in:
//   1. the week's score (categories won each), with the season under it
//   2. a team ring: both people's hours this week against what's planned
//   3. the head-to-head, category by category
//   4. a trophy shelf of all-time bests
//   5. the morning notes
// A category only scores when both sides have a number; equal is a tie.
// The season is the last 11 finished weeks that had any data at all.
// Dates come from the browser clock, so it renders after mount (see
// TrainingPlanCalendar for why).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ON_TRACK = 3; // workouts in a week

function parse(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(ymd, n) {
  const d = parse(ymd);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}
function hhmm(min) {
  const m = Math.round(min || 0);
  return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
}
function dayMonth(ymd) {
  return Number(ymd.slice(8)) + " " + MONTHS[Number(ymd.slice(5, 7)) - 1];
}
function km(n) {
  const v = Number(n) || 0;
  return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString("en-GB");
}

const CATS = [
  { key: "time", label: "Training", emoji: "⏱️", fmt: (s) => hhmm(s.time) },
  { key: "workouts", label: "Workouts", emoji: "🏋️", fmt: (s) => String(s.workouts) },
  { key: "plan", label: "Plan done", emoji: "✅", fmt: (s) => (s.plan == null ? "—" : Math.round(s.plan * 100) + "%") },
  { key: "protein", label: "Protein days", emoji: "🥩", fmt: (s) => (s.protein == null ? "—" : s.protein + "/" + s.days) },
  { key: "calories", label: "Calories on target", emoji: "🎯", fmt: (s) => (s.calories == null ? "—" : s.calories + "/" + s.days) },
  { key: "logged", label: "Days logged", emoji: "📝", fmt: (s) => s.logged + "/" + s.days }
];

// One person's numbers for monday..lastDay (inclusive).
function statsFor({ feed, snacks, calorieTarget, proteinTarget }, monday, lastDay) {
  const inRange = (d) => d >= monday && d <= lastDay;
  const workouts = (feed?.workouts || []).filter((w) => inRange(w.date));
  const plans = (feed?.plans || []).filter((p) => inRange(p.plan_date));
  const done = plans.filter(
    (p) => p.done || workouts.some((w) => w.date === p.plan_date && sessionTypesFor(sportOf(p.activity)).includes(w.sport))
  ).length;

  const food = {};
  for (const s of snacks || []) {
    if (!s.log_date || !inRange(s.log_date)) continue;
    const f = (food[s.log_date] = food[s.log_date] || { kcal: 0, protein: 0 });
    f.kcal += Number(s.calories) || 0;
    f.protein += Number(s.protein_g) || 0;
  }
  const loggedDays = Object.values(food);
  const cal = Number(calorieTarget) || 0;
  const pro = Number(proteinTarget) || 0;
  const days = Math.round((parse(lastDay) - parse(monday)) / 86400000) + 1;

  return {
    days,
    time: workouts.reduce((s, w) => s + workoutMinutes(w), 0),
    workouts: workouts.length,
    plan: plans.length ? done / plans.length : null,
    protein: pro ? loggedDays.filter((f) => f.protein >= pro).length : null,
    calories: cal ? loggedDays.filter((f) => Math.abs(f.kcal - cal) <= cal * 0.1).length : null,
    logged: loggedDays.length,
    any: workouts.length > 0 || loggedDays.length > 0
  };
}

// "martin" | "laura" | "tie" | null (can't be compared)
function winnerOf(cat, m, l) {
  const a = m[cat.key];
  const b = l[cat.key];
  if (a == null || b == null) return null;
  if (a === b) return "tie";
  return a > b ? "martin" : "laura";
}

function scoreOf(m, l) {
  const rows = CATS.map((cat) => ({ cat, winner: winnerOf(cat, m, l) }));
  return {
    rows,
    martin: rows.filter((r) => r.winner === "martin").length,
    laura: rows.filter((r) => r.winner === "laura").length
  };
}

export default function CompeteView(props) {
  const [today, setToday] = useState(null);
  useEffect(() => setToday(localDateStr(new Date())), []);
  if (!today) return <div className="cp" />;
  return <Compete {...props} today={today} />;
}

function Compete({ me, martin, laura, raceDate, today }) {
  const thisMonday = mondayOf(parse(today));
  const from = shiftWeek(thisMonday, -11);
  const to = addDays(thisMonday, 6);
  const [feeds, setFeeds] = useState({ martin: null, laura: null });

  // Re-read when either person's own data changes (a workout logged, a sync).
  const version = [martin.sessions, laura.sessions, martin.training, laura.training];
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      PEOPLE.map((p) =>
        fetch("/api/training-feed?person=" + p.key + "&from=" + from + "&to=" + to + "&records=1")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then(([m, l]) => !cancelled && setFeeds({ martin: m, laura: l }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, version);

  const person = {
    martin: { feed: feeds.martin, snacks: martin.snacks, calorieTarget: martin.calorieTarget, proteinTarget: martin.proteinTarget },
    laura: { feed: feeds.laura, snacks: laura.snacks, calorieTarget: laura.calorieTarget, proteinTarget: laura.proteinTarget }
  };
  const ready = feeds.martin && feeds.laura;

  // This week so far.
  const lastDay = today < to ? today : to;
  const mWeek = statsFor(person.martin, thisMonday, lastDay);
  const lWeek = statsFor(person.laura, thisMonday, lastDay);
  const week = scoreOf(mWeek, lWeek);
  const daysLeft = Math.round((parse(to) - parse(today)) / 86400000);

  // Season: the 11 finished weeks before this one, skipping empty ones.
  const season = { martin: 0, laura: 0, ties: 0 };
  for (let i = 0; i < 11; i++) {
    const mon = shiftWeek(from, i);
    const sun = addDays(mon, 6);
    const m = statsFor(person.martin, mon, sun);
    const l = statsFor(person.laura, mon, sun);
    if (!m.any && !l.any) continue;
    const s = scoreOf(m, l);
    if (s.martin > s.laura) season.martin += 1;
    else if (s.laura > s.martin) season.laura += 1;
    else season.ties += 1;
  }

  return (
    <div className="cp">
      <Banner week={week} season={season} daysLeft={daysLeft} ready={ready} />
      <TeamCard person={person} thisMonday={thisMonday} today={today} mWeek={mWeek} lWeek={lWeek} raceDate={raceDate} ready={ready} />
      <HeadToHead week={week} mWeek={mWeek} lWeek={lWeek} season={season} ready={ready} />
      <TrophyShelf feeds={feeds} martin={martin} laura={laura} ready={ready} />
      <Whiteboard me={me} />
    </div>
  );
}

function Avatar({ id, small }) {
  const p = PEOPLE.find((x) => x.key === id);
  return (
    <span className={"cp-av" + (small ? " is-sm" : "")} style={{ background: "var(" + p.seriesVar + ")" }} aria-hidden="true">
      {p.name[0]}
    </span>
  );
}

function Banner({ week, season, daysLeft, ready }) {
  const played = season.martin + season.laura + season.ties;
  return (
    <div className={"cp-banner" + (ready ? "" : " is-loading")}>
      <Avatar id="martin" />
      <span className="cp-banner-n" style={{ color: "var(--series-martin)" }}>
        {week.martin}
      </span>
      <div className="cp-banner-mid">
        <b>This week</b>
        <span>
          {daysLeft === 0 ? "last day" : daysLeft + (daysLeft === 1 ? " day" : " days") + " left"}
          {played > 0 && " · season " + season.martin + "–" + season.laura}
        </span>
      </div>
      <span className="cp-banner-n" style={{ color: "var(--series-laura)" }}>
        {week.laura}
      </span>
      <Avatar id="laura" />
    </div>
  );
}

function TeamCard({ person, thisMonday, today, mWeek, lWeek, raceDate, ready }) {
  const sunday = addDays(thisMonday, 6);
  // Target: every session both of you planned this week (estimated minutes);
  // with nothing planned, last week's combined hours are the bar to beat.
  const planned = ["martin", "laura"].reduce(
    (s, k) => s + (person[k].feed?.plans || []).filter((p) => p.plan_date >= thisMonday && p.plan_date <= sunday).reduce((t, p) => t + estimateMinutes(p.activity), 0),
    0
  );
  const lastMon = shiftWeek(thisMonday, -1);
  const lastWeek = statsFor(person.martin, lastMon, addDays(lastMon, 6)).time + statsFor(person.laura, lastMon, addDays(lastMon, 6)).time;
  const target = planned || lastWeek;
  const combined = mWeek.time + lWeek.time;

  const r = 50;
  const c = 2 * Math.PI * r;
  const scale = Math.max(target, combined, 1);
  const mFrac = mWeek.time / scale;
  const lFrac = lWeek.time / scale;

  // Weeks in a row where you both got ON_TRACK+ workouts in.
  const bothOnTrack = (mon) => {
    const sun = addDays(mon, 6);
    return statsFor(person.martin, mon, sun).workouts >= ON_TRACK && statsFor(person.laura, mon, sun).workouts >= ON_TRACK;
  };
  let mon = bothOnTrack(thisMonday) ? thisMonday : lastMon;
  let streak = 0;
  while (streak < 11 && bothOnTrack(mon)) {
    streak += 1;
    mon = shiftWeek(mon, -1);
  }

  let weeksToRace = null;
  if (raceDate && raceDate >= today) weeksToRace = Math.floor((parse(raceDate) - parse(today)) / (7 * 86400000));

  return (
    <div className="card cp-team">
      <div className="cp-card-head">
        <h3>Team week</h3>
        {weeksToRace !== null && <span className="cp-chip">🏁 {weeksToRace} wks to race</span>}
      </div>
      <div className={"cp-team-body" + (ready ? "" : " is-loading")}>
        <div className="cp-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r={r} className="cp-ring-track" />
            {mFrac > 0 && <circle cx="60" cy="60" r={r} className="cp-ring-arc" style={{ stroke: "var(--series-martin)", strokeDasharray: mFrac * c + " " + c }} />}
            {lFrac > 0 && (
              <circle cx="60" cy="60" r={r} className="cp-ring-arc" style={{ stroke: "var(--series-laura)", strokeDasharray: lFrac * c + " " + c, transform: "rotate(" + mFrac * 360 + "deg)", transformOrigin: "60px 60px" }} />
            )}
          </svg>
          <div className="cp-ring-val">
            <b>{hhmm(combined)}</b>
            <small>{target ? (planned ? "of " + hhmm(target) + " h planned" : "last week " + hhmm(target) + " h") : "hours together"}</small>
          </div>
        </div>
        <div className="cp-team-list">
          <div>
            <i style={{ background: "var(--series-martin)" }} />
            Martin<b>{hhmm(mWeek.time)}</b>
          </div>
          <div>
            <i style={{ background: "var(--series-laura)" }} />
            Laura<b>{hhmm(lWeek.time)}</b>
          </div>
          {target > 0 && (
            <div>
              <i style={{ background: "var(--gridline)" }} />
              {combined >= target ? "Done!" : planned ? "To go" : "To beat it"}
              <b>{combined >= target ? "✓" : hhmm(target - combined)}</b>
            </div>
          )}
          <p className="cp-team-note">
            {streak > 0
              ? "🔥 Both on track " + streak + (streak === 1 ? " week" : " weeks") + " running"
              : target
                ? "Both get " + ON_TRACK + "+ workouts in to start a streak"
                : "Plan your week on the Calendar to set a team target"}
          </p>
        </div>
      </div>
    </div>
  );
}

function HeadToHead({ week, mWeek, lWeek, season, ready }) {
  return (
    <div className="card">
      <div className="cp-card-head">
        <h3>Head-to-head</h3>
        <span className="cp-meta">
          <b style={{ color: "var(--series-martin)" }}>{week.martin}</b>–<b style={{ color: "var(--series-laura)" }}>{week.laura}</b>
          {season.martin + season.laura + season.ties > 0 && " · season " + season.martin + "–" + season.laura}
        </span>
      </div>
      <div className={"cp-h2h" + (ready ? "" : " is-loading")}>
        <span />
        <span className="cp-h2h-name" style={{ color: "var(--series-martin)" }}>
          Martin
        </span>
        <span className="cp-h2h-name" style={{ color: "var(--series-laura)" }}>
          Laura
        </span>
        <span className="cp-h2h-sep" />
        {week.rows.map(({ cat, winner }) => (
          <Row key={cat.key} cat={cat} winner={winner} m={mWeek} l={lWeek} />
        ))}
      </div>
      <p className="cp-foot">Each category won is a point · ties and missing numbers score nothing</p>
    </div>
  );
}

function Row({ cat, winner, m, l }) {
  const cls = (id) => "cp-h2h-v" + (winner === id ? " is-win" : winner && winner !== "tie" ? " is-lose" : "");
  return (
    <>
      <span className="cp-h2h-label">
        <span aria-hidden="true">{cat.emoji}</span> {cat.label}
      </span>
      <span className={cls("martin")} style={{ "--c": "var(--series-martin)" }}>
        {cat.fmt(m)}
      </span>
      <span className={cls("laura")} style={{ "--c": "var(--series-laura)" }}>
        {cat.fmt(l)}
      </span>
    </>
  );
}

function TrophyShelf({ feeds, martin, laura, ready }) {
  const trophies = [];
  for (const [sport, label] of [
    ["bike", "Longest ride"],
    ["run", "Longest run"],
    ["swim", "Longest swim"]
  ]) {
    const m = feeds.martin?.records?.[sport];
    const l = feeds.laura?.records?.[sport];
    const best = [m && { who: "martin", ...m }, l && { who: "laura", ...l }].filter(Boolean).sort((a, b) => b.km - a.km)[0];
    trophies.push({ key: sport, emoji: SPORTS[sport].emoji, label, who: best?.who, detail: best ? km(best.km) + " km" + (best.date ? " · " + dayMonth(best.date) : "") : "Nobody yet" });
  }
  const ms = proteinStreak(martin.snacks, martin.proteinTarget) || 0;
  const ls = proteinStreak(laura.snacks, laura.proteinTarget) || 0;
  const top = Math.max(ms, ls);
  trophies.push({
    key: "protein",
    emoji: "🔥",
    label: "Protein streak",
    who: top > 0 ? (ms >= ls ? "martin" : "laura") : null,
    tie: top > 0 && ms === ls,
    detail: top > 0 ? top + (top === 1 ? " day" : " days") + " · going now" : "Nobody on a streak"
  });

  return (
    <div className="card">
      <div className="cp-card-head">
        <h3>Trophy shelf</h3>
        <span className="cp-meta">all-time bests</span>
      </div>
      <div className={"cp-trophies" + (ready ? "" : " is-loading")}>
        {trophies.map((t) => (
          <div key={t.key} className="cp-trophy">
            <span className="cp-trophy-emoji" aria-hidden="true">
              {t.emoji}
            </span>
            <span className="cp-trophy-main">
              <b>{t.label}</b>
              <small>{t.detail}</small>
            </span>
            {t.tie ? (
              <span className="cp-trophy-who">
                <Avatar id="martin" small />
                <Avatar id="laura" small />
              </span>
            ) : t.who ? (
              <span className="cp-trophy-who">
                <Avatar id={t.who} small />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
