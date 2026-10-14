"use client";

import { useEffect, useRef, useState } from "react";

// Pick any person colour: drag around the wheel for hue, in/out for how
// vivid (centre = greyish), and the slider for light/dark. Lightness is kept
// to a middle band so the colour still works as a ring, badge and button
// with white text on it — a warning shows if it gets too pale for that.
const SIZE = 220; // css px
const L_MIN = 30;
const L_MAX = 70;

export default function ColourWheel({ initial, onUse, onCancel, saving }) {
  const [hsl, setHsl] = useState(() => {
    const [h, s, l] = hexToHsl(initial || "#7c3aed");
    return { h, s: Math.max(s, 20), l: Math.min(L_MAX, Math.max(L_MIN, l)) };
  });
  const canvasRef = useRef(null);
  const draggingRef = useRef(false);

  // Redraw the wheel at the current lightness (exact HSL per pixel, so the
  // colour under the thumb is the colour you get).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const n = Math.round(SIZE * dpr);
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(n, n);
    const r = n / 2;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = x - r + 0.5;
        const dy = y - r + 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const i = (y * n + x) * 4;
        if (dist > r) continue;
        const hue = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        const [R, G, B] = hslToRgb((hue + 360) % 360, (dist / r) * 100, hsl.l);
        img.data[i] = R;
        img.data[i + 1] = G;
        img.data[i + 2] = B;
        img.data[i + 3] = dist > r - 1 ? Math.round(255 * (r - dist)) : 255; // soft edge
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [hsl.l]);

  function pickAt(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const radius = rect.width / 2;
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
    const s = Math.min(100, (Math.sqrt(dx * dx + dy * dy) / radius) * 100);
    setHsl((c) => ({ ...c, h: Math.round(h), s: Math.round(s) }));
  }

  const hex = hslToHex(hsl.h, hsl.s, hsl.l);
  const thumbR = (hsl.s / 100) * (SIZE / 2);
  const thumbX = SIZE / 2 + thumbR * Math.sin((hsl.h * Math.PI) / 180);
  const thumbY = SIZE / 2 - thumbR * Math.cos((hsl.h * Math.PI) / 180);
  const whiteContrast = contrast(hex, "#ffffff");

  return (
    <div className="colour-wheel">
      <div
        className="colour-wheel-disc"
        style={{ width: SIZE, height: SIZE }}
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          pickAt(e);
        }}
        onPointerMove={(e) => draggingRef.current && pickAt(e)}
        onPointerUp={() => (draggingRef.current = false)}
        onPointerCancel={() => (draggingRef.current = false)}
      >
        <canvas ref={canvasRef} style={{ width: SIZE, height: SIZE }} aria-hidden="true" />
        <span className="colour-wheel-thumb" style={{ left: thumbX, top: thumbY, background: hex }} />
      </div>

      <label className="colour-wheel-light">
        <span>Light / dark</span>
        <input
          type="range"
          min={L_MIN}
          max={L_MAX}
          value={hsl.l}
          onChange={(e) => setHsl((c) => ({ ...c, l: Number(e.target.value) }))}
          style={{
            background:
              "linear-gradient(90deg, " + hslToHex(hsl.h, hsl.s, L_MIN) + ", " + hslToHex(hsl.h, hsl.s, 50) + ", " + hslToHex(hsl.h, hsl.s, L_MAX) + ")"
          }}
          aria-label="Lightness"
        />
      </label>

      <div className="colour-wheel-preview">
        <span className="colour-wheel-swatch" style={{ background: hex }} />
        <span className="colour-wheel-sample" style={{ background: hex }}>
          Log it
        </span>
        <code>{hex}</code>
      </div>
      {whiteContrast < 3 && <p className="colour-wheel-warn">Quite pale — white text on buttons in this colour will be hard to read. Slide it a bit darker.</p>}

      <div className="form-actions">
        <button type="button" className="primary" style={{ background: hex, borderColor: hex }} onClick={() => onUse(hex)} disabled={saving}>
          {saving ? "Saving…" : "Use this colour"}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function hslToHex(h, s, l) {
  return "#" + hslToRgb(h, s, l).map((v) => v.toString(16).padStart(2, "0")).join("");
}

function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return [265, 80, 55];
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
