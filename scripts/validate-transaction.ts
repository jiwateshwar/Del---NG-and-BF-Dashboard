import { readFileSync } from "node:fs";
import { loadWorkbook, sheetToMatrix } from "../lib/parser/workbook.ts";
import { extractTransactionSeries, type TransactionRecord } from "../lib/parser/transaction-sheet.ts";

const files = [
  { label: "Orange Burkina Faso", path: "sample-data/Orange-Burkina Faso.xlsx" },
  { label: "MTN Nigeria", path: "sample-data/MTN Nigeria.xlsx" },
];

for (const file of files) {
  console.log(`\n========== ${file.label} ==========`);
  const buf = readFileSync(file.path);
  const wb = loadWorkbook(buf);
  const matrix = sheetToMatrix(wb, "Transaction");
  if (!matrix) {
    console.log("Transaction sheet not found");
    continue;
  }
  const { headerRow, metricColumns, records, warnings } = extractTransactionSeries(matrix);
  console.log("headerRow:", headerRow !== null ? headerRow + 1 : null);
  console.log("metricColumns:", metricColumns);
  for (const w of warnings) console.log("WARN:", w);
  console.log("total records:", records.length);

  const byMetric = new Map<string, TransactionRecord[]>();
  for (const rec of records) {
    if (!byMetric.has(rec.metric)) byMetric.set(rec.metric, []);
    byMetric.get(rec.metric)!.push(rec);
  }
  for (const [metric, recs] of byMetric) {
    const dayRecs = recs.filter((r) => r.granularity === "day");
    const monthRecs = recs.filter((r) => r.granularity === "month");
    console.log(`  metric="${metric}" day=${dayRecs.length} month=${monthRecs.length}`);
    if (monthRecs.length) console.log("    sample month rec:", JSON.stringify(monthRecs[0]));
    if (dayRecs.length) console.log("    sample day rec:", JSON.stringify(dayRecs[dayRecs.length - 1]));
  }
}
