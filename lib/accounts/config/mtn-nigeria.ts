import type { AccountConfig } from "../types.ts";

// Validated against sample-data/MTN Nigeria.xlsx (2026-07-27 snapshot).
//
// Note: MTN's `Base` sheet has no Year/Month columns at all — it's an
// implicit "current month" snapshot (day columns only, ~27 days present at
// onboarding time). The parser falls back to the Dashboard sheet's as-of
// date for the year/month, so this series only ever shows the current
// month's daily base trend, not multi-month history (unlike Orange, whose
// Base sheet does carry full history). That's a real difference in how this
// account's MIS extract is built, not a parsing gap.
const config: AccountConfig = {
  slug: "mtn-nigeria",
  displayName: "MTN Nigeria",
  sourceFileHint: "MTN Nigeria.xlsx",
  base: {
    sheet: "Base",
    // "RBT-Base" is a separate bundled service on the same sheet; "RBT-Tone"
    // is the Ring Back Tone base. Confirmed: RBT-Tone/Active on day 27
    // (1,150,521) matches the Dashboard "Active Base" KPI exactly.
    series: [
      { key: "active_base", label: "Active Base", match: { "Subscription Type": "RBT-Tone", "User Status": "Active" } },
      { key: "grace_base", label: "Grace Base", match: { "Subscription Type": "RBT-Tone", "User Status": "Grace" } },
      { key: "suspended_base", label: "Suspended Base", match: { "Subscription Type": "RBT-Tone", "User Status": "Suspended" } },
    ],
  },
  deactivation: {
    sheet: "Deactivation",
  },
  transactionMetrics: [
    {
      key: "new_song",
      label: "New Song",
      // MTN's Dashboard KPI table doesn't split by interface the way
      // Orange's does — "New Song" combines both source columns.
      countMetrics: ["Count / TONE / New song", "Count / SUBSCRIPTION / New song"],
      revenueMetrics: ["Revenue / TONE / New song", "Revenue / SUBSCRIPTION / New song"],
    },
    {
      key: "song_renewal",
      label: "Song Renewal",
      countMetrics: ["Count / TONE / Song Renewal"],
      revenueMetrics: ["Revenue / TONE / Song Renewal"],
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
