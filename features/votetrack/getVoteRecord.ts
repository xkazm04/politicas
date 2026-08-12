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
//
// ── JEDEN PRŮCHOD PRO OBĚ PLOCHY (2026-08-11) ──────────────────────────────────
// Do teď se memoizoval záznam s kronikou uříznutou na `CHRONICLE_CAP` — což je
// PREZENTAČNÍ mez /hlasovani. Spis poslance (features/profile/getRebellionRecord.ts)
// potřebuje kroniku celou, takže si musel číst 406 000 hlasů a derivovat ZNOVU:
// dva šestnáctisekundové průchody na okno mema nad jedním grafem, každý s vlastními
// hodinami.
//
// Teď se memoizuje záznam s kronikou NEOŘÍZNUTOU a /hlasovani si z něj svoje okno
// jen ukrojí. Že to smí, není domněnka: `chronicleCap` se v record/derive.ts čte
// na JEDINÉM místě — ve smyčce, která kroniku plní a při dosažení meze skončí
// `break`em. Uříznutá kronika je tedy PREFIX té neuříznuté a žádné jiné pole
// (`ledger`, `seismogram`, `clubs`, `topRebels`, `reconciliation`, `coverage`) na
// mezi nezávisí. Drží to `chronicleCap.test.ts` nad reálnou derivací, ne komentář.
//
// Cena té změny je paměť za neuříznutou kroniku: 1 301 řádků na živém záznamu proti
// 24 (~stovky kB proti jednotkám). Vedle 406 000 hlasů, které se v memu záměrně
// nedrží (viz ledgerMemo.ts), je to zaokrouhlovací chyba — a kupuje se za ni celý
// jeden průchod záznamem na okno.
//
// ── A KOMPAS JEDE NA TÉMŽE ZÁZNAMU (2026-08-11) ────────────────────────────────
// Od téhož dne se v memoizovaném objektu veze i `voteIndex` — rejstřík všech
// platných hlasování s celosněmovním tally a linií klubu (record/types.ts). Ten
// existuje kvůli /kompas, který si obojí do teď počítal SÁM nad týmiž 406 000 hlasy
// ve vlastním memu s vlastním průchodem. Rejstřík derivaci nestojí ani jeden průchod
// navíc (všechno v něm už je spočítané) a přes hranici ke klientovi /hlasovani
// NEJDE: `toWireRecord()` ho zahazuje, protože ta stránka z něj nekreslí nic.

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { createLedgerMemo } from "./ledgerMemo";
import { readLedger } from "./ledgerRead";
import { CHRONICLE_CAP, deriveVoteRecord } from "./record/derive";
import type { FullVoteRecord, VoteRecordData } from "./record/types";

// The floors are the ledger read's; re-exported because features/profile/
// getRebellionRecord.ts imports them from here and must refuse a half-ingested
// ledger at exactly the same point as /hlasovani.
export { BALLOT_FLOOR, EVENT_FLOOR, TERM } from "./ledgerRead";

/** Kronika BEZ prezentační meze. Vlastní ji tenhle modul, protože tady se
 *  derivuje — obě plochy pak čtou JEDEN výsledek a žádná si nedeklaruje vlastní
 *  „neomezeno". */
export const UNCAPPED_CHRONICLE = Number.MAX_SAFE_INTEGER;

/** Cross-request memo of the DERIVED record (compact), bounded by the money layer's
 *  window. An empty ledger is never memoized — see ledgerMemo.ts for the discipline. */
const recordMemo = createLedgerMemo<FullVoteRecord>({ usable: (r) => r.ledger.length > 0 });

/**
 * Co ze záznamu přechází k /hlasovani na KLIENTA.
 *
 * `voteIndex` ne, a je to jediné vynechané pole: rejstřík všech platných
 * hlasování vzniká pro výběr otázek kompasu, /hlasovani z něj nevykresluje nic
 * a přes síť by to byly stovky kB navíc (vzor `TIE_WIRE` z /penize — projekce
 * mezi loaderem a klientem, ne druhá derivace). Kronika se tu ještě ořízne na
 * prezentační okno stránky.
 *
 * Vypsáno POLE PO POLI schválně: kdo do `VoteRecordData` přidá pole, narazí tady
 * a musí rozhodnout, jestli patří přes hranici — mlčky projít to nemůže.
 */
export function toWireRecord(full: FullVoteRecord): VoteRecordData {
  return {
    ledger: full.ledger,
    seismogram: full.seismogram,
    clubs: full.clubs,
    chronicle:
      full.chronicle.length <= CHRONICLE_CAP ? full.chronicle : full.chronicle.slice(0, CHRONICLE_CAP),
    // Populace obou oříznutých seznamů PŘES HRANICI JDE, a to je celý smysl:
    // řádek nahoře kroniku ořezává a bez denominátoru by /hlasovani tisklo mez
    // jako počet. `chronicleTotal` se řezem nemění (je spočítaný před ním).
    chronicleTotal: full.chronicleTotal,
    topRebels: full.topRebels,
    topRebelsTotal: full.topRebelsTotal,
    reconciliation: full.reconciliation,
    coverage: full.coverage,
  };
}

/** Test seam: drop the cross-request memo (the `resetSuppliesMemo` precedent).
 *  Never called by the app. */
export function resetVoteRecordMemo(): void {
  recordMemo.reset();
}

/**
 * The WHOLE record — chronicle uncapped. This is the memoized artifact both
 * surfaces ride: /hlasovani through `getVoteRecord()` below, the spis through
 * `features/profile/getRebellionRecord.ts`. Whichever asks first pays the ~16 s
 * ledger read and the ~0,5 s derivation; the other pays nothing for the rest of
 * the window.
 *
 * Failure honesty is unchanged and lives in two places on purpose: the readiness
 * floors run inside `readLedger()` (before anything here can memoize), and
 * `createLedgerMemo` refuses to store a null or an empty record.
 */
export const getFullVoteRecord = cache(async function getFullVoteRecord(): Promise<FullVoteRecord | null> {
  try {
    const memoized = recordMemo.read();
    if (memoized !== null) return memoized;

    const ledger = await readLedger();
    if (ledger === null) return null;

    const record = deriveVoteRecord(ledger, { chronicleCap: UNCAPPED_CHRONICLE });
    recordMemo.write(record);
    return record;
  } catch (err) {
    reportLoaderFailure("getVoteRecord", err);
    return null;
  }
});

/**
 * The record as /hlasovani renders it: the same object minus the compass's vote
 * index, chronicle cut to the page's own presentation window (`CHRONICLE_CAP`,
 * disclosed in the copy). The cut is a prefix of the full chronicle, so the
 * rendered output is what it always was.
 */
export const getVoteRecord = cache(async function getVoteRecord(): Promise<VoteRecordData | null> {
  const full = await getFullVoteRecord();
  return full === null ? null : toWireRecord(full);
});
