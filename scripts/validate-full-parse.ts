import { readFileSync } from "node:fs";
import { parseWorkbook } from "../lib/parser/parse-workbook.ts";
import { listAccounts } from "../lib/accounts/registry.ts";

const files: Record<string, string> = {
  "orange-burkina-faso": "sample-data/Orange-Burkina Faso.xlsx",
  "mtn-nigeria": "sample-data/MTN Nigeria.xlsx",
};

for (const account of listAccounts()) {
  console.log(`\n========== ${account.displayName} (${account.slug}) ==========`);
  const path = files[account.slug];
  const buf = readFileSync(path);
  const result = parseWorkbook(buf, account);

  console.log("asOfDate:", result.asOfDate);
  console.log("warnings:", result.warnings.length);
  for (const w of result.warnings) console.log("  WARN:", w);

  console.log("\nKPI rows:");
  for (const row of result.kpiRows) {
    const count = row.values["Count"];
    const revenue = row.values["Revenue"];
    console.log(
      `  ${row.label}: count.mtd=${count?.mtd} count.lmtd=${count?.lmtd} revenue.mtd=${revenue?.mtd}`
    );
  }

  console.log(`\ndailyMetrics: ${result.dailyMetrics.length} points`);
  const byKey = new Map<string, typeof result.dailyMetrics>();
  for (const m of result.dailyMetrics) {
    if (!byKey.has(m.metricKey)) byKey.set(m.metricKey, []);
    byKey.get(m.metricKey)!.push(m);
  }
  for (const [key, points] of byKey) {
    const dates = points.map((p) => p.date).sort();
    const latest = points.find((p) => p.date === dates[dates.length - 1]);
    console.log(
      `  ${key} (${points.length} pts, ${dates[0]}..${dates[dates.length - 1]}) latest=${latest?.value}`
    );
  }
}
