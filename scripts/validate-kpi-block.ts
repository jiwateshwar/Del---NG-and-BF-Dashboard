import { readFileSync } from "node:fs";
import { loadWorkbook, sheetToMatrix } from "../lib/parser/workbook.ts";
import { extractDashboardKpis } from "../lib/parser/kpi-block.ts";

const files = [
  { label: "Orange Burkina Faso", path: "sample-data/Orange-Burkina Faso.xlsx" },
  { label: "MTN Nigeria", path: "sample-data/MTN Nigeria.xlsx" },
];

for (const file of files) {
  console.log(`\n========== ${file.label} ==========`);
  const buf = readFileSync(file.path);
  const wb = loadWorkbook(buf);
  const matrix = sheetToMatrix(wb, "Dashboard");
  if (!matrix) {
    console.log("Dashboard sheet not found");
    continue;
  }
  const result = extractDashboardKpis(matrix);
  console.log("headerRow:", result.headerRow !== null ? result.headerRow + 1 : null);
  console.log(
    "groups:",
    result.groups.map((g) => ({ metricType: g.metricType, startCol: g.startCol, fields: g.fields }))
  );
  for (const w of result.warnings) console.log("WARN:", w);
  for (const row of result.rows) {
    console.log(JSON.stringify(row));
  }
}
