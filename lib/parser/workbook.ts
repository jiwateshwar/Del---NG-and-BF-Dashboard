import * as XLSX from "xlsx";
import type { Matrix, CellValue } from "./sheet-utils.ts";

export function loadWorkbook(buffer: Buffer | ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "buffer", cellDates: true, sheetStubs: false });
}

export function sheetToMatrix(wb: XLSX.WorkBook, sheetName: string): Matrix | null {
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;
  const rows = XLSX.utils.sheet_to_json<CellValue[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
  });
  return rows as Matrix;
}
