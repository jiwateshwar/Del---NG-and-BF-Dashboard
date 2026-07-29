import { readFileSync, rmSync, existsSync } from "node:fs";
process.env.DB_PATH = "scripts/.tmp-validate.sqlite";
if (existsSync(process.env.DB_PATH)) rmSync(process.env.DB_PATH);

import { parseWorkbook } from "../lib/parser/parse-workbook.ts";
import { listAccounts } from "../lib/accounts/registry.ts";
import {
  ensureAccounts,
  recordUpload,
  replaceDailyMetrics,
  replaceKpiSnapshots,
  getKpiSnapshots,
  getDailyMetrics,
  getLatestUpload,
} from "../lib/db/client.ts";

const files: Record<string, string> = {
  "orange-burkina-faso": "sample-data/Orange-Burkina Faso.xlsx",
  "mtn-nigeria": "sample-data/MTN Nigeria.xlsx",
};

ensureAccounts(listAccounts());

for (const account of listAccounts()) {
  console.log(`\n========== ${account.displayName} ==========`);
  const buf = readFileSync(files[account.slug]);
  const parsed = parseWorkbook(buf, account);

  recordUpload({
    accountSlug: account.slug,
    originalFilename: files[account.slug],
    asOfDate: parsed.asOfDate,
    metricPointCount: parsed.dailyMetrics.length,
    warnings: parsed.warnings,
  });
  replaceDailyMetrics(account.slug, parsed.dailyMetrics);
  replaceKpiSnapshots(account.slug, parsed.kpiRows, parsed.asOfDate);

  console.log("upload:", getLatestUpload(account.slug));
  console.log("kpi snapshot rows:", getKpiSnapshots(account.slug).length);
  console.log("sample kpi row:", getKpiSnapshots(account.slug)[0]);
  const metrics = getDailyMetrics(account.slug, { metricKeys: ["base.active_base"] });
  console.log("base.active_base rows:", metrics.length, "latest:", metrics[metrics.length - 1]);

  // Re-run the same upload to prove upsert doesn't duplicate rows.
  replaceDailyMetrics(account.slug, parsed.dailyMetrics);
  const metricsAfterReupload = getDailyMetrics(account.slug, { metricKeys: ["base.active_base"] });
  console.log("after re-upload, base.active_base rows:", metricsAfterReupload.length, "(should be unchanged)");
}

rmSync(process.env.DB_PATH);
rmSync(process.env.DB_PATH + "-wal", { force: true });
rmSync(process.env.DB_PATH + "-shm", { force: true });
console.log("\ncleaned up temp db.");
