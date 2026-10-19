// Reads what kind of session a plan line is ("Swim 2km", "Jooks 10k",
// "Brick: bike 50 + run 5") from its text, so nothing about the sport has to
// be stored. English and Estonian words. Used by the Calendar tab and the
// "today" strip; the planning sheet's chips write lines these rules read back.

export const SPORTS = {
  swim: { label: "Swim", emoji: "🏊" },
  bike: { label: "Bike", emoji: "🚴" },
  run: { label: "Run", emoji: "🏃" },
  brick: { label: "Brick", emoji: "🧱" },
  strength: { label: "Strength", emoji: "🏋️" },
  mobility: { label: "Mobility", emoji: "🧘" },
  rest: { label: "Rest", emoji: "😴" },
  other: { label: "Other", emoji: "⏱️" }
};

// Fill colour per sport (CSS custom properties, set per colour scheme in
// globals.css). Brick and rest never show up as a done workout.
export function sportColor(sport) {
  return "var(--sport-" + (["swim", "bike", "run", "strength", "mobility"].includes(sport) ? sport : "other") + ")";
}

// Order of the chips in the planning sheet.
export const SPORT_KEYS = ["swim", "bike", "run", "brick", "strength", "mobility", "rest"];

// Quick amounts per sport in the planning sheet.
export const AMOUNTS = {
  swim: ["1 km", "1.5 km", "2 km", "45 min"],
  bike: ["20 km", "40 km", "60 km", "1 h", "2 h"],
  run: ["5 km", "8 km", "10 km", "15 km", "45 min"],
  brick: ["bike 40 + run 5", "bike 60 + run 10"],
  strength: ["30 min", "45 min", "1 h"],
  mobility: ["15 min", "30 min"],
  rest: []
};

// Word stems, matched at the start of a word. Brick and rest win over
// everything; otherwise the sport mentioned first wins ("Bike 40 + run 5"
// counts as a ride for the emoji, but both legs count towards the totals).
const RULES = [
  ["swim", ["swim", "ujum", "ujuma", "bassein", "pool", "open water", "avavesi"]],
  ["bike", ["bike", "biking", "ride", "riding", "cycl", "ratas", "ratta", "rattas", "spin", "zwift", "trainer"]],
  ["run", ["run", "jook", "jogg", "jog ", "parkrun", "tempo run"]],
  ["strength", ["strength", "gym", "jõu", "joud", "weights", "lift", "core", "kõht"]],
  ["mobility", ["mobility", "yoga", "jooga", "stretch", "venit", "pilates", "foam roll"]]
];
const BRICK = /\bbrick\b|\btelli/i;
const REST = /\b(rest|puhke|puhka|off day|day off|vaba päev)/i;

function norm(text) {
  return " " + (text || "").toLowerCase().replace(/\s+/g, " ") + " ";
}

