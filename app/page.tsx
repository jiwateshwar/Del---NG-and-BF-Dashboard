"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAccounts, type AccountSummary } from "@/lib/client/api";

export default function Home() {
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);

  useEffect(() => {
    fetchAccounts().then((r) => setAccounts(r.accounts));
  }, []);

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        RBT Operations Dashboard
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        Daily and weekly performance review, per account.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {accounts?.map((a) => (
          <Link
            key={a.slug}
            href={`/${a.slug}`}
            className="rounded-lg p-5 flex flex-col gap-2 transition-shadow hover:shadow-sm"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
          >
            <span className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
              {a.displayName}
            </span>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              {a.latestUpload
                ? `Last updated ${new Date(a.latestUpload.uploaded_at).toLocaleString()} (as of ${a.latestUpload.as_of_date ?? "—"})`
                : "No MIS uploaded yet"}
            </span>
          </Link>
        ))}
        {!accounts && (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading accounts…
          </div>
        )}
      </div>
    </main>
  );
}
