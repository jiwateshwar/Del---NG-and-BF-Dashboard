// Extractor for the `Dashboard` sheet's KPI summary table. The table repeats
// the same set of column headers (LMTD, MTD, LMTD/MTD Growth %, Last Month,
// <Month> Proj, Growth %) once per metric group (Count, Revenue), and column
// *positions* shift between accounts (Orange's table starts at column D,
// MTN's at column B) — so everything here is located by header text, never
// by a fixed column index.

import { type Matrix, type CellValue, isBlank, asNumber, asText, forwardFillLeft } from "./sheet-utils.ts";

export type KpiField =
  | "lmtd"
  | "mtd"
  | "lmtd_mtd_growth_pct"
  | "last_month"
  | "month_proj"
  | "month_proj_growth_pct";

export interface KpiGroup {
  metricType: string; // whatever label was found above the group, e.g. "Count" or "Revenue"
  startCol: number;
  fields: Partial<Record<KpiField, number>>; // field -> column index
}

export type KpiFieldValues = Partial<Record<KpiField, number | null>>;

export interface KpiRow {
  label: string;
  values: Record<string, KpiFieldValues>; // metricType -> field -> value
}

export interface KpiBlockResult {
  headerRow: number | null;
  groups: KpiGroup[];
  rows: KpiRow[];
  warnings: string[];
}

function classifyField(label: string): KpiField | null {
  const t = label.trim().toLowerCase();
  if (/lmtd/.test(t) && /mtd/.test(t) && /gr(ow|wo)th/.test(t)) return "lmtd_mtd_growth_pct";
  if (t === "lmtd") return "lmtd";
  if (t === "mtd") return "mtd";
  if (/last\s*month/.test(t)) return "last_month";
  if (/proj/.test(t)) return "month_proj";
  if (/gr(ow|wo)th/.test(t)) return "month_proj_growth_pct";
  return null;
}

export function extractDashboardKpis(matrix: Matrix, sheetName = "Dashboard"): KpiBlockResult {
  const warnings: string[] = [];

  let headerRow: number | null = null;
  const lmtdCols: number[] = [];
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const cols = row
      .map((v, c) => ({ v, c }))
      .filter(({ v }) => typeof v === "string" && v.trim().toLowerCase() === "lmtd")
      .map(({ c }) => c);
    if (cols.length > 0) {
      headerRow = r;
      lmtdCols.push(...cols);
      break;
    }
  }

  if (headerRow === null) {
    warnings.push(`${sheetName}: no KPI header row found (looked for a cell reading "LMTD").`);
    return { headerRow: null, groups: [], rows: [], warnings };
  }

  const headerCells = matrix[headerRow] ?? [];
  const metricLabelRow = forwardFillLeft((matrix[headerRow - 1] ?? []).map((v) => v));

  const groups: KpiGroup[] = lmtdCols.map((startCol, i) => {
    const endCol = i + 1 < lmtdCols.length ? lmtdCols[i + 1] - 1 : headerCells.length - 1;
    const fields: Partial<Record<KpiField, number>> = {};
    for (let c = startCol; c <= endCol; c++) {
      const label = asText(headerCells[c]);
      if (!label) continue;
      const field = classifyField(label);
      if (field && !(field in fields)) fields[field] = c;
      else if (!field) {
        warnings.push(`${sheetName}: unrecognized KPI column header "${label}" at column ${c} — ignored.`);
      }
    }
    const metricType = asText(metricLabelRow[startCol]) || `group_${i}`;
    return { metricType, startCol, fields };
  });

  const firstGroupStart = lmtdCols[0];
  const rows: KpiRow[] = [];
  let blankStreak = 0;
  for (let r = headerRow + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    let label = "";
    for (let c = 0; c < firstGroupStart; c++) {
      const t = asText(row[c]);
      if (t) {
        label = t;
        break;
      }
    }

    const hasAnyGroupValue = groups.some((g) =>
      Object.values(g.fields).some((c) => !isBlank(row[c as number]))
    );

    if (!label && !hasAnyGroupValue) {
      blankStreak++;
      if (blankStreak >= 2) break;
      continue;
    }
    blankStreak = 0;
    if (!label) continue;

    const values: KpiRow["values"] = {};
    for (const group of groups) {
      const fieldValues: Partial<Record<KpiField, number | null>> = {};
      for (const [field, colIndex] of Object.entries(group.fields) as [KpiField, number][]) {
        fieldValues[field] = asNumber(row[colIndex]);
      }
      values[group.metricType] = fieldValues;
    }
    rows.push({ label, values });
  }

  return { headerRow, groups, rows, warnings };
}
