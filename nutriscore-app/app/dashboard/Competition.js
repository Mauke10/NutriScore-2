"use client";

const CATS = [
  { key: "sessions", label: "Sessions", fmt: (v) => String(Math.round(v)) },
  { key: "sleep_avg_hrs", label: "Avg sleep", fmt: (v) => Number(v).toFixed(1) + "h" },
  { key: "supplement_days", label: "Supplements", fmt: (v) => Math.round(v) + "/7" },
  { key: "nutrition_adherence_pct", label: "Nutrition adherence", fmt: (v) => Math.round(v) + "%" }
];

function toMap(entries) {
  const map = {};
  for (const e of entries) map[e.week_start] = e;
  return map;
}

export default function Competition({ martinWeekly, lauraWeekly }) {
  const mMap = toMap(martinWeekly);
  const lMap = toMap(lauraWeekly);
  const weeks = Array.from(new Set([...Object.keys(mMap), ...Object.keys(lMap)])).sort();
  const commonWeeks = weeks.filter((w) => mMap[w] && lMap[w]);

  if (!commonWeeks.length) {
    return (
      <div className="card">
        <h3>This week's head-to-head</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Log the same week for both of you to kick off the head-to-head.
        </p>
      </div>
    );
  }

  let seasonMartin = 0;
  let seasonLaura = 0;
  let seasonTies = 0;
  const latestWeek = commonWeeks[commonWeeks.length - 1];
  let latestBreakdown = [];

  for (const wk of commonWeeks) {
    const md = mMap[wk];
    const ld = lMap[wk];
    let mWins = 0;
    let lWins = 0;
    const rows = CATS.map((cat) => {
      const mv = md[cat.key];
      const lv = ld[cat.key];
      let winner = null;
      if (mv != null && lv != null && !Number.isNaN(mv) && !Number.isNaN(lv)) {
        if (Number(mv) > Number(lv)) {
          winner = "martin";
          mWins++;
        } else if (Number(lv) > Number(mv)) {
          winner = "laura";
          lWins++;
        }
      }
      return { cat, mv, lv, winner };
    });
    if (mWins > lWins) seasonMartin++;
    else if (lWins > mWins) seasonLaura++;
    else seasonTies++;
    if (wk === latestWeek) latestBreakdown = rows;
  }

  return (
    <div className="card">
      <h3>This week's head-to-head</h3>
      <div className="h2h-season">
        Season: <strong>Martin {seasonMartin}</strong> — <strong>Laura {seasonLaura}</strong>
        {seasonTies ? ` (${seasonTies} tied week${seasonTies === 1 ? "" : "s"})` : ""} · week of {latestWeek}
      </div>
      <div className="h2h-head">
        <div />
        <div className="h2h-name">
          <span className="dot" style={{ background: "var(--series-martin)" }} />
          Martin
        </div>
        <div className="h2h-name">
          <span className="dot" style={{ background: "var(--series-laura)" }} />
          Laura
        </div>
      </div>
      {latestBreakdown.map((row) => (
        <div className="h2h-row" key={row.cat.key}>
          <div className="h2h-label">{row.cat.label}</div>
          <span
            className="h2h-val"
            style={{
              background: "var(--series-martin-soft)",
              fontWeight: row.winner === "martin" ? 800 : 500
            }}
          >
            {row.mv != null ? row.cat.fmt(row.mv) : "—"}
          </span>
          <span
            className="h2h-val"
            style={{
              background: "var(--series-laura-soft)",
              fontWeight: row.winner === "laura" ? 800 : 500
            }}
          >
            {row.lv != null ? row.cat.fmt(row.lv) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
