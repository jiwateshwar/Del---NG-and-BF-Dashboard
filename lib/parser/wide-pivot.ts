// Generic extractor for the "wide day-pivot" sheet shape used throughout these
// MIS workbooks: a header row carries day-of-month integers (1, 2, 3, ...) as
// column headers, preceded by a handful of dimension columns (Year, Month,
// and whatever category columns that account's pivot was built with), and
// rows below are pivot records with the usual merged/blank-means-repeat
// pivot-table behavior. A single sheet can contain more than one such block
// stacked vertically (e.g. MTN's `Base` sheet has a second "Price Point"
// breakup below the main base-by-status block) — each is detected and
// extracted independently.
//
// This does NOT know what "Active Base" or "TRANSACTION_TYPE" means for any
// given account — it only turns the sheet into normalized long-format rows.
// Mapping those raw dimension values to human KPIs is the account config's job.

import {
  type Matrix,
  type CellValue,
  isBlank,
  asNumber,
  asText,
  parseMonth,
  looksLikeTotal,
  isoDate,
  forwardFillColumnValues,
} from "./sheet-utils.ts";

export interface WidePivotRecord {
  sheet: string;
  blockIndex: number;
  valueLabel: string | null;
  date: string;
  dims: Record<string, string>;
  value: number;
}

export interface WidePivotBlock {
  blockIndex: number;
  headerRow: number;
  dataStartRow: number;
  dataEndRow: number;
  valueLabel: string | null;
  dimensionColumns: { colIndex: number; name: string; role: "year" | "month" | "dim" }[];
  dayColumns: { colIndex: number; day: number }[];
  unnamedDimensionColumns: number[];
}

export interface WidePivotResult {
  blocks: WidePivotBlock[];
  records: WidePivotRecord[];
  warnings: string[];
}

const MIN_DAY_RUN_LENGTH = 5;

function findDayHeaderRuns(matrix: Matrix): { row: number; startCol: number; endCol: number }[] {
  const runs: { row: number; startCol: number; endCol: number }[] = [];
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    let runStart = -1;
    let prevDay = -1;
    for (let c = 0; c <= row.length; c++) {
      const v = c < row.length ? row[c] : null;
      const n = typeof v === "number" ? v : null;
      const isDayLike = n !== null && Number.isInteger(n) && n >= 1 && n <= 31 && n > prevDay;
      if (isDayLike) {
        if (runStart === -1) runStart = c;
        prevDay = n as number;
      } else {
        if (runStart !== -1 && c - runStart >= MIN_DAY_RUN_LENGTH) {
          runs.push({ row: r, startCol: runStart, endCol: c - 1 });
        }
        runStart = -1;
        prevDay = -1;
      }
    }
  }
  return runs;
}

const LOOKBACK_WINDOW = 8;

/** True for pivot "filter/slicer" description rows (e.g. `Final Trans Type |
 * (Multiple Items)` or `Year | (All)`) that describe a report filter rather
 * than a value label or a data row. */
function isFilterRow(row: CellValue[]): boolean {
  return row.some((v) => typeof v === "string" && /\((multiple items|all)\)/i.test(v));
}

function findValueLabel(matrix: Matrix, headerRow: number, aroundCol: number): string | null {
  const lowerBound = Math.max(0, headerRow - LOOKBACK_WINDOW);
  for (let r = headerRow - 1; r >= lowerBound; r--) {
    const row = matrix[r] ?? [];
    if (isFilterRow(row)) continue;
    for (let c = Math.max(0, aroundCol - 4); c < row.length; c++) {
      const t = asText(row[c]);
      if (t && !/^day$/i.test(t)) return t;
    }
  }
  return null;
}

/** Looks for an explicit `Year | 2026` style filter cell above the block
 * header, for sheets whose pivot has no per-row Year column at all (the
 * whole block implicitly covers one year, taken from a report filter). */
function findImpliedYear(matrix: Matrix, headerRow: number): number | null {
  const lowerBound = Math.max(0, headerRow - LOOKBACK_WINDOW);
  for (let r = headerRow - 1; r >= lowerBound; r--) {
    const row = matrix[r] ?? [];
    for (let c = 0; c < row.length - 1; c++) {
      if (typeof row[c] === "string" && /^year$/i.test(row[c] as string)) {
        const n = asNumber(row[c + 1]);
        if (n !== null && n >= 1900 && n <= 2100) return n;
      }
    }
  }
  return null;
}

export interface ExtractWidePivotOptions {
  /** Fallback period for blocks whose pivot has no per-row Year/Month column
   * at all (the whole block is implicitly "as of" a single month) — normally
   * the MIS snapshot date read off the `Dashboard` sheet. */
  asOfDate?: { year: number; month: number };
}

