import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/db/bootstrap";
import { listAccounts } from "@/lib/accounts/registry";
import { getLatestUpload } from "@/lib/db/client";

export async function GET() {
  bootstrap();
  const accounts = listAccounts().map((a) => ({
    slug: a.slug,
    displayName: a.displayName,
    latestUpload: getLatestUpload(a.slug),
  }));
  return NextResponse.json({ accounts });
}
