import { XLSX, type WorkBook } from "./xlsx-compat.ts";
import type { Matrix, CellValue } from "./sheet-utils.ts";

export function loadWorkbook(buffer: Buffer | ArrayBuffer): WorkBook {
  // Deliberately NOT cellDates:true: SheetJS's serial->Date conversion
  // constructs the JS Date using the *parsing machine's local timezone*,
  // so the same file yields a different (and sometimes off-by-a-day)
  // calendar date depending on where it's parsed. Date cells are handled
  // by converting the raw serial number ourselves (see dashboard-meta.ts),
  // which is timezone-independent.
  return XLSX.read(buffer, { type: "buffer", cellDates: false, sheetStubs: false });
}

export function sheetToMatrix(wb: WorkBook, sheetName: string): Matrix | null {
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;
  const rows = XLSX.utils.sheet_to_json<CellValue[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
  });
  return rows as Matrix;
}
