// The Stride N app icon: an N in three strokes, the second upright a step
// ahead, with an extruded shadow and speed lines. 200×200, full bleed (the
// phone rounds the corners). Keep the scheme keys in sync with lib/appIcons.js.

export const SCHEMES = {
  duo: { bg: "#141325", bg2: "#2b2560", a: "#a78bfa", a2: "#6d28d9", b: "#f9a8d4", b2: "#db2777", line: "#ffffff" },
  bay: { bg: "#072a40", bg2: "#0f5a74", a: "#5eead4", a2: "#0d9488", b: "#7dd3fc", b2: "#0284c7", line: "#f0fdfa" },
  sunrise: { bg: "#2e0f3a", bg2: "#7a1d4f", a: "#fdba74", a2: "#ea580c", b: "#fda4af", b2: "#e11d48", line: "#fff7ed" },
  nordic: { bg: "#f4f7fb", bg2: "#d3e0ef", a: "#60a5fa", a2: "#1d4ed8", b: "#fb923c", b2: "#ea580c", line: "#0f2a4a" },
  gold: { bg: "#0b0b0d", bg2: "#26262d", a: "#fde68a", a2: "#c08a1e", b: "#e5e7eb", b2: "#8b8f98", line: "#ffffff" }
};

// maskable: Android may crop the icon to a circle — the artwork is shrunk to
// the central 80% safe zone and the background runs to the edges.
export function strideSvg(key, { maskable = false } = {}) {
  const s = SCHEMES[key];
  const art = `
    <g stroke-linecap="round" stroke="${s.line}"><path d="M18 78 H44" stroke-width="7" stroke-opacity=".55"/><path d="M10 104 H40" stroke-width="7" stroke-opacity=".35"/><path d="M22 130 H42" stroke-width="7" stroke-opacity=".2"/></g>
    <g stroke="#000" stroke-opacity=".28" stroke-width="30" stroke-linecap="round" transform="translate(6 8)"><path d="M62 156 V70"/><path d="M146 146 V58"/><path d="M62 70 L146 146"/></g>
    <rect x="47" y="55" width="30" height="116" rx="15" fill="url(#a)"/>
    <rect x="131" y="43" width="30" height="118" rx="15" fill="url(#b)"/>
    <path d="M62 70 L146 146" stroke="${s.line}" stroke-width="30" stroke-linecap="round"/>
    <path d="M56 84 V140" stroke="#fff" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>
    <path d="M140 72 V128" stroke="#fff" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <radialGradient id="bg" cx="70%" cy="20%" r="95%"><stop offset="0" stop-color="${s.bg2}"/><stop offset="1" stop-color="${s.bg}"/></radialGradient>
    <linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.a}"/><stop offset="1" stop-color="${s.a2}"/></linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.b}"/><stop offset="1" stop-color="${s.b2}"/></linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#bg)"/>
  ${maskable ? `<g transform="translate(20 20) scale(.8)">${art}</g>` : art}
</svg>`;
}