export function extractWidePivotBlocks(
  matrix: Matrix,
  sheetName: string,
  opts: ExtractWidePivotOptions = {}
): WidePivotResult {
  const warnings: string[] = [];
  const runs = findDayHeaderRuns(matrix);
  const blocks: WidePivotBlock[] = [];
  const records: WidePivotRecord[] = [];

  runs.forEach((run, blockIndex) => {
    const headerRow = run.row;
    const dataStartRow = headerRow + 1;
    const nextHeaderRow = runs[blockIndex + 1]?.row ?? matrix.length;
    const dataEndRow = nextHeaderRow - 1;

    const dayColumns: { colIndex: number; day: number }[] = [];
    for (let c = run.startCol; c <= run.endCol; c++) {
      const v = matrix[headerRow][c];
      if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 31) {
        dayColumns.push({ colIndex: c, day: v });
      }
    }

    // Candidate dimension columns: everything left of the day-column run
    // that has *some* non-blank value either in the header row or anywhere
    // in the block's data rows (skips pure spacer columns).
    const dimensionColumns: WidePivotBlock["dimensionColumns"] = [];
    const unnamedDimensionColumns: number[] = [];
    for (let c = 0; c < run.startCol; c++) {
      let hasValue = !isBlank(matrix[headerRow][c]);
      if (!hasValue) {
        for (let r = dataStartRow; r <= Math.min(dataEndRow, matrix.length - 1); r++) {
          if (!isBlank(matrix[r]?.[c])) {
            hasValue = true;
            break;
          }
        }
      }
      if (!hasValue) continue;

      const headerText = asText(matrix[headerRow][c]);
      let role: "year" | "month" | "dim" = "dim";
      if (/^year$/i.test(headerText)) role = "year";
      else if (/month/i.test(headerText)) role = "month";

      const name = headerText || `col_${c}`;
      if (!headerText) unnamedDimensionColumns.push(c);
      dimensionColumns.push({ colIndex: c, name, role });
    }

    const yearCol = dimensionColumns.find((d) => d.role === "year");
    const monthCol = dimensionColumns.find((d) => d.role === "month");

    // Some pivots (e.g. a "current month only" base-count snapshot) carry no
    // per-row Year/Month at all — fall back to an in-sheet `Year | 2026`
    // filter cell and/or the caller-supplied as-of date.
    const impliedYear = !yearCol ? findImpliedYear(matrix, headerRow) ?? opts.asOfDate?.year ?? null : null;
    const impliedMonth = !monthCol ? opts.asOfDate?.month ?? null : null;

    if ((!yearCol && impliedYear === null) || (!monthCol && impliedMonth === null)) {
      warnings.push(
        `${sheetName}: block at row ${headerRow + 1} has no recognizable Year/Month column and no ` +
          `as-of-date fallback available — skipped.`
      );
      return;
    }

    if (!yearCol) {
      warnings.push(
        `${sheetName}: block at row ${headerRow + 1} has no Year column — assuming year ${impliedYear} for all rows.`
      );
    }
    if (!monthCol) {
      warnings.push(
        `${sheetName}: block at row ${headerRow + 1} has no Month column — assuming month ${impliedMonth} (as-of date) for all rows.`
      );
    }

    const valueLabel = findValueLabel(matrix, headerRow, run.startCol);

    blocks.push({
      blockIndex,
      headerRow,
      dataStartRow,
      dataEndRow,
      valueLabel,
      dimensionColumns,
      dayColumns,
      unnamedDimensionColumns,
    });

    if (unnamedDimensionColumns.length > 0) {
      warnings.push(
        `${sheetName}: block at row ${headerRow + 1} has unnamed dimension column(s) at index ` +
          `${unnamedDimensionColumns.join(", ")} — captured as col_N, verify in account config.`
      );
    }

    const filled: Record<number, CellValue[]> = {};
    for (const dim of dimensionColumns) {
      filled[dim.colIndex] = forwardFillColumnValues(
        matrix,
        dim.colIndex,
        dataStartRow,
        Math.min(dataEndRow, matrix.length - 1)
      );
    }

    for (let r = dataStartRow; r <= Math.min(dataEndRow, matrix.length - 1); r++) {
      const offset = r - dataStartRow;
      const rawRow = matrix[r] ?? [];

      const isTotalRow = dimensionColumns.some((dim) => looksLikeTotal(rawRow[dim.colIndex]));
      if (isTotalRow) continue;

      const yearVal = yearCol ? asNumber(filled[yearCol.colIndex][offset]) : impliedYear;
      const monthVal = monthCol ? parseMonth(filled[monthCol.colIndex][offset]) : impliedMonth;
      if (yearVal === null || monthVal === null) continue;

      const dims: Record<string, string> = {};
      for (const dim of dimensionColumns) {
        if (dim === yearCol || dim === monthCol) continue;
        const v = filled[dim.colIndex][offset];
        if (!isBlank(v)) dims[dim.name] = asText(v);
      }

      // Excel pads a wide pivot's day columns out to the full 1-31 grid
      // regardless of how many days have actually happened, showing a
      // literal 0 rather than blank for not-yet-reached days at the end of
      // the current month. A trailing run of exact zeros right after a
      // non-zero value on the same row is that padding, not real data — a
      // row that's genuinely zero from day 1 (no trailing non-zero before
      // it) is left untouched.
      const rowValues = dayColumns.map(({ colIndex, day }) => ({ day, colIndex, value: asNumber(rawRow[colIndex]) }));
      let trailingPaddingStart = rowValues.length;
      for (let i = rowValues.length - 1; i >= 0; i--) {
        if (rowValues[i].value === 0) trailingPaddingStart = i;
        else break;
      }
      const hasRealValueBeforePadding = rowValues.slice(0, trailingPaddingStart).some((r) => (r.value ?? 0) !== 0);
      const paddingCutoff = hasRealValueBeforePadding ? trailingPaddingStart : rowValues.length;

      rowValues.slice(0, paddingCutoff).forEach(({ day, value }) => {
        if (value === null) return;
        records.push({
          sheet: sheetName,
          blockIndex,
          valueLabel,
          date: isoDate(yearVal, monthVal, day),
          dims,
          value,
        });
      });
    }
  });

  return { blocks, records, warnings };
}
