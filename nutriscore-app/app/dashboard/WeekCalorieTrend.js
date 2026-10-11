"use client";

import { todayStr, localDateStr } from "./utils";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const BAR_W = 20;
const GAP = 8;
const PAD = 4;
const CHART_H = 56;
const LABEL_H = 16;

function isoDateDaysAgo(n) {
  // localDateStr, not toISOString — Tallinn is UTC+2/+3, so in the ~2-3
  // hours after local midnight, toISOString().slice(0,10) still reports
  // yesterday's UTC date. That would silently exclude anything logged right
  // after midnight from this whole 7-day window until the UTC day caught up.
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

function median(nums) {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// A small bar-per-day strip (today rightmost, ringed) showing the last 7
// days' logged calories, a dashed line at the calorie goal, and the median
// of those 7 days compared against it — sits above the calorie ring so you
// can see whether today is an outlier or business as usual before you even
// look at the ring. Reuses whatever's already in `snacks` (usePersonData
// already fetches the last ~300 entries across all dates), so no extra
// fetch is needed just for this.
export default function WeekCalorieTrend({ personId, snacks, calorieTarget }) {
  const today = todayStr();
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(isoDateDaysAgo(i));

  const totalsByDay = days.map((date) => {
    const entries = snacks.filter((s) => s.log_date === date);
    return {
      date,
      total: entries.reduce((sum, s) => sum + (Number(s.calories) || 0), 0),
      tracked: entries.length > 0 // a day with nothing logged isn't "0 kcal", it's no data —
      // excluded from the median below so a missed day doesn't drag it down.
    };
  });

  const trackedTotals = totalsByDay.filter((d) => d.tracked).map((d) => d.total);
  const med = median(trackedTotals);
  const maxVal = Math.max(calorieTarget || 0, ...totalsByDay.map((d) => d.total), 1);
  const seriesVar = "var(--" + (personId === "laura" ? "series-laura" : "series-martin") + ")";
  const delta = calorieTarget != null && trackedTotals.length ? Math.round(med - calorieTarget) : null;
  const label = trackedTotals.length && trackedTotals.length < 7 ? "Last 7 days (" + trackedTotals.length + " logged)" : "Last 7 days";

  const chartW = days.length * BAR_W + (days.length - 1) * GAP + PAD * 2;
  const goalY = calorieTarget != null ? CHART_H - Math.min(1, calorieTarget / maxVal) * CHART_H : null;

  return (
    <div className="week-trend">
      <div className="week-trend-head">
        <span className="week-trend-label">{label}</span>
        <span className="week-trend-median">
          {trackedTotals.length === 0 ? (
            "Nothing logged yet"
          ) : (
            <>
              Median <strong>{Math.round(med).toLocaleString()}</strong> kcal
              {delta != null && (
                <span className={"week-trend-delta" + (delta > 0 ? " over" : "")}>
                  {delta > 0 ? " · " + delta.toLocaleString() + " over goal" : delta < 0 ? " · " + Math.abs(delta).toLocaleString() + " under goal" : " · right on goal"}
                </span>
              )}
            </>
          )}
        </span>
      </div>
      <svg
        className="week-trend-chart"
        viewBox={"0 0 " + chartW + " " + (CHART_H + LABEL_H)}
        preserveAspectRatio="xMidYMax meet"
        role="img"
        aria-label={
          "Last 7 days of calories, " +
          (trackedTotals.length ? "median " + Math.round(med) + " over " + trackedTotals.length + " logged days" : "nothing logged yet") +
          (calorieTarget != null ? " against a goal of " + Math.round(calorieTarget) : "")
        }
      >
        {goalY != null && <line x1={0} y1={goalY} x2={chartW} y2={goalY} className="week-trend-goal-line" />}
        {totalsByDay.map((d, i) => {
          const h = Math.max(2, Math.min(1, d.total / maxVal) * CHART_H);
          const x = PAD + i * (BAR_W + GAP);
          const y = CHART_H - h;
          const isToday = d.date === today;
          const isOver = calorieTarget != null && d.total > calorieTarget;
          const fill = !d.tracked ? "var(--gridline)" : isOver ? "var(--status-warning)" : seriesVar;
          const weekday = WEEKDAY_LETTERS[new Date(d.date + "T12:00:00").getDay()];
          return (
            <g key={d.date} opacity={isToday ? 1 : 0.68}>
              <title>{d.date} — {d.tracked ? Math.round(d.total) + " kcal" : "not logged"}</title>
              <rect x={x} y={y} width={BAR_W} height={h} rx={5} fill={fill} />
              {isToday && (
                <rect x={x - 1.5} y={y - 1.5} width={BAR_W + 3} height={h + 3} rx={6.5} fill="none" stroke={fill} strokeWidth={1.5} opacity={0.55} />
              )}
              <text x={x + BAR_W / 2} y={CHART_H + 12} textAnchor="middle" className="week-trend-daylabel">
                {weekday}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
