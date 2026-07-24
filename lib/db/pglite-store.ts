// Server-only. PGlite (embedded Postgres, WASM) implementation of `Store`.
//
// This file is now a thin COMPOSER: it opens the connection and assembles the
// Store from the per-concern repository factories under ./pglite/. The DDL,
// plumbing, mappers, and each repository live in their own module so no single
// file is a god component. Add a repository → new file in ./pglite/repositories/
// + one spread below (and its interface in ./store).
//
// WHY POSTGRES SEMANTICS: politicas is an entity GRAPH — recursive walks
// (person → club → co-voters → contracts), JSONB reads over heterogeneous
// open-data payloads, window functions over 400k roll-call ballots. PGlite gives
// real Postgres in-process with zero infra; the escape hatch to hosted Postgres
// is a second driver file. (For heavy analytical joins, see the DuckDB hybrid in
// docs/db-architecture-guide.md — the serving store stays PGlite.)
if (typeof window !== "undefined") {
  throw new Error("@/lib/db/pglite-store must not be imported on the client.");
}

import type { Store } from "./store";
import { PGLITE_KEY, open, type GlobalWithPglite } from "./pglite/internals";
import { makeGraphRepo } from "./pglite/repositories/graph";
import { makeVoteRepo } from "./pglite/repositories/votes";
import { makeProvenanceRepo } from "./pglite/repositories/provenance";
import { makeAnalysisRepo } from "./pglite/repositories/analysis";
import { makeVoteTagRepo } from "./pglite/repositories/voteTags";
import { makeKgRepo } from "./pglite/repositories/kg";

export async function getPgliteStore(): Promise<Store> {
  const pg = await open();
  return {
    ...makeGraphRepo(pg),
    ...makeVoteRepo(pg),
    ...makeProvenanceRepo(pg),
    ...makeAnalysisRepo(pg),
    ...makeVoteTagRepo(pg),
    ...makeKgRepo(pg),
    async close() {
      const g = globalThis as GlobalWithPglite;
      delete g[PGLITE_KEY];
      await pg.close();
    },
  };
}
