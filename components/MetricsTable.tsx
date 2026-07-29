"use client";

import type { Series } from "@/lib/client/api";

export function MetricsTable({ series }: { series: Series[] }) {
  const dateSet = new Set<string>();
  for (const s of series) for (const p of s.points) dateSet.add(p.date);
  const dates = Array.from(dateSet).sort().reverse();

  if (dates.length === 0) {
    return (
      <div className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
        No data for this range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr style={{ background: "var(--surface-1)" }}>
            <th
              className="text-left px-3 py-2 font-medium sticky left-0"
              style={{ color: "var(--text-secondary)", background: "var(--surface-1)" }}
            >
              Date
            </th>
            {series.map((s) => (
              <th
                key={s.metricKey}
                className="text-right px-3 py-2 font-medium whitespace-nowrap"
                style={{ color: "var(--text-secondary)" }}
              >
                {s.metricLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((date) => (
            <tr key={date} style={{ borderTop: "1px solid var(--gridline)" }}>
              <td
                className="px-3 py-1.5 tabular-nums sticky left-0"
                style={{ color: "var(--text-primary)", background: "var(--surface-1)" }}
              >
                {date}
              </td>
              {series.map((s) => {
                const point = s.points.find((p) => p.date === date);
                return (
                  <td
                    key={s.metricKey}
                    className="text-right px-3 py-1.5 tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {point ? Math.round(point.value * 100) / 100 : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
