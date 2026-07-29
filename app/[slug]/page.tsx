"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchAccounts,
  fetchKpis,
  fetchMetrics,
  type AccountSummary,
  type KpisResponse,
  type MetricsResponse,
} from "@/lib/client/api";
import { StatTile } from "@/components/StatTile";
import { TrendChart } from "@/components/TrendChart";
import { RangeToggle } from "@/components/RangeToggle";
import { UploadWidget } from "@/components/UploadWidget";
import { MetricsTable } from "@/components/MetricsTable";

const BASE_SERIES_KEYS = ["base.active_base", "base.grace_base", "base.suspended_base"];

export default function AccountDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [kpis, setKpis] = useState<KpisResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [granularity, setGranularity] = useState<"daily" | "weekly">("daily");
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchAccounts().then((r) => setAccount(r.accounts.find((a) => a.slug === slug) ?? null));
  }, [slug, refreshKey]);

  useEffect(() => {
    fetchKpis(slug).then(setKpis);
  }, [slug, refreshKey]);

  useEffect(() => {
    fetchMetrics(slug, { granularity }).then(setMetrics);
  }, [slug, granularity, refreshKey]);

  const txnKpiOptions = useMemo(() => {
    if (!metrics) return [];
    const keys = new Set<string>();
    for (const s of metrics.series) {
      const m = s.metricKey.match(/^txn\.(.+)\.(count|revenue)$/);
      if (m) keys.add(m[1]);
    }
    return Array.from(keys);
  }, [metrics]);

  useEffect(() => {
    if (!selectedKpi && txnKpiOptions.length > 0) setSelectedKpi(txnKpiOptions[0]);
  }, [txnKpiOptions, selectedKpi]);

  const baseSeries = useMemo(
    () =>
      (metrics?.series ?? [])
        .filter((s) => BASE_SERIES_KEYS.includes(s.metricKey))
        .sort((a, b) => BASE_SERIES_KEYS.indexOf(a.metricKey) - BASE_SERIES_KEYS.indexOf(b.metricKey)),
    [metrics]
  );

  const deactivationSeries = useMemo(
    () => (metrics?.series ?? []).filter((s) => s.metricKey === "deactivation.total"),
    [metrics]
  );

  const selectedTxnSeries = useMemo(
    () => (metrics?.series ?? []).filter((s) => s.metricKey === `txn.${selectedKpi}.count`),
    [metrics, selectedKpi]
  );
  const selectedTxnRevenueSeries = useMemo(
    () => (metrics?.series ?? []).filter((s) => s.metricKey === `txn.${selectedKpi}.revenue`),
    [metrics, selectedKpi]
  );

  const allSeriesForTable = metrics?.series ?? [];

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link href="/" className="text-sm" style={{ color: "var(--text-muted)" }}>
            &larr; All accounts
          </Link>
          <h1 className="text-2xl font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
            {account?.displayName ?? slug}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            As of {kpis?.asOfDate ?? "—"}
          </p>
        </div>
        <div className="w-full sm:w-96">
          <UploadWidget slug={slug} onUploaded={() => setRefreshKey((k) => k + 1)} />
        </div>
      </div>

      <section>
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
          KPI Summary (Month-to-Date)
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {kpis?.kpis.map((kpi) => (
            <StatTile
              key={kpi.label}
              label={kpi.label}
              countFields={kpi.metrics["Count"]}
              revenueFields={kpi.metrics["Revenue"]}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Trends
          </h2>
          <RangeToggle value={granularity} onChange={setGranularity} />
        </div>

        <div className="grid lg:grid-cols-3 gap-3 mb-4">
          {baseSeries.map((s) => (
            <div key={s.metricKey} className="rounded-lg p-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                {s.metricLabel}
              </div>
              <TrendChart series={[{ key: s.metricKey, label: s.metricLabel, points: s.points }]} height={160} />
            </div>
          ))}
        </div>

        <div className="rounded-lg p-3 mb-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
            Deactivations
          </div>
          <TrendChart
            series={deactivationSeries.map((s) => ({ key: s.metricKey, label: s.metricLabel, points: s.points }))}
            height={200}
          />
        </div>

        <div className="rounded-lg p-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              KPI trend
            </div>
            <select
              value={selectedKpi ?? ""}
              onChange={(e) => setSelectedKpi(e.target.value)}
              className="text-sm rounded px-2 py-1"
              style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              {txnKpiOptions.map((k) => (
                <option key={k} value={k}>
                  {k.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                Count
              </div>
              <TrendChart
                series={selectedTxnSeries.map((s) => ({ key: s.metricKey, label: s.metricLabel, points: s.points }))}
                height={200}
              />
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                Revenue
              </div>
              <TrendChart
                series={selectedTxnRevenueSeries.map((s) => ({ key: s.metricKey, label: s.metricLabel, points: s.points }))}
                height={200}
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
          Underlying numbers ({granularity})
        </h2>
        <MetricsTable series={allSeriesForTable} />
      </section>
    </main>
  );
}