function firstSport(text) {
  const t = norm(text);
  let best = null;
  let bestAt = Infinity;
  for (const [key, words] of RULES) {
    for (const w of words) {
      const at = t.search(new RegExp("[^\\p{L}]" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
      if (at !== -1 && at < bestAt) {
        best = key;
        bestAt = at;
      }
    }
  }
  return best;
}

// How hard a logged workout was. Run and bike use the five training zones,
// swim a 1–5 RPE, everything else four plain words. The key is what
// training_sessions.effort stores — never rename one.
const ZONES = [
  { key: "z1", short: "Z1", label: "Recovery" },
  { key: "z2", short: "Z2", label: "Base" },
  { key: "z3", short: "Z3", label: "Tempo" },
  { key: "z4", short: "Z4", label: "Threshold" },
  { key: "z5", short: "Z5", label: "VO2 max" }
];
const RPE = [
  { key: "rpe1", short: "1", label: "Very easy" },
  { key: "rpe2", short: "2", label: "Easy" },
  { key: "rpe3", short: "3", label: "Steady" },
  { key: "rpe4", short: "4", label: "Hard" },
  { key: "rpe5", short: "5", label: "All out" }
];
const LEVELS = [
  { key: "light", short: "Light", label: "" },
  { key: "moderate", short: "Moderate", label: "" },
  { key: "hard", short: "Hard", label: "" },
  { key: "max", short: "Max", label: "" }
];
export function effortsFor(sport) {
  if (sport === "run" || sport === "bike") return { title: "Zone", options: ZONES };
  if (sport === "swim") return { title: "Effort (RPE)", options: RPE };
  return { title: "Effort", options: LEVELS };
}
// The key if it belongs to this sport's scale, else null.
export function effortFor(sport, key) {
  return effortsFor(sport).options.some((o) => o.key === key) ? key : null;
}
// "Z2", "RPE 3", "Hard" — for workout lists.
export function effortLabel(sport, key) {
  const o = effortsFor(sport).options.find((x) => x.key === key);
  if (!o) return null;
  return sport === "swim" ? "RPE " + o.short : o.short;
}
// A zone written in a plan ("Z2 jooks 10 km") → "z2".
export function zoneIn(text) {
  const m = /\bz([1-5])\b/i.exec(text || "");
  return m ? "z" + m[1] : null;
}

export function sportOf(text) {
  if (BRICK.test(text || "")) return "brick";
  if (REST.test(text || "")) return "rest";
  return firstSport(text) || "other";
}

// km per sport in one plan line: { swim: 1.5, bike: 0, run: 10 }. Each part
// between "+", ",", "&" or "ja"/"and" is read on its own, so a brick's legs
// land in the right sport. "10k" and "10 km" are km; "1500m" is metres; a
// bare number counts as km, or metres when it's 100 or more. Times
// ("45 min", "1 h") and intervals ("6x800") aren't counted.
export function distancesOf(text) {
  const out = { swim: 0, bike: 0, run: 0 };
  const whole = sportOf(text);
  if (whole === "rest") return out;
  const parts = (text || "").split(/\+|,(?=\s*\p{L})|&|\bja\b|\band\b/iu);
  for (const part of parts) {
    const sport = firstSport(part) || (parts.length === 1 && whole in out ? whole : null);
    if (!sport || !(sport in out)) continue;
    const m = /(?<![\p{L}\d.,])(\d+(?:[.,]\d+)?)\s*(km|k|m|meters?|meetrit)?(?![\p{L}\d])/iu.exec(part
      .replace(/\d+\s*[x×]\s*\d+(?:[.,]\d+)?\s*(km|k|m)?/gi, "") // intervals: "6x800"
      .replace(/\d+(?:[.,]\d+)?\s*(?:minutit|min|hours?|hrs|hr|h|tundi|tund)(?!\p{L})(?:\s*\d{1,2}(?![\d.,]|\s*(?:km|k|m)\b))?/giu, "")); // "45 min", "1 h", "1h30"
    if (!m) continue;
    let n = Number(m[1].replace(",", "."));
    const unit = (m[2] || "").toLowerCase();
    if (unit.startsWith("m") && unit !== "km") n = n / 1000;
    else if (!unit && n >= 100) n = n / 1000; // "Swim 1500", "run 800"
    if (Number.isFinite(n) && n > 0 && n < 1000) out[sport] += n;
  }
  return out;
}

// training_sessions.activity_type for a plan's sport, so a session logged by
// hand on the same day ticks the plan off. Brick counts as done if either leg
// was logged.
export function sessionTypesFor(sport) {
  if (sport === "brick") return ["bike", "run"];
  if (sport === "swim" || sport === "bike" || sport === "run" || sport === "strength" || sport === "mobility") return [sport];
  return [];
}

// Rough minutes for a plan line, for the Training tab's dashed "still planned"
// bars: an explicit time if the text has one ("45 min", "1.5 h", "1h30"),
// otherwise distance at an easy pace (swim 20 min/km, bike 25 km/h, run
// 6 min/km), otherwise a typical session length. Only ever drawn as an
// estimate, never counted as training done.
export function estimateMinutes(text) {
  const t = (text || "").toLowerCase();
  const hm = /(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs|hr|h|tundi|tund)(?!\p{L})(?:\s*(\d{1,2})(?![\d.,]|\s*(?:km|k|m)\b))?/u.exec(t);
  const min = /(\d+)\s*(?:min|minutit)\b/.exec(t);
  if (hm) return Math.round(Number(hm[1].replace(",", ".")) * 60 + (Number(hm[2]) || 0));
  if (min) return Number(min[1]);
  const sport = sportOf(text);
  if (sport === "rest") return 0;
  const d = distancesOf(text);
  const fromKm = d.swim * 20 + d.bike * 2.4 + d.run * 6;
  if (fromKm > 0) return Math.round(fromKm);
  return { brick: 120, strength: 45, mobility: 30 }[sport] || 45;
}

// Minutes for one workout from /api/training-feed: its own time, or an
// estimate from its distance when only that was logged.
export function workoutMinutes(w) {
  if (w.minutes != null) return Number(w.minutes) || 0;
  return w.distanceKm ? estimateMinutes((SPORTS[w.sport]?.label || "") + " " + w.distanceKm + " km") : 0;
}
