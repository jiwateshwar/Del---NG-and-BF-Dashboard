"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

export interface TrendChartSeries {
  key: string;
  label: string;
  points: { date: string; value: number }[];
}

function buildRows(series: TrendChartSeries[]): Record<string, string | number>[] {
  const dateSet = new Set<string>();
  for (const s of series) for (const p of s.points) dateSet.add(p.date);
  const dates = Array.from(dateSet).sort();
  return dates.map((date) => {
    const row: Record<string, string | number> = { date };
    for (const s of series) {
      const point = s.points.find((p) => p.date === date);
      if (point) row[s.key] = point.value;
    }
    return row;
  });
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="rounded-md px-3 py-2 text-xs shadow-sm"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
    >
      <div className="font-medium mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: "var(--text-secondary)" }}>{p.name}:</span>
          <span className="tabular-nums font-medium">{p.value.toLocaleString("en-US")}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ series, height = 220 }: { series: TrendChartSeries[]; height?: number }) {
  const rows = buildRows(series);
  const showLegend = series.length > 1;

  if (rows.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{ height, color: "var(--text-muted)" }}
      >
        No data for this range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatTick}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
