import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/db/bootstrap";
import { getAccount } from "@/lib/accounts/registry";
import { getDailyMetrics } from "@/lib/db/client";
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

  return NextResponse.json({ granularity, series });
}
