// Colour schemes, shared by the pre-paint script in app/layout.js, the
// Colour panel and DashboardClient so they can't drift. The colours
// themselves live in globals.css under :root[data-theme="<key>"] ("light" is
// the plain :root defaults). `bg` must match that block's --page: it's what
// the phone's status bar / task switcher gets painted.
//
// A saved choice is { mode, day, night }:
//   mode  "day" | "night" | null (null = follow the device's light/dark setting)
//   day   which bright scheme to use, night which night scheme.
export const DAY_THEMES = [
  { key: "light", label: "Classic", bg: "#f9f9f7", swatch: ["#f9f9f7", "#ffffff"] },
  { key: "sand", label: "Sand", bg: "#f4efe5", swatch: ["#f4efe5", "#fffdf8"] },
  { key: "nordic", label: "Nordic", bg: "#f2f5f7", swatch: ["#f2f5f7", "#ffffff"] },
  { key: "blush", label: "Blush", bg: "#fbf0f2", swatch: ["#fbf0f2", "#ffffff"] }
];
export const NIGHT_THEMES = [
  { key: "dark", label: "Classic", bg: "#0d0d0d", swatch: ["#0d0d0d", "#202020"] },
  { key: "midnight", label: "Midnight", bg: "#0b1020", swatch: ["#0b1020", "#182238"] },
  { key: "ember", label: "Ember", bg: "#14100d", swatch: ["#14100d", "#251f1a"] }
];

export const THEME_KEY = "nutriscore-theme";
export const DEFAULT_THEME = { mode: null, day: "light", night: "dark" };

const DAY_KEYS = DAY_THEMES.map((t) => t.key);
const NIGHT_KEYS = NIGHT_THEMES.map((t) => t.key);

// Accepts anything that might be in localStorage — including the old
// { mode: "light" | "dark" | "green" | null, night } shape from before the
// scheme picker (Forest/"green" was retired; it falls back to night Classic).
export function normalizeTheme(raw) {
  const t = raw && typeof raw === "object" ? raw : {};
  const day = DAY_KEYS.includes(t.day) ? t.day : "light";
  const night = NIGHT_KEYS.includes(t.night) ? t.night : "dark";
  let mode = t.mode === "day" || t.mode === "night" ? t.mode : null;
  if (t.mode === "light") mode = "day";
  if (t.mode === "dark" || t.mode === "green") mode = "night";
  return { mode, day, night };
}

// The data-theme key to put on <html> right now.
export function resolveTheme(theme, deviceIsDark) {
  const t = normalizeTheme(theme);
  const night = t.mode === "night" || (t.mode === null && deviceIsDark);
  return night ? t.night : t.day;
}

export const THEME_BG = Object.fromEntries([...DAY_THEMES, ...NIGHT_THEMES].map((t) => [t.key, t.bg]));
export const NIGHT_THEME_KEYS = NIGHT_KEYS;
