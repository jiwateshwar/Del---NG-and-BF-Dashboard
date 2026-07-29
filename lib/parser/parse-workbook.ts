// Top-level orchestrator: loads a workbook buffer, runs the generic
// extractors against every relevant sheet, then applies the account config
// to produce a flat, storage-ready list of daily metric points plus the
// Dashboard KPI snapshot rows (shown as-is, no account config needed there).

import type { AccountConfig } from "../accounts/types.ts";
import { loadWorkbook, sheetToMatrix } from "./workbook.ts";
import { findAsOfDate } from "./dashboard-meta.ts";
import { extractDashboardKpis, type KpiRow } from "./kpi-block.ts";
import { extractWidePivotBlocks, type WidePivotRecord } from "./wide-pivot.ts";
import { extractTransactionSeries } from "./transaction-sheet.ts";

export interface DailyMetricPoint {
  date: string;
  sheet: string;
  metricKey: string;
  metricLabel: string;
  value: number;
}

export interface ParsedWorkbook {
  asOfDate: string | null;
  kpiRows: KpiRow[];
  dailyMetrics: DailyMetricPoint[];
  warnings: string[];
}

function matchesDims(record: WidePivotRecord, match: Record<string, string>): boolean {
  return Object.entries(match).every(([k, v]) => record.dims[k] === v);
}

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Finds whichever dimension key (excluding `exclude`) holds "Count"/"Revenue"
 * as its values — this is the same unnamed metric-type column the wide-pivot
 * extractor surfaces as `col_N` on the `Interface`/`Price Point`/`Plan`
 * sheets (see wide-pivot.ts), located by value rather than name since its
 * header is blank in the source and the column index isn't stable. */
function findMetricTypeDim(records: WidePivotRecord[], exclude: string[]): string | null {
  const candidates = new Map<string, Set<string>>();
  for (const rec of records) {
    for (const [k, v] of Object.entries(rec.dims)) {
      if (exclude.includes(k)) continue;
      if (!candidates.has(k)) candidates.set(k, new Set());
      candidates.get(k)!.add(v.toLowerCase());
    }
  }
  for (const [k, values] of candidates) {
    if (values.has("count") || values.has("revenue")) return k;
  }
  return null;
}

