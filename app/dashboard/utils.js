export function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

export function todayStr() {
  return localDateStr(new Date());
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

  const d = new Date();
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
