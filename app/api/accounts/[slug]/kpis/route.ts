import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/db/bootstrap";
import { getAccount } from "@/lib/accounts/registry";
import { getKpiSnapshots, getLatestUpload, getMetricMaxValues, getDailyMetrics } from "@/lib/db/client";

interface BenchmarkSide {
  latest: number | null;
  best: number | null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  bootstrap();
  const { slug } = await params;
  const account = getAccount(slug);
  if (!account) {
    return NextResponse.json({ error: `Unknown account "${slug}"` }, { status: 404 });
  }

  const rows = getKpiSnapshots(slug);
  const upload = getLatestUpload(slug);

  // Map each Dashboard KPI row (by its exact label) to the daily metric keys
  // that carry its history, so we can attach a "today vs. best day ever"
  // benchmark — only KPIs the account config tracks a daily series for get
  // one (Inv-Churn/Vol-Churn have no daily breakdown in these MIS exports).
  const benchmarkKeysByLabel = new Map<string, { count?: string; revenue?: string }>();
  for (const m of account.transactionMetrics) {
    benchmarkKeysByLabel.set(m.label, { count: `txn.${m.key}.count`, revenue: `txn.${m.key}.revenue` });
  }
  for (const s of account.base?.series ?? []) {
    benchmarkKeysByLabel.set(s.label, { count: `base.${s.key}` });
  }
  const allBenchmarkKeys = Array.from(benchmarkKeysByLabel.values()).flatMap((k) =>
    [k.count, k.revenue].filter((x): x is string => !!x)
  );
  const maxValues = getMetricMaxValues(slug, allBenchmarkKeys);
  const dailyRows = getDailyMetrics(slug, { metricKeys: allBenchmarkKeys }); // ascending by date
  const latestByKey = new Map<string, number>();
  for (const row of dailyRows) latestByKey.set(row.metric_key, row.value); // last write wins (ascending order)

  function benchmarkFor(key: string | undefined): BenchmarkSide {
    if (!key) return { latest: null, best: null };
    return { latest: latestByKey.get(key) ?? null, best: maxValues[key] ?? null };
  }

  const byLabel = new Map<
    string,
    {
      label: string;
      metrics: Record<string, (typeof rows)[number]>;
      benchmark: { count: BenchmarkSide; revenue: BenchmarkSide };
    }
  >();
  for (const row of rows) {
    if (!byLabel.has(row.kpi_label)) {
      const keys = benchmarkKeysByLabel.get(row.kpi_label);
      byLabel.set(row.kpi_label, {
        label: row.kpi_label,
        metrics: {},
        benchmark: { count: benchmarkFor(keys?.count), revenue: benchmarkFor(keys?.revenue) },
      });
    }
    byLabel.get(row.kpi_label)!.metrics[row.metric_type] = row;
  }

  return NextResponse.json({
    asOfDate: upload?.as_of_date ?? null,
    kpis: Array.from(byLabel.values()),
  });
}
