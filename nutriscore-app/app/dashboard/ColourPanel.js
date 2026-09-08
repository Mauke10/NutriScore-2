"use client";

import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import Modal from "./Modal";

const DEFAULT_COLOR = { martin: "#7c3aed", laura: "#db2777" };

const SWATCHES = [
  "#7c3aed", // violet (default Martin)
  "#db2777", // pink (default Laura)
  "#2563eb", // blue
  "#0d9488", // teal
  "#16a34a", // green
  "#ca8a04", // amber
  "#ea580c", // orange
  "#dc2626", // red
  "#4f46e5", // indigo
  "#0891b2" // cyan
];

const NIGHT_STYLES = [
  { key: "dark", label: "Classic", swatch: "#141414" },
  { key: "green", label: "Forest", swatch: "#235836" }
];

export default function ColourPanel({ personId, myColor, refreshAccentColor, theme, onThemeChange, onClose }) {
  const [picked, setPicked] = useState(myColor || DEFAULT_COLOR[personId]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function applyColor(hex) {
    setPicked(hex);
    setSaving(true);
    setMsg("");
    try {
      await fetch("/api/appearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accentColor: hex })
      });
      await refreshAccentColor();
      setMsg("Saved.");
    } finally {
      setSaving(false);
    }
  }

  const isNight = theme.mode !== "light";

  return (
    <Modal title="Colour" onClose={onClose}>
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 3 }}>Your colour</h4>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
          Used for your name, dot, ring and badges everywhere in the app.
        </p>
        <div className="colour-swatch-grid">
          {SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              className={picked.toLowerCase() === hex.toLowerCase() ? "colour-swatch selected" : "colour-swatch"}
              style={{ background: hex }}
              aria-label={hex}
              onClick={() => applyColor(hex)}
            />
          ))}
          <label className="colour-swatch colour-swatch-custom" style={{ background: picked }}>
            <input
              type="color"
              value={picked}
              onChange={(e) => applyColor(e.target.value)}
              style={{ opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
            />
          </label>
        </div>
        {msg && <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 8 }}>{saving ? "Saving…" : msg}</p>}
      </div>

      <div>
        <h4 style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 3 }}>Appearance</h4>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
          Bright or night mode, just for this device.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={isNight}
          aria-label="Toggle night mode"
          className="theme-switch"
          onClick={() => onThemeChange({ mode: isNight ? "light" : theme.night || "dark", night: theme.night || "dark" })}
        >
          <span className="theme-switch-thumb">{isNight ? <Moon size={13} strokeWidth={2.2} /> : <Sun size={13} strokeWidth={2.2} />}</span>
        </button>
        <span style={{ marginLeft: 10, fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>
          {isNight ? "Night" : "Bright"}
        </span>

        {isNight && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 7 }}>
              Night style
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {NIGHT_STYLES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={theme.night === s.key ? "night-style-btn selected" : "night-style-btn"}
                  onClick={() => onThemeChange({ mode: s.key === "green" ? "green" : "dark", night: s.key })}
                >
                  <span className="night-style-swatch" style={{ background: s.swatch }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className="ghost"
          style={{ marginTop: 14, fontSize: 11.5, padding: "6px 10px" }}
          onClick={() => onThemeChange(null)}
        >
          Match my device instead
        </button>
      </div>
    </Modal>
  );
}
