"use client";

import { useEffect, useState } from "react";
import { PEOPLE, localDateStr } from "./utils";
import { PLAN_CHANGED } from "./TrainingPlanCalendar";
import { SPORTS, sportOf } from "../../lib/trainingSports";

// Both people's planned sessions for today, under the page title. Refetches
// when the Calendar tab changes a plan. Real calendar day, like the Calendar.
export default function TodayPlanStrip() {
  const [plans, setPlans] = useState([]);
  const today = localDateStr(new Date());

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/training-plan?from=" + today + "&to=" + today)
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled) setPlans(data.entries || []);
        })
        .catch(() => {});
    load();
    window.addEventListener(PLAN_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(PLAN_CHANGED, load);
    };
  }, [today]);

  return (
    <div className="today-plan-strip">
      {PEOPLE.map((p) => {
        const mine = plans.filter((x) => x.person_id === p.key);
        return (
          <div className="today-plan-box" key={p.key}>
            <div className="today-plan-name">
              <span className="dot" style={{ background: "var(" + p.seriesVar + ")" }} />
              {p.name}
            </div>
            <div className={mine.length ? "today-plan-activity" : "today-plan-activity empty"}>
              {mine.length ? mine.map((x) => SPORTS[sportOf(x.activity)].emoji + " " + x.activity).join(" · ") : "Nothing planned"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
