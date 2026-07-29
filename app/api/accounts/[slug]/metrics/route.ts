import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/db/bootstrap";
import { getAccount } from "@/lib/accounts/registry";
import { getDailyMetrics, getMetricMaxValues } from "@/lib/db/client";
import { toDailySeries, toWeeklySeries } from "@/lib/metrics/aggregate";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  bootstrap();
  const { slug } = await params;
  const account = getAccount(slug);
  if (!account) {
    return NextResponse.json({ error: `Unknown account "${slug}"` }, { status: 404 });
  }

  const url = new URL(request.url);
  const granularity = url.searchParams.get("granularity") === "weekly" ? "weekly" : "daily";
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const metricKeysParam = url.searchParams.get("metricKeys");
  const metricKeys = metricKeysParam ? metricKeysParam.split(",").filter(Boolean) : undefined;

  const rows = getDailyMetrics(slug, { from, to, metricKeys });
  const series = granularity === "weekly" ? toWeeklySeries(rows) : toDailySeries(rows);

  // "Best day ever" benchmark: the all-time daily max, independent of the
  // currently-displayed date range/granularity.
  const allTimeMax = getMetricMaxValues(slug, metricKeys);
  const seriesWithBenchmark = series.map((s) => ({ ...s, allTimeMax: allTimeMax[s.metricKey] ?? null }));

  return NextResponse.json({ granularity, series: seriesWithBenchmark });
}
