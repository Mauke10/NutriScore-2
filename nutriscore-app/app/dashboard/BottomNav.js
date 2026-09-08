"use client";

import { UtensilsCrossed, Activity, HeartPulse, Trophy, CalendarDays } from "lucide-react";

const TABS = [
  { key: "today", label: "Today", Icon: UtensilsCrossed },
  { key: "training", label: "Training", Icon: Activity },
  { key: "calendar", label: "Calendar", Icon: CalendarDays },
  { key: "body", label: "Body", Icon: HeartPulse },
  { key: "compete", label: "Compete", Icon: Trophy }
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Sections">
      <div className="bottom-nav-inner">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className={active === key ? "bottom-nav-btn active" : "bottom-nav-btn"}
            onClick={() => onChange(key)}
            aria-current={active === key ? "page" : undefined}
          >
            <Icon strokeWidth={2} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
