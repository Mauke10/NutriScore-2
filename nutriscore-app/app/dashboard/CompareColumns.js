"use client";

import { currentMonthStr, monthLabel } from "./utils";

const SERIES_VAR = { martin: "--series-martin", laura: "--series-laura" };
const DISPLAY_NAME = { martin: "Martin", laura: "Laura" };

function latestWeekly(weekly) {
  if (!weekly || !weekly.length) return null;
  return [...weekly].sort((a, b) => a.week_start.localeCompare(b.week_start)).pop();
}

function latestTraining(training) {
  const month = currentMonthStr();
  return (training || []).find((t) => t.month === month) || null;
}

function todayCalories(snacks, calorieTarget) {
  const today = new Date().toISOString().slice(0, 10);
  const total = (snacks || []).filter((s) => s.log_date === today).reduce((sum, s) => sum + (Number(s.calories) || 0), 0);
  return { total: Math.round(total), target: calorieTarget };
}

function StatColumn({ id, data }) {
  const wk = latestWeekly(data.weekly);
  const cal = todayCalories(data.snacks, data.calorieTarget);
  return (
    <div className={"compare-col compare-col-" + id}>
      <div className="compare-col-head">
        <span className="dot" style={{ background: "var(" + SERIES_VAR[id] + ")" }} />
        {DISPLAY_NAME[id]}
      </div>
      <div className="compare-row">
        <span className="compare-label">Today</span>
        <span className="compare-val">
          {cal.total}
          {cal.target != null ? " / " + cal.target : ""} kcal
        </span>
      </div>
      <div className="compare-row">
        <span className="compare-label">Sessions/wk</span>
        <span className="compare-val">{wk?.sessions != null ? Math.round(wk.sessions) : "—"}</span>
      </div>
      <div className="compare-row">
        <span className="compare-label">Sleep</span>
        <span className="compare-val">{wk?.sleep_avg_hrs != null ? Number(wk.sleep_avg_hrs).toFixed(1) + "h" : "—"}</span>
      </div>
    </div>
  );
}

// Two bars, side by side, for one metric this month — Martin's own colour vs
// Laura's own colour, values labelled directly above each bar.
function PairedBars({ label, unit, martinVal, lauraVal }) {
  const max = Math.max(1, martinVal || 0, lauraVal || 0);
  const barWidth = 22;
  const gap = 14;
  const chartHeight = 40;
  const labelPad = 12;
  const width = barWidth * 2 + gap;
  const svgHeight = labelPad + chartHeight + 4;
  const baseline = labelPad + chartHeight;
  const mh = martinVal != null ? Math.max(2, Math.round((martinVal / max) * chartHeight)) : 0;
  const lh = lauraVal != null ? Math.max(2, Math.round((lauraVal / max) * chartHeight)) : 0;

  return (
    <div className="compare-pair">
      <svg
        viewBox={"0 0 " + width + " " + svgHeight}
        width="100%"
        height={svgHeight}
        preserveAspectRatio="xMidYMax meet"
        role="img"
        aria-label={label + ": Martin " + (martinVal != null ? martinVal + unit : "no data") + ", Laura " + (lauraVal != null ? lauraVal + unit : "no data")}
      >
        <line x1="0" y1={baseline} x2={width} y2={baseline} stroke="var(--gridline)" strokeWidth="1" />
        {martinVal != null && (
          <>
            <text x={barWidth / 2} y={baseline - mh - 4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--text-primary)">
              {martinVal}
            </text>
            <rect x="0" y={baseline - mh} width={barWidth} height={mh} rx="4" fill="var(--series-martin)" />
          </>
        )}
        {lauraVal != null && (
          <>
            <text x={barWidth + gap + barWidth / 2} y={baseline - lh - 4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--text-primary)">
              {lauraVal}
            </text>
            <rect x={barWidth + gap} y={baseline - lh} width={barWidth} height={lh} rx="4" fill="var(--series-laura)" />
          </>
        )}
      </svg>
      <div className="compare-pair-label">
        {label} <span className="muted">{unit}</span>
      </div>
    </div>
  );
}

