// LensSubmissionRepository — persistence for the referendum o metodice
// (moonshot 7B). The ONLY writer of `lens_submission`.
//
// Like repositories/changes.ts and repositories/ledger.ts this is deliberately
// additive and self-contained: NOT folded into the `Store` facade (lib/db/
// store.ts is shared substrate owned by other items). Server-side callers use
// `getWeightsRepo()` (same pattern as `getChangesRepo`).
//
// ANONYMITY IS STRUCTURAL, not a policy promise: the table has three columns
// (id, vahy, submitted_at) and this repository never receives — so can never
// store — anything about the submitter. The k-anonymity floor (median only at
// n ≥ 20) is enforced by the pure derivation in
// features/landing/referendum/aggregate.ts and disclosed on every surface.
//
// CODEC DISCIPLINE: the weight vector codec lives ONLY in
// features/civicscore/lens.ts. Every write is validated through
// `decodeWeights` and re-serialized canonically; an invalid vector is
// REJECTED, never repaired (the same "an address is a claim" rule the URL
// codec enforces).
//
// LAYERING NOTE (deliberate, documented exception): lib/ otherwise never
// imports features/. The lens codec is pinned READ-ONLY in
// features/civicscore/lens.ts and forking it here to keep the layering pretty
// would be the worse sin — one codec beats one-way purity. Both imports are
// pure, client-safe modules (no server-only, no store reads); lens.ts's import
// from getLeaderboardData is type-only, so no runtime cycle exists.

import { decodeWeights } from "@/features/civicscore/lens";
import { serializeWeights } from "@/features/landing/referendum/aggregate";
import { dbDriver } from "../../config";
import { num, open, str, type Pglite } from "../internals";

export interface LensSubmissionRepository {
  /**
   * Validate + store one anonymous weight vector (canonical dash form,
   * LENS_COMPONENT_ORDER). Returns the new submission count, or
   * `{ ok: false }` when the vector does not satisfy the lens codec —
   * errors-as-values so the server action can answer honestly.
   */
  submitLensVector(raw: string): Promise<{ ok: true; count: number } | { ok: false; error: string }>;
  /** All stored vectors (canonical strings), oldest first. Capped. */
  listLensVectors(limit?: number): Promise<string[]>;
  countLensSubmissions(): Promise<number>;
}

/** Hard cap on how many vectors an aggregate read ever loads. */
const LIST_CAP = 100_000;

export function makeWeightsRepo(pg: Pglite): LensSubmissionRepository {
  const repo: LensSubmissionRepository = {
    async submitLensVector(raw) {
      const decoded = decodeWeights(raw);
      if (decoded === null) {
        return { ok: false, error: "vektor vah nesplňuje kodek čočky (šest celých čísel 0–100)" };
      }
      // Re-serialize canonically so the stored form is exactly one shape.
      const canonical = serializeWeights(decoded);
      await pg.query(
        `insert into lens_submission (id, vahy) values ($1, $2)`,
        [crypto.randomUUID(), canonical],
      );
      return { ok: true, count: await repo.countLensSubmissions() };
    },

    async listLensVectors(limit) {
      const lim = Math.max(1, Math.min(LIST_CAP, limit ?? LIST_CAP));
      const { rows } = await pg.query<Record<string, unknown>>(
        `select vahy from lens_submission order by submitted_at asc, id asc limit ${lim}`,
      );
      return rows.map((r) => str(r.vahy));
    },

    async countLensSubmissions() {
      const { rows } = await pg.query<{ n: string | number }>(
        `select count(*)::int as n from lens_submission`,
      );
      return num(rows[0]?.n);
    },
  };
  return repo;
}

/** Server-side entry point over the app's live PGlite connection; null when the
 *  active driver is not PGlite (the sample-data fallback keeps working). */
export async function getWeightsRepo(): Promise<LensSubmissionRepository | null> {
  if (dbDriver() !== "pglite") return null;
  return makeWeightsRepo(await open());
}
