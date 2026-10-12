"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, Target, Settings, BookOpen, Palette, LogOut } from "lucide-react";

export default function TopMenu({ onOpenGoals, onOpenSettings, onOpenRecipes, onOpenColour, onLogout }) {
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
              onOpenGoals();
            }}
          >
            <Target strokeWidth={2} />
            Goals
          </button>
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
          {/* On a phone the "Signed in as … / Log out" row is hidden to give
              the tab its space back, so logging out lives here instead. */}
          <button
            type="button"
            className="dropdown-item only-mobile-flex"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut strokeWidth={2} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
