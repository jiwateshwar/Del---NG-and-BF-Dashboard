import { XLSX } from "./xlsx-compat.ts";
import { type Matrix, isoDate } from "./sheet-utils.ts";

// Excel date serials for any plausible MIS snapshot date (roughly 2010-2100).
const MIN_SERIAL = 40000;
const MAX_SERIAL = 73050;

/** Finds the MIS snapshot ("as of") date printed near the top of the
 * `Dashboard` sheet — used as the year/month fallback for wide-pivot blocks
 * that carry no Year/Month column of their own (see wide-pivot.ts).
 *
 * Converts the raw Excel serial number via SheetJS's SSF date-code parser
 * rather than a JS `Date` — `cellDates`-style conversion builds the Date
 * using the parsing machine's local timezone, which silently shifts the
 * calendar date by a day depending on where the code runs (verified: the
 * same file parses to a different day under IST vs UTC). This path never
 * constructs a `Date`, so it's identical on every machine/container. */
export function findAsOfDate(matrix: Matrix): { year: number; month: number; day: number; iso: string } | null {
  for (let r = 0; r < Math.min(10, matrix.length); r++) {
    for (const v of matrix[r] ?? []) {
      if (typeof v === "number" && v >= MIN_SERIAL && v <= MAX_SERIAL) {
        const d = XLSX.SSF.parse_date_code(v);
        if (d) return { year: d.y, month: d.m, day: d.d, iso: isoDate(d.y, d.m, d.d) };
      }
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [y, m, d] = v.split("-").map(Number);
        return { year: y, month: m, day: d, iso: v };
      }
    }
  }
  return null;
}
