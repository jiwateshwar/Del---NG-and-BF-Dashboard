import type { KpiFieldValues } from "@/lib/client/api";

function formatNumber(v: number | null, isRevenue: boolean): string {
  if (v === null || v === undefined) return "—";
  const rounded = isRevenue ? Math.round(v) : Math.round(v * 100) / 100;
  return rounded.toLocaleString("en-US");
}

function formatPct(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function Delta({ growth }: { growth: number | null }) {
  if (growth === null || growth === undefined) return <span className="text-[var(--text-muted)]">—</span>;
  const positive = growth >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 font-medium"
      style={{ color: positive ? "var(--success)" : "var(--danger)" }}
    >
      {positive ? "▲" : "▼"} {formatPct(Math.abs(growth))}
    </span>
  );
}

export function StatTile({
  label,
  countFields,
  revenueFields,
}: {
  label: string;
  countFields?: KpiFieldValues;
  revenueFields?: KpiFieldValues;
}) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-2"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
    >
      <div className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {formatNumber(countFields?.mtd ?? null, false)}
        </span>
        <Delta growth={countFields?.lmtd_mtd_growth_pct ?? null} />
      </div>
      {revenueFields?.mtd !== null && revenueFields?.mtd !== undefined && (
        <div className="flex items-baseline gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <span className="tabular-nums">Rev {formatNumber(revenueFields.mtd, true)}</span>
          <Delta growth={revenueFields.lmtd_mtd_growth_pct ?? null} />
        </div>
      )}
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        LMTD {formatNumber(countFields?.lmtd ?? null, false)} &middot; Last month{" "}
        {formatNumber(countFields?.last_month ?? null, false)}
      </div>
    </div>
  );
}
