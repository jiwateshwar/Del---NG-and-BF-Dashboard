import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/db/bootstrap";
import { getAccount } from "@/lib/accounts/registry";
import { getKpiSnapshots, getLatestUpload } from "@/lib/db/client";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  bootstrap();
  const { slug } = await params;
  const account = getAccount(slug);
  if (!account) {
    return NextResponse.json({ error: `Unknown account "${slug}"` }, { status: 404 });
  }

  const rows = getKpiSnapshots(slug);
  const upload = getLatestUpload(slug);

  const byLabel = new Map<string, { label: string; metrics: Record<string, (typeof rows)[number]> }>();
  for (const row of rows) {
    if (!byLabel.has(row.kpi_label)) byLabel.set(row.kpi_label, { label: row.kpi_label, metrics: {} });
    byLabel.get(row.kpi_label)!.metrics[row.metric_type] = row;
  }

  return NextResponse.json({
    asOfDate: upload?.as_of_date ?? null,
    kpis: Array.from(byLabel.values()),
  });
}
