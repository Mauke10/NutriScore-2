import "./globals.css";
import VersionWatcher from "./VersionWatcher";

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

// Resolves the page background for a given theme choice the same way
// globals.css does, so the status bar / task-switcher chrome always matches
// what's actually on screen. `mode` is null for "match device".
const THEME_COLOR_SNIPPET = `
(function(){
  function resolveBg(mode){
    if (mode === "dark") return "#0d0d0d";
    if (mode === "green") return "#143723";
    if (mode === "light") return "#f9f9f7";
    try {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "#0d0d0d" : "#f9f9f7";
    } catch (e) {
      return "#f9f9f7";
    }
  }
  function applyThemeColor(mode){
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", resolveBg(mode));
  }
  window.__nutriscoreApplyThemeColor = applyThemeColor;
  var savedMode = null;
  try {
    var t = JSON.parse(localStorage.getItem("nutriscore-theme") || "null");
    if (t && t.mode) { savedMode = t.mode; document.documentElement.setAttribute("data-theme", t.mode); }
  } catch (e) {}
  applyThemeColor(savedMode);
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Applies any saved bright/night/forest choice (and the matching status
            bar / theme-color) before first paint, so the page never flashes the
            wrong theme on load. DashboardClient re-runs applyThemeColor whenever
            the person changes theme at runtime, or the device's own light/dark
            setting changes while "match device" is selected. */}
        {/* No static <meta name="theme-color"> tag here on purpose — the script
            above creates the one and only instance, so there's never a second,
            stale tag competing with it. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_COLOR_SNIPPET }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Public+Sans:wght@400;500;600;700&family=Caveat:wght@600;700&display=swap"
        />
      </head>
      <body>
        <VersionWatcher />
        {children}
      </body>
    </html>
  );
}
