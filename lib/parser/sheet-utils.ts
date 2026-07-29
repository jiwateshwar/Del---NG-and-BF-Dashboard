// Small helpers shared by every sheet-shape extractor. Kept independent of any
// particular sheet's structure so the same primitives work across accounts
// whose pivot layouts differ (column offsets, dimension names, category values).

export type CellValue = string | number | Date | null;
export type Matrix = CellValue[][];

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export function isBlank(v: CellValue): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

export function asText(v: CellValue): string {
  return isBlank(v) ? "" : String(v).trim();
}

export function asNumber(v: CellValue): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (trimmed === "" || trimmed === "-") return null;
    const n = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function looksLikeTotal(v: CellValue): boolean {
  return typeof v === "string" && /\btotal\b/i.test(v);
}

/** Parses a month name/number cell into a 1-12 month number, or null. */
export function parseMonth(v: CellValue): number | null {
  if (typeof v === "number" && v >= 1 && v <= 12) return v;
  const t = asText(v).toLowerCase();
  if (t in MONTH_NAMES) return MONTH_NAMES[t];
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  return null;
}

export function isoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Forward-fills blank cells within a single row, left to right (used for
 * merged group-header rows like "SUBSCRIPTION","","TONE","" → group spans). */
export function forwardFillLeft(row: CellValue[]): CellValue[] {
  const out: CellValue[] = [];
  let last: CellValue = null;
  for (const v of row) {
    if (!isBlank(v)) last = v;
    out.push(last);
  }
  return out;
}

/** Forward-fills blank cells within a single column across rows, top to
 * bottom (used for merged pivot row labels like Year/Month/dimension cells
 * that only show a value on the first row of their group). */
export function forwardFillColumnValues(
  matrix: Matrix,
  colIndex: number,
  startRow: number,
  endRow: number
): CellValue[] {
  const out: CellValue[] = [];
  let last: CellValue = null;
  for (let r = startRow; r <= endRow; r++) {
    const v = matrix[r]?.[colIndex] ?? null;
    if (!isBlank(v)) last = v;
    out.push(last);
  }
  return out;
}