// One line per person, weight moved (kg) over the last few months.
function WeightLineChart({ martinHist, lauraHist }) {
  const months = Array.from(new Set([...(martinHist || []).map((t) => t.month), ...(lauraHist || []).map((t) => t.month)]))
    .sort()
    .slice(-6);
  if (!months.length) return <div className="compare-empty">No training months logged yet.</div>;

  const mMap = {};
  (martinHist || []).forEach((t) => {
    mMap[t.month] = t.weight_moved_kg;
  });
  const lMap = {};
  (lauraHist || []).forEach((t) => {
    lMap[t.month] = t.weight_moved_kg;
  });
  const vals = months.flatMap((m) => [mMap[m], lMap[m]]).filter((v) => v != null);
  const max = Math.max(1, ...vals);

  const width = 280;
  const height = 90;
  const padTop = 10;
  const padBottom = 18;
  const padX = 6;
  const innerW = width - padX * 2;
  const stepX = months.length > 1 ? innerW / (months.length - 1) : 0;

  function points(map) {
    return months
      .map((m, i) => {
        const v = map[m];
        if (v == null) return null;
        return { x: padX + i * stepX, y: padTop + (height - padTop - padBottom) * (1 - v / max) };
      })
      .filter(Boolean);
  }
  function pathD(pts) {
    return pts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  }
  const mPts = points(mMap);
  const lPts = points(lMap);

  return (
    <svg
      viewBox={"0 0 " + width + " " + (height + 2)}
      width="100%"
      height={height + 16}
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label="Weight moved over time, Martin and Laura"
    >
      <line x1={padX} y1={height - padBottom} x2={width - padX} y2={height - padBottom} stroke="var(--gridline)" strokeWidth="1" />
      {mPts.length > 1 && <path d={pathD(mPts)} fill="none" stroke="var(--series-martin)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {lPts.length > 1 && <path d={pathD(lPts)} fill="none" stroke="var(--series-laura)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {lPts.length > 0 && (
        <circle cx={lPts[lPts.length - 1].x} cy={lPts[lPts.length - 1].y} r="4" fill="var(--series-laura)" stroke="var(--surface)" strokeWidth="2" />
      )}
      {mPts.length > 0 && (
        <circle cx={mPts[mPts.length - 1].x} cy={mPts[mPts.length - 1].y} r="4" fill="var(--series-martin)" stroke="var(--surface)" strokeWidth="2" />
      )}
      {months.map((m, i) => (
        <text key={m} x={padX + i * stepX} y={height} textAnchor="middle" fontSize="8" fill="var(--text-muted)">
          {monthLabel(m)}
        </text>
      ))}
    </svg>
  );
}

export default function CompareColumns({ martin, laura }) {
  const mVol = latestTraining(martin.training);
  const lVol = latestTraining(laura.training);

  return (
    <div className="card compare-columns">
      <h3>
        Side by side <span className="muted">— today & this month</span>
      </h3>
      <div className="compare-grid">
        <StatColumn id="martin" data={martin} />
        <StatColumn id="laura" data={laura} />
      </div>

      <div className="compare-legend">
        <span className="compare-legend-item">
          <span className="dot" style={{ background: "var(--series-martin)" }} />
          Martin
        </span>
        <span className="compare-legend-item">
          <span className="dot" style={{ background: "var(--series-laura)" }} />
          Laura
        </span>
      </div>

      <div className="compare-section-label">Weight moved</div>
      <WeightLineChart martinHist={martin.training} lauraHist={laura.training} />

      <div className="compare-section-label">This month's volume</div>
      <div className="compare-pairs">
        <PairedBars label="Swim" unit="km" martinVal={mVol?.swim_km != null ? Math.round(mVol.swim_km * 10) / 10 : null} lauraVal={lVol?.swim_km != null ? Math.round(lVol.swim_km * 10) / 10 : null} />
        <PairedBars label="Bike" unit="km" martinVal={mVol?.bike_km != null ? Math.round(mVol.bike_km) : null} lauraVal={lVol?.bike_km != null ? Math.round(lVol.bike_km) : null} />
        <PairedBars label="Run" unit="km" martinVal={mVol?.run_km != null ? Math.round(mVol.run_km * 10) / 10 : null} lauraVal={lVol?.run_km != null ? Math.round(lVol.run_km * 10) / 10 : null} />
      </div>
    </div>
  );
}