export function parseWorkbook(buffer: Buffer, config: AccountConfig): ParsedWorkbook {
  const warnings: string[] = [];
  const wb = loadWorkbook(buffer);

  const dashboardMatrix = sheetToMatrix(wb, "Dashboard");
  const asOf = dashboardMatrix ? findAsOfDate(dashboardMatrix) : null;
  if (!asOf) warnings.push("Dashboard sheet: could not find an as-of snapshot date.");

  const kpi = dashboardMatrix
    ? extractDashboardKpis(dashboardMatrix)
    : { headerRow: null, groups: [], rows: [], warnings: ["Dashboard sheet not found."] };
  warnings.push(...kpi.warnings);

  const dailyMetrics: DailyMetricPoint[] = [];
  const asOfDate = asOf ? { year: asOf.year, month: asOf.month } : undefined;

  // --- Base breakdown (Active/Grace/Suspended) ---
  if (config.base) {
    const matrix = sheetToMatrix(wb, config.base.sheet);
    if (!matrix) {
      warnings.push(`${config.base.sheet} sheet not found — base series skipped.`);
    } else {
      const { records, warnings: w } = extractWidePivotBlocks(matrix, config.base.sheet, { asOfDate });
      warnings.push(...w);
      for (const series of config.base.series) {
        for (const rec of records) {
          if (matchesDims(rec, series.match)) {
            dailyMetrics.push({
              date: rec.date,
              sheet: config.base.sheet,
              metricKey: `base.${series.key}`,
              metricLabel: series.label,
              value: rec.value,
            });
          }
        }
      }
    }
  }

  // --- Deactivation (summed across all dimensions per date, plus a
  // breakdown by Interface when that sheet has one) ---
  if (config.deactivation) {
    const matrix = sheetToMatrix(wb, config.deactivation.sheet);
    if (!matrix) {
      warnings.push(`${config.deactivation.sheet} sheet not found — deactivation series skipped.`);
    } else {
      const { records, warnings: w } = extractWidePivotBlocks(matrix, config.deactivation.sheet, { asOfDate });
      warnings.push(...w);
      const byDate = new Map<string, number>();
      for (const rec of records) byDate.set(rec.date, (byDate.get(rec.date) ?? 0) + rec.value);
      for (const [date, value] of byDate) {
        dailyMetrics.push({
          date,
          sheet: config.deactivation.sheet,
          metricKey: "deactivation.total",
          metricLabel: "Deactivations",
          value,
        });
      }

      const byInterfaceDate = new Map<string, number>();
      for (const rec of records) {
        const iface = rec.dims["Interface"];
        if (!iface) continue;
        const k = `${iface}||${rec.date}`;
        byInterfaceDate.set(k, (byInterfaceDate.get(k) ?? 0) + rec.value);
      }
      for (const [key, value] of byInterfaceDate) {
        const [iface, date] = key.split("||");
        dailyMetrics.push({
          date,
          sheet: config.deactivation.sheet,
          metricKey: `interface.${slugify(iface)}.deactivation`,
          metricLabel: `Deactivations — ${iface}`,
          value,
        });
      }
    }
  }

  // --- Per-interface total volume (the `Interface` sheet has no per-KPI
  // breakdown in these MIS exports — only a combined total per interface —
  // so this is "Total (all KPIs)" by interface, not a per-KPI split). ---
  {
    const matrix = sheetToMatrix(wb, "Interface");
    if (!matrix) {
      warnings.push("Interface sheet not found — per-interface series skipped.");
    } else {
      const { records, warnings: w } = extractWidePivotBlocks(matrix, "Interface", { asOfDate });
      warnings.push(...w);
      const metricTypeDim = findMetricTypeDim(records, ["Interface"]);
      if (!metricTypeDim) {
        warnings.push("Interface sheet: could not find the Count/Revenue column — per-interface series skipped.");
      } else {
        const byKey = new Map<string, number>();
        for (const rec of records) {
          const iface = rec.dims["Interface"];
          const metricType = rec.dims[metricTypeDim]?.toLowerCase();
          if (!iface || (metricType !== "count" && metricType !== "revenue")) continue;
          const key = `${iface}||${metricType}||${rec.date}`;
          byKey.set(key, (byKey.get(key) ?? 0) + rec.value);
        }
        for (const [key, value] of byKey) {
          const [iface, metricType, date] = key.split("||");
          dailyMetrics.push({
            date,
            sheet: "Interface",
            metricKey: `interface.${slugify(iface)}.total_${metricType}`,
            metricLabel: `Total — ${iface} (${metricType === "count" ? "Count" : "Revenue"})`,
            value,
          });
        }
      }
    }
  }

  // --- Transaction-sheet KPI count/revenue series ---
  {
    const matrix = sheetToMatrix(wb, "Transaction");
    if (!matrix) {
      warnings.push("Transaction sheet not found — transaction KPI series skipped.");
    } else {
      const { records, warnings: w } = extractTransactionSeries(matrix);
      warnings.push(...w);
      for (const metric of config.transactionMetrics) {
        for (const [suffix, sourceKeys] of [
          ["count", metric.countMetrics],
          ["revenue", metric.revenueMetrics],
        ] as const) {
          const byDate = new Map<string, number>();
          for (const rec of records) {
            if (rec.granularity !== "day") continue; // trend charts use daily grain only
            if (!sourceKeys.includes(rec.metric)) continue;
            byDate.set(rec.date, (byDate.get(rec.date) ?? 0) + rec.value);
          }
          for (const [date, value] of byDate) {
            dailyMetrics.push({
              date,
              sheet: "Transaction",
              metricKey: `txn.${metric.key}.${suffix}`,
              metricLabel: `${metric.label} (${suffix === "count" ? "Count" : "Revenue"})`,
              value,
            });
          }
        }
      }
    }
  }

  return { asOfDate: asOf?.iso ?? null, kpiRows: kpi.rows, dailyMetrics, warnings };
}
