import "./globals.css";
import { THEME_BG, NIGHT_THEME_KEYS, THEME_KEY } from "../lib/theme";
import VersionWatcher from "./VersionWatcher";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import OfflineBanner from "./OfflineBanner";
import { cookies } from "next/headers";
import { ICON_COOKIE, iconKey, iconPath } from "../lib/appIcons";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page draw under the notch/status bar and home indicator — paired
  // with the env(safe-area-inset-*) padding in globals.css so real content
  // never actually sits under them. Without this, env() just returns 0 and
  // the app looks letterboxed instead of edge-to-edge like a native app.
  viewportFit: "cover",
  // Android Chrome: shrinks the layout viewport when the keyboard opens
  // instead of covering content, so 100dvh + bottom-pinned inputs react the
  // same way they already do on iOS.
  interactiveWidget: "resizes-content"
};

export const metadata = {
  title: "Nutriscore",
  description: "Shared nutrition and training tracker for Martin and Laura.",
  appleWebApp: {
    // Makes "Add to Home Screen" launch as a real standalone app (no Safari
    // chrome) instead of just a bookmarked tab — this is what the
    // auto-update check in VersionWatcher.js has been built for all along.
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nutriscore"
  },
  other: {
    "mobile-web-app-capable": "yes"
  }
};

// Runs before first paint: reads the saved colour scheme, resolves it
// ("follow the device" picks the bright or night scheme from
// prefers-color-scheme), sets data-theme on <html> and paints a matching
// <meta name="theme-color"> so the status bar / task switcher matches.
// Plain ES5 in a string, so it can't import lib/theme.js — the colours and
// keys are injected from it below, but normalize/resolve are mirrored by
// hand: keep them in step with normalizeTheme()/resolveTheme() there.
const THEME_COLOR_SNIPPET = `
(function(){
  var BG = ${JSON.stringify(THEME_BG)};
  var NIGHT = ${JSON.stringify(NIGHT_THEME_KEYS)};
  function isNightKey(k){ return NIGHT.indexOf(k) !== -1; }
  function norm(t){
    t = t && typeof t === "object" ? t : {};
    var day = BG[t.day] && !isNightKey(t.day) ? t.day : "light";
    var night = isNightKey(t.night) ? t.night : "dark";
    var mode = t.mode === "day" || t.mode === "night" ? t.mode : null;
    if (t.mode === "light") mode = "day";
    if (t.mode === "dark" || t.mode === "green") mode = "night";
    return { mode: mode, day: day, night: night };
  }
  function deviceIsDark(){
    try { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); } catch (e) { return false; }
  }
  function applyThemeColor(key){
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", BG[key] || BG.light);
  }
  window.__nutriscoreApplyThemeColor = applyThemeColor;
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(${JSON.stringify(THEME_KEY)}) || "null"); } catch (e) {}
  var t = norm(saved);
  var key = (t.mode === "night" || (t.mode === null && deviceIsDark())) ? t.night : t.day;
  document.documentElement.setAttribute("data-theme", key);
  applyThemeColor(key);
})();
`;

export default function RootLayout({ children }) {
  // The app icon colour is a per-device choice (Colour panel), kept in a
  // cookie so these links are right in the very first HTML — iPhone reads
  // apple-touch-icon only when you "Add to Home Screen".
  const icon = iconKey(cookies().get(ICON_COOKIE)?.value);
  return (
    <html lang="en">
      <head>
        {/* Applies the saved colour scheme (and the matching status
            bar / theme-color) before first paint, so the page never flashes the
            wrong theme on load. DashboardClient re-runs applyThemeColor whenever
            the person changes theme at runtime, or the device's own light/dark
            setting changes while "match device" is selected. */}
        {/* No static <meta name="theme-color"> tag here on purpose — the script
            above creates the one and only instance, so there's never a second,
            stale tag competing with it. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_COLOR_SNIPPET }} />
        <link rel="icon" type="image/png" sizes="32x32" href={iconPath(icon, 32)} />
        <link rel="apple-touch-icon" sizes="180x180" href={iconPath(icon, 180)} />
        <link rel="manifest" href={"/api/manifest?icon=" + icon} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Public+Sans:wght@400;500;600;700&family=Caveat:wght@600;700&display=swap"
        />
      </head>
      <body>
        <VersionWatcher />
        <ServiceWorkerRegister />
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
