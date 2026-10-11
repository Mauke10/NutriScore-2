"use client";

import { useEffect, useState } from "react";
import { todayStr } from "./utils";

const DISPLAY_NAME = { martin: "Martin", laura: "Laura" };
const SERIES_VAR = { martin: "--series-martin", laura: "--series-laura" };

export default function TodayPlanStrip() {
  const [entries, setEntries] = useState({ martin: null, laura: null });
  const today = todayStr();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/training-plan?date=" + today)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setEntries(data.entries || { martin: null, laura: null });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [today]);

  return (
    <div className="today-plan-strip">
      {["martin", "laura"].map((id) => (
        <div className="today-plan-box" key={id}>
          <div className="today-plan-name">
            <span className="dot" style={{ background: "var(" + SERIES_VAR[id] + ")" }} />
            {DISPLAY_NAME[id]}
          </div>
          <div className={entries[id] ? "today-plan-activity" : "today-plan-activity empty"}>
            {entries[id] || "Nothing planned"}
          </div>
        </div>
      ))}
    </div>
  );
}
