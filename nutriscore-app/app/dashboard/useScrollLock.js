"use client";

import { useEffect } from "react";

// Freezes the page behind a popup (Modal, SideDrawer). overflow: hidden alone
// isn't enough on iPhone — a drag on the dimmed backdrop still scrolls the
// page — so the body is pinned with position: fixed at the current scroll
// offset and put back on unlock. Counted, so a popup opening while another
// is closing doesn't unlock early.
let locks = 0;
let savedY = 0;

function lock() {
  if (locks++ > 0) return;
  savedY = window.scrollY;
  const s = document.body.style;
  s.position = "fixed";
  s.top = -savedY + "px";
  s.left = "0";
  s.right = "0";
  s.overflow = "hidden";
}

function unlock() {
  if (--locks > 0) return;
  const s = document.body.style;
  s.position = s.top = s.left = s.right = s.overflow = "";
  window.scrollTo(0, savedY);
}

export default function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}
