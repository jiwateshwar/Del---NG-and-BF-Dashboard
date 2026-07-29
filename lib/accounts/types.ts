// An account config is the one-time, per-account knowledge needed to turn
// the generic parser output (lib/parser/*) into labeled KPI series. It does
// NOT need to cover the Dashboard-sheet KPI summary table (New Activation,
// Renewal, Total, ...) — that table's row labels are read directly off the
// sheet by lib/parser/kpi-block.ts and shown as-is, no mapping required.

export interface BaseSeriesConfig {
  key: string;
  label: string;
  /** Filters `Base` sheet records (lib/parser/wide-pivot.ts output) down to
   * the dimension combo that represents this series, e.g. the RBT-specific
   * base slice on accounts whose Base sheet also carries an unrelated
   * bundled service. */
  match: Record<string, string>;
}

export interface TransactionMetricConfig {
  key: string;
  label: string;
  /** Composite metric keys (exact strings from
   * lib/parser/transaction-sheet.ts's `metricColumns`) to sum for this KPI's
   * count series. */
  countMetrics: string[];
  /** Same, for the revenue series. */
  revenueMetrics: string[];
}

export interface AccountConfig {
  slug: string;
  displayName: string;
  /** Which real workbook this config was validated against, for onboarding traceability. */
  sourceFileHint: string;
  base: {
    sheet: string;
    series: BaseSeriesConfig[];
  } | null;
  deactivation: {
    sheet: string;
  } | null;
  transactionMetrics: TransactionMetricConfig[];
}
