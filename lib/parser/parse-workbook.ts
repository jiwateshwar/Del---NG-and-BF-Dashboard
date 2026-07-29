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

  // --- Deactivation (summed across all dimensions per date) ---
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
