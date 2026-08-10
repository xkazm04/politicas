// Server-only loader for the Seismograf: the REAL PSP10 vote ledger (vote_event +
// vote_ballot joined with clubs, mandates and person names), handed to the pure
// derivation in record/derive.ts. Degrades to null (→ the page falls back to the
// labelled mock + LiveDataNotice) if no store is configured, the ledger is below its
// readiness floor, or PGlite is unavailable at request time.
//
// ── Co tenhle soubor tvrdil do 2026-08-10 a co je pravda ───────────────────────
// Stálo tu, že jde o „one O(ballots) double pass over ~406k rows (~tens of ms)“ a že
// `react.cache` sdílí běh mezi metadaty a tělem stránky. Obojí bylo mimo:
//   • Cena je ~16 s, ne desítky ms — samotné `listVoteBallots` bylo změřeno
//     15 758 / 15 987 / 15 984 ms na živém store (viz ledgerRead.ts).
//   • `generateMetadata()` v app/hlasovani/page.tsx čte JEN `getTranslations("meta")`.
//     Žádná metadata tenhle loader nevolají, takže tu sdílet nebylo co.
// `react.cache()` tu zůstává, protože dedupluje volání UVNITŘ jednoho renderu; co
// stáří čísel skutečně omezuje, je memo napříč požadavky níž — a stránka ho tiskne.
//
// Prahy připravenosti žijí v ledgerRead.ts a běží PŘED zápisem do mema.

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { createLedgerMemo } from "./ledgerMemo";
import { readLedger } from "./ledgerRead";
import { deriveVoteRecord } from "./record/derive";
import type { VoteRecordData } from "./record/types";

// The floors are the ledger read's; re-exported because features/profile/
// getRebellionRecord.ts imports them from here and must refuse a half-ingested
// ledger at exactly the same point as /hlasovani.
export { BALLOT_FLOOR, EVENT_FLOOR, TERM } from "./ledgerRead";

/** Cross-request memo of the DERIVED record (compact), bounded by the money layer's
 *  window. An empty ledger is never memoized — see ledgerMemo.ts for the discipline. */
const recordMemo = createLedgerMemo<VoteRecordData>({ usable: (r) => r.ledger.length > 0 });

/** Test seam: drop the cross-request memo (the `resetSuppliesMemo` precedent).
 *  Never called by the app. */
export function resetVoteRecordMemo(): void {
  recordMemo.reset();
}

export const getVoteRecord = cache(async function getVoteRecord(): Promise<VoteRecordData | null> {
  try {
    const memoized = recordMemo.read();
    if (memoized !== null) return memoized;

    const ledger = await readLedger();
    if (ledger === null) return null;

    const record = deriveVoteRecord(ledger);
    recordMemo.write(record);
    return record;
  } catch (err) {
    reportLoaderFailure("getVoteRecord", err);
    return null;
  }
});
