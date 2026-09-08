"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, Settings, BookOpen, Palette } from "lucide-react";

export default function TopMenu({ onOpenSettings, onOpenRecipes, onOpenColour }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={boxRef} className="top-menu">
      <button type="button" className="top-menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Menu strokeWidth={2} />
      </button>
      {open && (
        <div className="dropdown-menu">
          <button
            type="button"
            className="dropdown-item"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            <Settings strokeWidth={2} />
            Settings
          </button>
          <button
            type="button"
            className="dropdown-item"
            onClick={() => {
              setOpen(false);
              onOpenRecipes();
            }}
          >
            <BookOpen strokeWidth={2} />
            Recipes
          </button>
          <button
            type="button"
            className="dropdown-item"
            onClick={() => {
              setOpen(false);
              onOpenColour();
            }}
          >
            <Palette strokeWidth={2} />
            Colour
          </button>
        </div>
      )}
    </div>
  );
}
