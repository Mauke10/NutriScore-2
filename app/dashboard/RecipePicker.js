"use client";

import { useEffect, useRef, useState } from "react";

// A small type-ahead over the shared recipe library. Renders its own input
// (so the parent form doesn't need a separate "description" field — picking
// a recipe fills the description too) plus a dropdown of matches.
export default function RecipePicker({ id, value, onChange, onPick, placeholder }) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function search(v) {
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/recipes?q=" + encodeURIComponent(v));
        const data = await res.json();
        setResults(data.entries || []);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  function handleChange(e) {
    const v = e.target.value;
    onChange(v);
    search(v);
  }

  function pick(recipe) {
    onPick(recipe);
    setOpen(false);
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        id={id}
        value={value}
        onChange={handleChange}
        onFocus={() => search(value)}
        placeholder={placeholder || "e.g. chicken curry"}
        autoComplete="off"
      />
      {open && (results.length > 0 || loading) && (
        <div className="recipe-dropdown">
          {loading && <div className="recipe-dropdown-hint">Searching…</div>}
          {!loading &&
            results.map((r) => (
              <button type="button" key={r.id} className="recipe-option" onClick={() => pick(r)}>
                <span className="recipe-option-name">{r.name}</span>
                <span className="recipe-option-meta">
                  {r.calories != null ? Math.round(r.calories) + " kcal" : "—"} · {r.meal_type}
                </span>
              </button>
            ))}
          {!loading && results.length === 0 && <div className="recipe-dropdown-hint">No saved recipe yet — it'll be offered to save below.</div>}
        </div>
      )}
    </div>
  );
}
