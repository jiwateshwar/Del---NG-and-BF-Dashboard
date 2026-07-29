function formatCompact(v: number): string {
  const rounded = Math.round(v * 100) / 100;
  return rounded.toLocaleString("en-US");
}

/** A same-ramp meter comparing the latest value against the all-time best
 * ("benchmark") for that metric — e.g. "today vs. best day ever". */
export function BenchmarkMeter({
  latest,
  best,
  label = "Best day",
}: {
  latest: number | null | undefined;
  best: number | null | undefined;
  label?: string;
}) {
  if (latest === null || latest === undefined || !best || best <= 0) return null;
  const pct = Math.max(0, Math.min(1, latest / best));

  return (
    <div className="mt-1">
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--gridline)" }}
        role="meter"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${formatCompact(best)}`}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct * 100}%`, background: "var(--series-1)" }}
        />
      </div>
      <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
        {label}: {formatCompact(best)} ({Math.round(pct * 100)}%)
      </div>
    </div>
  );
}
