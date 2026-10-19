// Server-only: tells a money case-file page WHICH absence a null loader read was.
//
// `getMoneyMpDetail` / `getCompanyCaseFile` return null for four different things: the
// store is unreachable (single-connection PGlite held by another process), the store is
// below its cardinality floor (mid-ingest), the id names nothing, and the id names
// something with no tie. The last two are findings the page may state ("no tie in the
// graph"); the first two are NOT, and stating them that way publishes a claim about a
// named person or firm that nothing established. The page asks this once, only when the
// read came back null, and renders DataUnavailable when the store could not be read.
//
// Residual, stated: a query that throws while the store IS ready still returns null and
// reads as "no tie" (reportLoaderFailure logs it). Closing that needs the loaders to
// return a discriminated state; this probe covers the outage the project documents.

import "server-only";
import { getStore } from "@/lib/db/store";
import { storeReady } from "@/lib/db/readiness";

export async function moneyStoreReadable(): Promise<boolean> {
  try {
    const store = await getStore();
    if (!store) return false;
    return await storeReady(store, ["person", "company", "contract"]);
  } catch {
    return false;
  }
}
