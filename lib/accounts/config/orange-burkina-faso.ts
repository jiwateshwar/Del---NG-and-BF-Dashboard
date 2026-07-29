import type { AccountConfig } from "../types.ts";

// Validated against sample-data/Orange-Burkina Faso.xlsx (2026-07-27 snapshot).
const config: AccountConfig = {
  slug: "orange-burkina-faso",
  displayName: "Orange Burkina Faso",
  sourceFileHint: "Orange-Burkina Faso.xlsx",
  base: {
    sheet: "Base",
    // The `Base` sheet carries two unrelated bases (TRANSACTION_TYPE =
    // "SUBSCRIPTION" is a different bundled service) — only "TONE BASE" is
    // the Ring Back Tone base. Confirmed: TONE BASE/Active MTD (48268)
    // matches the Dashboard "Active Base" KPI exactly.
    series: [
      { key: "active_base", label: "Active Base", match: { TRANSACTION_TYPE: "TONE BASE", STATUS: "Active" } },
      { key: "grace_base", label: "Grace Base", match: { TRANSACTION_TYPE: "TONE BASE", STATUS: "Grace" } },
      { key: "suspended_base", label: "Suspended Base", match: { TRANSACTION_TYPE: "TONE BASE", STATUS: "Suspened" } },
    ],
  },
  deactivation: {
    sheet: "Deactivation",
  },
  transactionMetrics: [
    {
      key: "new_activation",
      label: "New Activation",
      countMetrics: ["Count / SUBSCRIPTION / New Sub"],
      revenueMetrics: ["Revenue / SUBSCRIPTION / New Sub"],
    },
    {
      key: "renewal",
      label: "Renewal",
      countMetrics: ["Count / SUBSCRIPTION / Renewal"],
      revenueMetrics: ["Revenue / SUBSCRIPTION / Renewal"],
    },
    {
      key: "new_song",
      label: "New Song",
      countMetrics: ["Count / TONE / Tone -Download"],
      revenueMetrics: ["Revenue / TONE / Tone -Download"],
    },
    {
      key: "song_renewal",
      label: "Song Renewal",
      countMetrics: ["Count / TONE / Tone-Renewal"],
      revenueMetrics: ["Revenue / TONE / Tone-Renewal"],
    },
    {
      key: "total",
      label: "Total",
      countMetrics: ["Total  Count"],
      revenueMetrics: ["Total  Revenue"],
    },
  ],
};

export default config;
