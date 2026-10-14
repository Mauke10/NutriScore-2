"use client";

import { useState } from "react";
import Modal from "./Modal";
import { DEFAULT_COLOR } from "./utils";
import { DAY_THEMES, NIGHT_THEMES } from "../../lib/theme";


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

const MODES = [
  { key: "day", label: "Bright" },
  { key: "night", label: "Night" },
  { key: null, label: "Auto" }
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
        <p className="panel-desc">Just for this device. Auto follows your phone: the bright scheme by day, the night one when the phone goes dark.</p>
        <div className="segmented appearance-mode" role="radiogroup" aria-label="Bright, night or auto">
          {MODES.map((m) => (
            <button
              key={String(m.key)}
              type="button"
              role="radio"
              aria-checked={theme.mode === m.key}
              className={theme.mode === m.key ? "seg-btn selected" : "seg-btn"}
              onClick={() => onThemeChange({ ...theme, mode: m.key })}
            >
              {m.label}
            </button>
          ))}
        </div>

        <SchemeRow
          title="Bright"
          schemes={DAY_THEMES}
          selected={theme.day}
          // Picking a bright scheme while on Night switches to Bright, so you see what you picked.
          onPick={(key) => onThemeChange({ ...theme, day: key, mode: theme.mode === "night" ? "day" : theme.mode })}
        />
        <SchemeRow
          title="Night"
          schemes={NIGHT_THEMES}
          selected={theme.night}
          onPick={(key) => onThemeChange({ ...theme, night: key, mode: theme.mode === "day" ? "night" : theme.mode })}
        />
      </div>
    </Modal>
  );
}

function SchemeRow({ title, schemes, selected, onPick }) {
  return (
    <>
      <div className="overline">{title}</div>
      <div className="scheme-row" role="radiogroup" aria-label={title + " scheme"}>
        {schemes.map((sc) => (
          <button
            key={sc.key}
            type="button"
            role="radio"
            aria-checked={selected === sc.key}
            className={selected === sc.key ? "scheme-btn selected" : "scheme-btn"}
            onClick={() => onPick(sc.key)}
          >
            <span className="scheme-swatch" style={{ background: "linear-gradient(135deg, " + sc.swatch[0] + " 50%, " + sc.swatch[1] + " 50%)" }} />
            {sc.label}
          </button>
        ))}
      </div>
    </>
  );
}
