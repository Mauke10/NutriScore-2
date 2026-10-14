// Each person's accent when they haven't picked one in the Colour panel.
// Keep in sync with --series-martin / --series-laura in globals.css.
export const DEFAULT_COLOR = { martin: "#7c3aed", laura: "#db2777" };

export function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

// "Day ends at" (drawer → Settings): food logged before this hour still
// counts for the day before, so a 01:00 snack after a late session lands on
// the evening it belongs to. 0 = midnight, the default. Set from the signed-in
// person's settings (setDayEndHour) and cached on the device so the first
// render already uses it. Everything that asks "what day is it" for food goes
// through foodNow() below.
const DAY_END_KEY = "nutriscore-day-end-hour";
let dayEndHour = 0;
try {
  if (typeof window !== "undefined") dayEndHour = Math.min(4, Math.max(0, Number(localStorage.getItem(DAY_END_KEY)) || 0));
} catch {
  // storage blocked — midnight it is
}

export function setDayEndHour(h) {
  dayEndHour = Math.min(4, Math.max(0, Number(h) || 0));
  try {
    localStorage.setItem(DAY_END_KEY, String(dayEndHour));
  } catch {
    // ignore
  }
}

export function getDayEndHour() {
  return dayEndHour;
}

// "Now", shifted back by the day-end hour: at 01:30 with day end 03:00 this
// is still yesterday evening as far as dates go.
function foodNow() {
  return new Date(Date.now() - dayEndHour * 3600 * 1000);
}

export function todayStr() {
  return localDateStr(foodNow());
}

// YYYY-MM-DD for n days before today, local time (see CLAUDE.md on dates).
export function dateDaysAgo(n) {
  const d = foodNow();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

// How many past days the food tab's day view reaches back (today + 6).
export const DAY_VIEW_DAYS = 7;

// Name for the day the food tab is showing, n days back: "Today",
// "Yesterday", then the weekday ("Sunday") — unique within the 7-day window.
// Used by the bottom nav tab, the mobile page title and the card heading.
export function dayViewLabel(n) {
  if (n === 0) return "Today";
  if (n === 1) return "Yesterday";
  const [yr, mo, da] = dateDaysAgo(n).split("-").map(Number);
  return new Date(yr, mo - 1, da).toLocaleDateString("en-GB", { weekday: "long" });
}

// "Today" / "Yesterday" / "7 Oct" for a YYYY-MM-DD date — short enough to sit
// on a log card's meta line. Parsed as a local date (never via toISOString,
// see CLAUDE.md), so "Today" flips at local midnight.
export function shortDateLabel(ymd) {
  if (!ymd) return "";
  if (ymd === todayStr()) return "Today";
  if (ymd === dateDaysAgo(1)) return "Yesterday";
  return dayMonthLabel(ymd);
}

// "7 Oct" (or "7 Oct 2025" outside the current year) for a YYYY-MM-DD date,
// parsed as a local date.
export function dayMonthLabel(ymd) {
  if (!ymd) return "";
  const [yr, mo, da] = ymd.split("-").map(Number);
  const d = new Date(yr, mo - 1, da);
  const sameYear = yr === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

// Monday of the week before/after a YYYY-MM-DD Monday.
export function shiftWeek(ymd, weeks) {
  const [yr, mo, da] = ymd.split("-").map(Number);
  return localDateStr(new Date(yr, mo - 1, da + 7 * weeks));
}

export function mondayOf(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return localDateStr(date);
}

export function currentMonthStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

export function numOrEmpty(v) {
  return v === null || v === undefined ? "" : v;
}

export const PEOPLE = [
  { key: "martin", name: "Martin", seriesVar: "--series-martin" },
  { key: "laura", name: "Laura", seriesVar: "--series-laura" }
];

export function otherOf(key) {
  return key === "martin" ? "laura" : "martin";
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(monthStr) {
  const [, m] = monthStr.split("-").map(Number);
  return MONTH_ABBR[(m || 1) - 1] || monthStr;
}

// Consecutive days (ending yesterday or today) where logged protein hit the
// target. Today is only required to have been met if it's already been
// logged and still falls short — if nothing's logged yet today, that
// shouldn't erase a streak built over the preceding days, since the day
// isn't over. Returns null when there's no protein target set (nothing to
// measure against), otherwise a count that can be 0.
export function proteinStreak(snacks, proteinTarget) {
  if (proteinTarget == null || !(Number(proteinTarget) > 0)) return null;
  const target = Number(proteinTarget);
  const totals = {};
  for (const s of snacks || []) {
    if (!s.log_date) continue;
    totals[s.log_date] = (totals[s.log_date] || 0) + (Number(s.protein_g) || 0);
  }

  const d = foodNow();
  const todayKey = localDateStr(d);
  if (!(totals[todayKey] != null && totals[todayKey] >= target)) {
    // Today doesn't count yet (not logged, or logged but short) — start
    // counting from yesterday instead of letting an unfinished day break it.
    d.setDate(d.getDate() - 1);
  }

  let streak = 0;
  for (let guard = 0; guard < 365; guard++) {
    const key = localDateStr(d);
    const total = totals[key];
    if (total != null && total >= target) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
