// Server-only loader for /dashboard — reads the REAL contribution-index graph
// (the same materialized store as /zebricek) instead of the lib/civic mock,
// for the two dashboard sections that have a real analog: the ranking list
// and the chamber-wide score summary. Reuses `getLeaderboardData()` (the
// established civicscore loader) rather than re-querying the store, so there
// is exactly one place that turns kg nodes into ranked entries.
//
// The graph canvas + activity feed have NO real analog in scope for this
// task (they would require rebuilding a live public-money graph, which is
// features/money territory) — those stay on the lib/civic mock, honestly
// labelled at the component/copy layer, not here.
//
// Returns null on any failure (no store, empty graph, PGlite unavailable) —
// `getLeaderboardData()` already reports its own loader failure and degrades
// to null, so there is nothing to swallow here; the dashboard page falls
// back to the mock ranking/stats when this returns null.

import "server-only";
import { getLeaderboardData, type LeaderboardEntry } from "@/features/civicscore/getLeaderboardData";

export interface DashboardData {
  /** Top-N real MPs by contribution_score, for the ranking section. */
  top: LeaderboardEntry[];
  summary: { avg: number; median: number; sigma: number; count: number };
  histogram: { from: number; label: string; count: number }[];
  /** Average attendance across all 207 real MPs, as a 0–100 percentage. */
  attendanceAvgPct: number;
}

const TOP_N = 5;

export async function getDashboardData(): Promise<DashboardData | null> {
  const lb = await getLeaderboardData();
  if (!lb || lb.entries.length === 0) return null;
  const attendanceAvgPct =
    Math.round(
      (lb.entries.reduce((s, e) => s + (1 - e.absenceRate), 0) / lb.entries.length) * 1000,
    ) / 10;
  return {
    top: lb.entries.slice(0, TOP_N),
    summary: lb.summary,
    histogram: lb.histogram,
    attendanceAvgPct,
  };
}
