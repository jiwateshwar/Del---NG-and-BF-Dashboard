export interface AccountSummary {
  slug: string;
  displayName: string;
  latestUpload: {
    id: number;
    original_filename: string;
    uploaded_at: string;
    as_of_date: string | null;
    metric_point_count: number;
    warnings_json: string;
  } | null;
}

export interface KpiFieldValues {
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

export interface KpiEntry {
  label: string;
  metrics: Record<string, KpiFieldValues>;
}

export interface KpisResponse {
  asOfDate: string | null;
  kpis: KpiEntry[];
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface Series {
  metricKey: string;
  metricLabel: string;
  points: SeriesPoint[];
}

export interface MetricsResponse {
  granularity: "daily" | "weekly";
  series: Series[];
}

export interface UploadResponse {
  uploadId: number;
  asOfDate: string | null;
  metricPointCount: number;
  kpiRowCount: number;
  warnings: string[];
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.json();
}

export function fetchAccounts(): Promise<{ accounts: AccountSummary[] }> {
  return fetch("/api/accounts").then((r) => asJson(r));
}

export function fetchKpis(slug: string): Promise<KpisResponse> {
  return fetch(`/api/accounts/${slug}/kpis`).then((r) => asJson(r));
}

export function fetchMetrics(
  slug: string,
  opts: { granularity: "daily" | "weekly"; from?: string; to?: string; metricKeys?: string[] }
): Promise<MetricsResponse> {
  const params = new URLSearchParams({ granularity: opts.granularity });
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.metricKeys?.length) params.set("metricKeys", opts.metricKeys.join(","));
  return fetch(`/api/accounts/${slug}/metrics?${params.toString()}`).then((r) => asJson(r));
}

export async function uploadWorkbook(slug: string, file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/accounts/${slug}/upload`, { method: "POST", body: form });
  return asJson(res);
}
