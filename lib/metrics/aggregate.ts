import type { DailyMetricRow } from "../db/client.ts";

/** Returns the ISO date (Monday) of the week containing `dateStr` (YYYY-MM-DD). */
export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export interface SeriesPoint {
  date: string; // day date, or Monday-of-week date when granularity is "weekly"
  value: number;
}

export interface Series {
  metricKey: string;
  metricLabel: string;
  points: SeriesPoint[];
}

export function toDailySeries(rows: DailyMetricRow[]): Series[] {
  const byKey = new Map<string, Series>();
  for (const row of rows) {
    if (!byKey.has(row.metric_key)) {
      byKey.set(row.metric_key, { metricKey: row.metric_key, metricLabel: row.metric_label, points: [] });
    }
    byKey.get(row.metric_key)!.points.push({ date: row.date, value: row.value });
  }
  return Array.from(byKey.values());
}

/** Buckets daily rows into ISO weeks (Monday-keyed). Revenue/count metrics
 * are summed across the week; anything that looks like an already-averaged
 * or point-in-time snapshot (base counts) is averaged instead, since summing
 * a headcount across 7 days is meaningless. */
export function toWeeklySeries(rows: DailyMetricRow[]): Series[] {
  const byKey = new Map<string, { label: string; weeks: Map<string, number[]> }>();
  for (const row of rows) {
    if (!byKey.has(row.metric_key)) byKey.set(row.metric_key, { label: row.metric_label, weeks: new Map() });
    const entry = byKey.get(row.metric_key)!;
    const wk = mondayOf(row.date);
    if (!entry.weeks.has(wk)) entry.weeks.set(wk, []);
    entry.weeks.get(wk)!.push(row.value);
  }

  const series: Series[] = [];
  for (const [metricKey, entry] of byKey) {
    const isSnapshotMetric = metricKey.startsWith("base.");
    const points: SeriesPoint[] = Array.from(entry.weeks.entries())
      .map(([date, values]) => ({
        date,
        value: isSnapshotMetric
          ? values.reduce((a, b) => a + b, 0) / values.length
          : values.reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    series.push({ metricKey, metricLabel: entry.label, points });
  }
  return series;
}
