"use client";

import type { Series } from "@/lib/client/api";
import { BenchmarkMeter } from "./BenchmarkMeter";

interface InterfaceRow {
  name: string;
  totalCount?: Series;
  totalRevenue?: Series;
  deactivation?: Series;
}

function latestPoint(s?: Series): number | null {
  if (!s || s.points.length === 0) return null;
  return s.points[s.points.length - 1].value;
}

function formatNumber(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return Math.round(v).toLocaleString("en-US");
}

function displayName(label: string): string {
  const m = label.match(/^(?:Total|Deactivations) — (.+?)(?: \((?:Count|Revenue)\))?$/);
  return m ? m[1] : label;
}

function groupByInterface(series: Series[]): InterfaceRow[] {
  const byName = new Map<string, InterfaceRow>();
  for (const s of series) {
    const isTotalCount = s.metricKey.startsWith("interface.") && s.metricKey.endsWith(".total_count");
    const isTotalRevenue = s.metricKey.startsWith("interface.") && s.metricKey.endsWith(".total_revenue");
    const isDeactivation = s.metricKey.startsWith("interface.") && s.metricKey.endsWith(".deactivation");
    if (!isTotalCount && !isTotalRevenue && !isDeactivation) continue;

    const name = displayName(s.metricLabel);
    if (!byName.has(name)) byName.set(name, { name });
    const row = byName.get(name)!;
    if (isTotalCount) row.totalCount = s;
    else if (isTotalRevenue) row.totalRevenue = s;
    else if (isDeactivation) row.deactivation = s;
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function InterfaceCards({ series }: { series: Series[] }) {
  const rows = groupByInterface(series);
  if (rows.length === 0) return null;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {rows.map((row) => (
        <div
          key={row.name}
          className="rounded-lg p-4 flex flex-col gap-2"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
        >
          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {row.name}
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {formatNumber(latestPoint(row.totalCount))}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                total count
              </span>
            </div>
            <BenchmarkMeter latest={latestPoint(row.totalCount)} best={row.totalCount?.allTimeMax} />
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm tabular-nums" style={{ color: "var(--text-secondary)" }}>
                {formatNumber(latestPoint(row.totalRevenue))}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                total revenue
              </span>
            </div>
            <BenchmarkMeter latest={latestPoint(row.totalRevenue)} best={row.totalRevenue?.allTimeMax} />
          </div>

          {row.deactivation && (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  {formatNumber(latestPoint(row.deactivation))}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  deactivations
                </span>
              </div>
              <BenchmarkMeter latest={latestPoint(row.deactivation)} best={row.deactivation?.allTimeMax} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
