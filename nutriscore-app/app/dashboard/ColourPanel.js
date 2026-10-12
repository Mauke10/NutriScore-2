"use client";

import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import Modal from "./Modal";
import { DEFAULT_COLOR } from "./utils";


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
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h4 className="panel-heading">Your colour</h4>
        <p className="panel-desc">
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
        {msg && <p className="status-text small spaced-sm">{saving ? "Saving…" : msg}</p>}
      </div>

      <div>
        <h4 className="panel-heading">Appearance</h4>
        <p className="panel-desc">
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
        <span className="theme-switch-label">
          {isNight ? "Night" : "Bright"}
        </span>

        {isNight && (
          <div style={{ marginTop: "var(--space-3-5)" }}>
            <div className="overline">
              Night style
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
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
          className="ghost sm spaced-top"
          onClick={() => onThemeChange(null)}
        >
          Match my device instead
        </button>
      </div>
    </Modal>
  );
}
