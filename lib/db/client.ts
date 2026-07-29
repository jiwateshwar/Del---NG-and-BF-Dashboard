import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { AccountConfig } from "../accounts/types.ts";
import type { DailyMetricPoint } from "../parser/parse-workbook.ts";
import type { KpiRow } from "../parser/kpi-block.ts";
import { SCHEMA_SQL } from "./schema.ts";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "app.sqlite");

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA_SQL);
  return db;
}

export function ensureAccounts(accounts: AccountConfig[]): void {
  const database = getDb();
  const stmt = database.prepare(
    "INSERT INTO accounts (slug, display_name) VALUES (?, ?) ON CONFLICT(slug) DO UPDATE SET display_name = excluded.display_name"
  );
  for (const a of accounts) stmt.run(a.slug, a.displayName);
}

export interface RecordUploadParams {
  accountSlug: string;
  originalFilename: string;
  asOfDate: string | null;
  metricPointCount: number;
  warnings: string[];
}

export function recordUpload(params: RecordUploadParams): number {
  const database = getDb();
  const stmt = database.prepare(
    `INSERT INTO uploads (account_slug, original_filename, uploaded_at, as_of_date, metric_point_count, warnings_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    params.accountSlug,
    params.originalFilename,
    new Date().toISOString(),
    params.asOfDate,
    params.metricPointCount,
    JSON.stringify(params.warnings)
  );
  return Number(result.lastInsertRowid);
}

export function replaceDailyMetrics(accountSlug: string, points: DailyMetricPoint[]): void {
  const database = getDb();
  const stmt = database.prepare(
    `INSERT INTO daily_metrics (account_slug, date, metric_key, metric_label, sheet, value)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_slug, date, metric_key) DO UPDATE SET
       metric_label = excluded.metric_label,
       sheet = excluded.sheet,
       value = excluded.value`
  );
  database.exec("BEGIN");
  try {
    for (const p of points) {
      stmt.run(accountSlug, p.date, p.metricKey, p.metricLabel, p.sheet, p.value);
    }
    database.exec("COMMIT");
  } catch (err) {
    database.exec("ROLLBACK");
    throw err;
  }
}

export function replaceKpiSnapshots(accountSlug: string, rows: KpiRow[], asOfDate: string | null): void {
  const database = getDb();
  const del = database.prepare("DELETE FROM kpi_snapshots WHERE account_slug = ?");
  const insert = database.prepare(
    `INSERT INTO kpi_snapshots
       (account_slug, kpi_label, metric_type, as_of_date, lmtd, mtd, lmtd_mtd_growth_pct, last_month, month_proj, month_proj_growth_pct)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  database.exec("BEGIN");
  try {
    del.run(accountSlug);
    for (const row of rows) {
      for (const [metricType, fields] of Object.entries(row.values)) {
        insert.run(
          accountSlug,
          row.label,
          metricType,
          asOfDate,
          fields.lmtd ?? null,
          fields.mtd ?? null,
          fields.lmtd_mtd_growth_pct ?? null,
          fields.last_month ?? null,
          fields.month_proj ?? null,
          fields.month_proj_growth_pct ?? null
        );
      }
    }
    database.exec("COMMIT");
  } catch (err) {
    database.exec("ROLLBACK");
    throw err;
  }
}

export interface KpiSnapshotRow {
  kpi_label: string;
  metric_type: string;
  as_of_date: string | null;
  lmtd: number | null;
  mtd: number | null;
  lmtd_mtd_growth_pct: number | null;
  last_month: number | null;
  month_proj: number | null;
  month_proj_growth_pct: number | null;
}

export function getKpiSnapshots(accountSlug: string): KpiSnapshotRow[] {
  const database = getDb();
  const stmt = database.prepare(
    "SELECT kpi_label, metric_type, as_of_date, lmtd, mtd, lmtd_mtd_growth_pct, last_month, month_proj, month_proj_growth_pct FROM kpi_snapshots WHERE account_slug = ?"
  );
  return stmt.all(accountSlug) as unknown as KpiSnapshotRow[];
}

export interface DailyMetricRow {
  date: string;
  metric_key: string;
  metric_label: string;
  sheet: string;
  value: number;
}

export function getDailyMetrics(
  accountSlug: string,
  opts: { from?: string; to?: string; metricKeys?: string[] } = {}
): DailyMetricRow[] {
  const database = getDb();
  const clauses = ["account_slug = ?"];
  const args: (string | number)[] = [accountSlug];

  if (opts.from) {
    clauses.push("date >= ?");
    args.push(opts.from);
  }
  if (opts.to) {
    clauses.push("date <= ?");
    args.push(opts.to);
  }
  if (opts.metricKeys && opts.metricKeys.length > 0) {
    clauses.push(`metric_key IN (${opts.metricKeys.map(() => "?").join(",")})`);
    args.push(...opts.metricKeys);
  }

  const stmt = database.prepare(
    `SELECT date, metric_key, metric_label, sheet, value FROM daily_metrics WHERE ${clauses.join(" AND ")} ORDER BY date ASC`
  );
  return stmt.all(...args) as unknown as DailyMetricRow[];
}

export interface UploadRow {
  id: number;
  account_slug: string;
  original_filename: string;
  uploaded_at: string;
  as_of_date: string | null;
  metric_point_count: number;
  warnings_json: string;
}

export function getLatestUpload(accountSlug: string): UploadRow | null {
  const database = getDb();
  const stmt = database.prepare(
    "SELECT * FROM uploads WHERE account_slug = ? ORDER BY uploaded_at DESC LIMIT 1"
  );
  return (stmt.get(accountSlug) as unknown as UploadRow) ?? null;
}
