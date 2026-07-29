// Extractor for the `Transaction` sheet's hybrid shape: one row per
// historical month (aggregated, `Day` blank) plus one row per day for the
// current month, with metric columns disambiguated by 1-2 group-header rows
// stacked directly above the Year/Month Name/Day header row (e.g.
// "SUBSCRIPTION"/"TONE" over "New Sub"/"Renewal" over the day-level values).
// Column order, group labels, and metric names all vary between accounts, so
// everything is located by header text and composed into a per-column key
// rather than assumed by position.

import {
  type Matrix,
  type CellValue,
  isBlank,
  asNumber,
  asText,
  parseMonth,
  looksLikeTotal,
  isoDate,
  forwardFillLeft,
  forwardFillColumnValues,
} from "./sheet-utils.ts";

export interface TransactionRecord {
  sheet: string;
  date: string;
  granularity: "day" | "month";
  metric: string;
  value: number;
}

export interface TransactionResult {
  headerRow: number | null;
  metricColumns: Record<number, string>;
  records: TransactionRecord[];
  warnings: string[];
}

const GROUP_LOOKBACK_ROWS = 2;

function findHeaderRow(matrix: Matrix): number | null {
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const hasYear = row.some((v) => typeof v === "string" && /^year$/i.test(v));
    const hasDay = row.some((v) => typeof v === "string" && /^day$/i.test(v));
    if (hasYear && hasDay) return r;
  }
  return null;
}

export function extractTransactionSeries(
  matrix: Matrix,
  sheetName = "Transaction"
): TransactionResult {
  const warnings: string[] = [];
  const headerRow = findHeaderRow(matrix);
  if (headerRow === null) {
    warnings.push(`${sheetName}: no Year/Day header row found — sheet skipped.`);
    return { headerRow: null, metricColumns: {}, records: [], warnings };
  }

  const headerCells = matrix[headerRow] ?? [];
  const yearCol = headerCells.findIndex((v) => typeof v === "string" && /^year$/i.test(v));
  const monthCol = headerCells.findIndex((v) => typeof v === "string" && /month/i.test(v));
  const dayCol = headerCells.findIndex((v) => typeof v === "string" && /^day$/i.test(v));

  if (yearCol === -1 || monthCol === -1 || dayCol === -1) {
    warnings.push(`${sheetName}: header row found but missing Year/Month/Day column — sheet skipped.`);
    return { headerRow, metricColumns: {}, records: [], warnings };
  }

  const groupRows: CellValue[][] = [];
  for (let i = 1; i <= GROUP_LOOKBACK_ROWS; i++) {
    const r = headerRow - i;
    if (r < 0) break;
    groupRows.unshift(forwardFillLeft(matrix[r] ?? []));
  }

  const dataStart = headerRow + 1;
  const reserved = new Set([yearCol, monthCol, dayCol]);
  const metricColumns: Record<number, string> = {};
  const maxCol = Math.max(headerCells.length, ...matrix.slice(dataStart).map((r) => r.length));

  for (let c = 0; c < maxCol; c++) {
    if (reserved.has(c)) continue;
    const hasData = matrix.slice(dataStart).some((row) => !isBlank(row?.[c]));
    if (!hasData) continue;

    const levels: string[] = [];
    for (const groupRow of groupRows) {
      const t = asText(groupRow[c]);
      if (t && !levels.includes(t)) levels.push(t);
    }
    const own = asText(headerCells[c]);
    if (own && !levels.includes(own)) levels.push(own);

    // A "Total ..." label is already self-describing — don't let an
    // unrelated group qualifier from a higher header row (e.g. "TONE",
    // inherited via left-fill only because this column has no group label
    // of its own) tack onto it.
    const totalLevel = levels.find((l) => /total/i.test(l));

    if (levels.length === 0) {
      metricColumns[c] = `col_${c}`;
      warnings.push(`${sheetName}: metric column ${c} has no header text at any level — using col_${c}.`);
    } else if (totalLevel) {
      metricColumns[c] = totalLevel;
    } else {
      metricColumns[c] = levels.join(" / ");
    }
  }

  const filledYear = forwardFillColumnValues(matrix, yearCol, dataStart, matrix.length - 1);
  const filledMonth = forwardFillColumnValues(matrix, monthCol, dataStart, matrix.length - 1);

  const records: TransactionRecord[] = [];
  for (let r = dataStart; r < matrix.length; r++) {
    const offset = r - dataStart;
    const row = matrix[r] ?? [];

    const isTotalRow =
      looksLikeTotal(filledMonth[offset]) || looksLikeTotal(row[dayCol]) || looksLikeTotal(row[monthCol]);
    if (isTotalRow) continue;

    const year = asNumber(filledYear[offset]);
    const month = parseMonth(filledMonth[offset]);
    if (year === null || month === null) continue;

    const dayVal = asNumber(row[dayCol]);
    const granularity: "day" | "month" = dayVal !== null ? "day" : "month";
    const date = isoDate(year, month, dayVal !== null ? dayVal : 1);

    for (const [colStr, metricName] of Object.entries(metricColumns)) {
      const c = Number(colStr);
      const value = asNumber(row[c]);
      if (value === null) continue;
      records.push({ sheet: sheetName, date, granularity, metric: metricName, value });
    }
  }

  return { headerRow, metricColumns, records, warnings };
}
