"use client";

// A small scaled bar chart for one metric across recent months. History is
// expected oldest-first; the most recent bar is drawn in the person's series
// color, earlier months in a muted tone, so "how does this month compare to
// my own recent range" reads at a glance without pretending to be a
// dashboard-grade multi-series chart.
export default function MiniBarChart({ label, unit, history, seriesVar }) {
  const bars = history.slice(-6);
  const max = Math.max(1, ...bars.map((b) => b.value || 0));

  const barWidth = 26;
  const gap = 10;
  const chartHeight = 64;
  const width = bars.length ? bars.length * barWidth + (bars.length - 1) * gap : barWidth;

  return (
    <div className="bar-stat">
      <div className="bar-stat-head">
        <span className="bar-stat-label">{label}</span>
        <span className="bar-stat-value">
          {bars.length ? bars[bars.length - 1].value + " " + unit : "—"}
        </span>
      </div>
      {bars.length === 0 ? (
        <div className="bar-stat-track" />
      ) : (
        <svg
          role="img"
          aria-label={label + " over the last " + bars.length + " months, latest " + bars[bars.length - 1].value + " " + unit}
          viewBox={"0 0 " + width + " " + (chartHeight + 16)}
          width="100%"
          height={chartHeight + 16}
          preserveAspectRatio="xMinYMax meet"
        >
          {bars.map((b, i) => {
            const isLast = i === bars.length - 1;
            const h = Math.max(2, Math.round((b.value / max) * chartHeight));
            const x = i * (barWidth + gap);
            const y = chartHeight - h;
            return (
              <g key={b.month}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  rx={4}
                  fill={isLast ? "var(" + seriesVar + ")" : "var(--gridline)"}
                />
                <text x={x + barWidth / 2} y={chartHeight + 12} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
                  {b.monthLabel}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
