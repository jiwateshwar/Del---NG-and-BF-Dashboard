// Kept as a TS string constant (not a loose .sql file read via fs) so it
// travels correctly through Next's standalone output tracing for Docker.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS accounts (
  slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_slug TEXT NOT NULL REFERENCES accounts(slug),
  original_filename TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  as_of_date TEXT,
  metric_point_count INTEGER NOT NULL,
  warnings_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_uploads_account ON uploads(account_slug, uploaded_at);

-- One row per (account, date, metric). Upserted on every upload so a later
-- file that restates a historical value simply overwrites it — no merge
-- logic needed since each MIS export contains the full history already.
CREATE TABLE IF NOT EXISTS daily_metrics (
  account_slug TEXT NOT NULL,
  date TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  sheet TEXT NOT NULL,
  value REAL NOT NULL,
  PRIMARY KEY (account_slug, date, metric_key)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_account_date ON daily_metrics(account_slug, date);

-- Latest Dashboard-sheet KPI summary (LMTD/MTD/Growth/Last Month/Month
-- Proj) per KPI row + metric type (Count/Revenue). Only ever holds the most
-- recent upload's snapshot — the daily_metrics table is what carries history.
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  account_slug TEXT NOT NULL,
  kpi_label TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  as_of_date TEXT,
  lmtd REAL,
  mtd REAL,
  lmtd_mtd_growth_pct REAL,
  last_month REAL,
  month_proj REAL,
  month_proj_growth_pct REAL,
  PRIMARY KEY (account_slug, kpi_label, metric_type)
);
`;
