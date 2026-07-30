// Server-only loader for /referendum (moonshot 7B): the real leaderboard
// (shared read pass with /zebricek — buildLeaderboard is react.cache-wrapped,
// so a request touching both pays once) + the anonymous weight aggregate.
// Degrades honestly: leaderboard null → the page renders a labelled notice;
// aggregate null → the referendum still works, only the "jak váží Česko"
// median is disclosed as unavailable.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getWeightsRepo } from "@/lib/db/pglite/repositories/weights";
import {
  getLeaderboardListData,
  type LeaderboardListData,
} from "@/features/civicscore/getLeaderboardData";
import { deriveWeightAggregate, type WeightAggregate } from "./aggregate";

export interface ReferendumData {
  leaderboard: LeaderboardListData | null;
  /** Null = store nedostupný (sample-data režim); jinak vždy alespoň { n }. */
  aggregate: WeightAggregate | null;
}

export async function getReferendumData(): Promise<ReferendumData> {
  const leaderboard = await getLeaderboardListData();
  let aggregate: WeightAggregate | null = null;
  try {
    const repo = await getWeightsRepo();
    if (repo !== null) aggregate = deriveWeightAggregate(await repo.listLensVectors());
  } catch (err) {
    reportLoaderFailure("getReferendumData.aggregate", err);
    aggregate = null;
  }
  return { leaderboard, aggregate };
}
