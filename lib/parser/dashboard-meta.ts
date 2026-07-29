import { type Matrix } from "./sheet-utils.ts";

/** Finds the MIS snapshot ("as of") date printed near the top of the
 * `Dashboard` sheet — used as the year/month fallback for wide-pivot blocks
 * that carry no Year/Month column of their own (see wide-pivot.ts). */
export function findAsOfDate(matrix: Matrix): { year: number; month: number; day: number; iso: string } | null {
  for (let r = 0; r < Math.min(10, matrix.length); r++) {
    for (const v of matrix[r] ?? []) {
      if (v instanceof Date) {
        return { year: v.getFullYear(), month: v.getMonth() + 1, day: v.getDate(), iso: v.toISOString().slice(0, 10) };
      }
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [y, m, d] = v.split("-").map(Number);
        return { year: y, month: m, day: d, iso: v };
      }
    }
  }
  return null;
}
