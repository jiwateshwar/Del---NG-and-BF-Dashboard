import { readFileSync } from "node:fs";
import { loadWorkbook, sheetToMatrix } from "../lib/parser/workbook.ts";
import { extractWidePivotBlocks } from "../lib/parser/wide-pivot.ts";

const files = [
  { label: "Orange Burkina Faso", path: "sample-data/Orange-Burkina Faso.xlsx" },
  { label: "MTN Nigeria", path: "sample-data/MTN Nigeria.xlsx" },
];

const sheets = ["Base", "Deactivation", "Price Point", "Plan", "Interface", "Payment Mode"];

for (const file of files) {
  console.log(`\n========== ${file.label} ==========`);
  const buf = readFileSync(file.path);
  const wb = loadWorkbook(buf);
  for (const sheetName of sheets) {
    const matrix = sheetToMatrix(wb, sheetName);
    if (!matrix) {
      console.log(`  [${sheetName}] sheet not found`);
      continue;
    }
    const { blocks, records, warnings } = extractWidePivotBlocks(matrix, sheetName, {
      asOfDate: { year: 2026, month: 7 },
    });
    console.log(`  [${sheetName}] blocks=${blocks.length} records=${records.length}`);
    for (const b of blocks) {
      console.log(
        `    block#${b.blockIndex} headerRow=${b.headerRow + 1} valueLabel=${JSON.stringify(
          b.valueLabel
        )} dims=${b.dimensionColumns.map((d) => `${d.name}(${d.role})`).join(",")} days=${
          b.dayColumns.length
        }`
      );
    }
    for (const w of warnings) console.log(`    WARN: ${w}`);
    if (records.length > 0) {
      const dates = records.map((r) => r.date).sort();
      console.log(`    date range: ${dates[0]} .. ${dates[dates.length - 1]}`);
      console.log(`    sample record:`, JSON.stringify(records[Math.floor(records.length / 2)]));
    }
  }
}
