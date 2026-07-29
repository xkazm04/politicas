// Server-only loader for the landing page („/") — the surface that PRODUCT.md
// names the voter's first ten seconds.
//
// Why it exists: the landing has run on the `lib/civic/data.ts` sample since the
// prototype round, with every figure carrying „ILUSTRATIVNÍ UKÁZKA". That was
// recorded as DEBT, not design, when /impeccable init captured the product truth
// (2026-07-29): the front page of a project whose stated positioning is
// COMPLETE CHAMBER COVERAGE should be able to say 207 and mean it.
//
// It re-uses the loader that already owns these figures rather than re-deriving
// anything — `getLeaderboardListData()` is the same `react.cache()`-wrapped read
// /zebricek renders, so the landing and the leaderboard cannot disagree about a
// rank, a score or the size of the chamber. No new query, no second definition.
//
// It deliberately does NOT read the money or law layers. `getMoneyData()` costs
// ~12 s cold over ~153 k contracts, and a landing page is the one surface that
// must not pay that: the voter arrives from social media and leaves. Figures
// those layers own stay out rather than arriving late.

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getLeaderboardListData, type LeaderboardListEntry } from "@/features/civicscore/getLeaderboardData";

/** One ranked MP as the landing renders them — a strict subset of the leaderboard row. */
export interface LandingMp {
  pspId: number;
  rank: number;
  /** How many MPs hold exactly this score (1 = unique). A shared rank must be
   *  sayable without reordering anything — see `LeaderboardEntry.tiedCount`. */
  tiedCount: number;
  name: string;
  clubAbbrev: string;
  clubColor: string;
  score: number;
}

export interface LandingData {
  /** Ranked descending. The whole chamber is `summary.count`; this is the head of it. */
  top: LandingMp[];
  summary: { avg: number; median: number; sigma: number; count: number };
  /** Seats per club, largest first — the chamber as the voter's own map. */
  clubs: { abbrev: string; name: string; color: string; seats: number }[];
  histogram: { from: number; label: string; count: number }[];
  components: { key: string; weight: number; label: string; source: string }[];
  /** The contribution-index pass that authored these scores; null if unstamped. */
  provenancePass: number | null;
}

/** How many ranked MPs the landing shows. The rest of the chamber is one click
 *  away on /zebricek; the landing states the total rather than implying it. */
const TOP_N = 8;

const toLandingMp = (e: LeaderboardListEntry): LandingMp => ({
  pspId: e.pspId,
  rank: e.rank,
  tiedCount: e.tiedCount,
  name: e.name,
  clubAbbrev: e.clubAbbrev,
  clubColor: e.clubColor,
  score: e.score,
});

export const getLandingData = cache(async (): Promise<LandingData | null> => {
  try {
    const board = await getLeaderboardListData();
    if (!board || board.entries.length === 0) return null;
    return {
      top: board.entries.slice(0, TOP_N).map(toLandingMp),
      summary: board.summary,
      clubs: board.clubs,
      histogram: board.histogram,
      components: board.components,
      provenancePass: board.provenancePass,
    };
  } catch (err) {
    reportLoaderFailure("getLandingData", err);
    return null;
  }
});
