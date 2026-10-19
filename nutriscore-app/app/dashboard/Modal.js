"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import useScrollLock from "./useScrollLock";

// Matches the .modal / .modal-overlay transition duration in globals.css —
// change one, change the other.
const CLOSE_MS = 180;

export default function Modal({ title, onClose, children, wide }) {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);
  useScrollLock();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function requestClose() {
    if (closing) return; // already on the way out — don't restart/double-fire
    setClosing(true);
    timerRef.current = setTimeout(onClose, CLOSE_MS);
  }

  return (
    <div
      className={closing ? "modal-overlay is-closing" : "modal-overlay"}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div className={wide ? "modal modal-wide" : "modal"}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" aria-label="Close" onClick={requestClose}>
            <X strokeWidth={2} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
