import { NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bootstrap } from "@/lib/db/bootstrap";
import { getAccount } from "@/lib/accounts/registry";
import { parseWorkbook } from "@/lib/parser/parse-workbook";
import { recordUpload, replaceDailyMetrics, replaceKpiSnapshots } from "@/lib/db/client";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "data", "uploads");

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  bootstrap();
  const { slug } = await params;
  const account = getAccount(slug);
  if (!account) {
    return NextResponse.json({ error: `Unknown account "${slug}"` }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field in form data." }, { status: 400 });
  }
  if (!/\.xlsx$/i.test(file.name)) {
    return NextResponse.json({ error: "Only .xlsx files are supported." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = parseWorkbook(buffer, account);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse workbook: ${err instanceof Error ? err.message : String(err)}` },
      { status: 422 }
    );
  }

  replaceDailyMetrics(account.slug, parsed.dailyMetrics);
  replaceKpiSnapshots(account.slug, parsed.kpiRows, parsed.asOfDate);
  const uploadId = recordUpload({
    accountSlug: account.slug,
    originalFilename: file.name,
    asOfDate: parsed.asOfDate,
    metricPointCount: parsed.dailyMetrics.length,
    warnings: parsed.warnings,
  });

  try {
    const dir = path.join(UPLOADS_DIR, account.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${uploadId}-${file.name}`), buffer);
  } catch {
    // Archiving the raw file is best-effort; failure here shouldn't fail the upload.
  }

  return NextResponse.json({
    uploadId,
    asOfDate: parsed.asOfDate,
    metricPointCount: parsed.dailyMetrics.length,
    kpiRowCount: parsed.kpiRows.length,
    warnings: parsed.warnings,
  });
}
