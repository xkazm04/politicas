/*
 * JEDEN VÝKLAD `review_state` PRO CELOU PLOCHU GRAFU — čistý modul.
 *
 * Žádný server, žádný DOM (doktrína trailPath.ts): sousedský oracle
 * (scripts/sentinel/path-oracle.ts) musí číst bránu TÝMŽ kódem jako loader,
 * a graphLoader.ts je `server-only` — kdyby helper bydlel tam, oracle by si
 * pravidlo musel opsat, a opis je přesně ta chyba, kterou tenhle modul léčí.
 *
 * PRAVIDLO SE TU NEODVOZUJE, JEN OBALUJE. `gateFromEdge` z účtenky
 * (features/shared/provenance/receipt.ts) je jediný výklad `review_state`
 * v repozitáři: negated relace (mimo GATED_RELS, bez zapsaného stavu) → null,
 * `verified`/`rejected` doslova, cokoli jiného na gated relaci → „čeká".
 * Tady se z něj bere jen status a provenience se přepisuje doslova.
 *
 * PROČ TO VZNIKLO (2026-09-04): plocha grafu srážela tři stavy na jeden
 * boolean `pending`, takže `rejected` — terminální rozhodnutí ČLOVĚKA, že
 * tvrzení neplatí — vycházelo jako `pending: false`, tedy k nerozeznání od
 * ověřeného. Zamítnutá vazba se kreslila plnou čarou, řadila se jako plnohodnotný
 * doložený krok v „Spoj dva body" a v balíčku důkazů odcházela jako
 * `review_state: verified`. Nejhůř opravitelný artefakt produktu certifikoval
 * lidské odmítnutí jako ověření.
 */

import { gateFromEdge, toProvenance } from "@/features/shared/provenance/receipt";
import { pendingFromGate, type EdgeProvenance, type GateStatus } from "./graphTypes";

/** Řádek hrany tak, jak ho brána potřebuje — užší než KgEdgeRow, aby šel
 *  poskládat i z fixture bez celého řádku skladu. */
export interface GatedEdgeRow {
  src: string;
  rel: string;
  dst: string;
  weight?: number | null;
  props: Record<string, unknown>;
  provenance?: Record<string, unknown> | null;
}

/** Stav lidské brány hrany; null = relace branou neprochází. */
export const gateOf = (e: GatedEdgeRow): GateStatus | null =>
  gateFromEdge({ src: e.src, rel: e.rel, dst: e.dst, weight: e.weight ?? null, props: e.props, provenance: e.provenance ?? {} }, [])
    ?.status ?? null;

/**
 * Provenience hrany doslova. `null` = hrana nenese ANI pass, ANI method, ANI
 * ref — prázdný objekt není původ a nedosazuje se za něj žádný (missing-is-
 * not-zero: „nevíme, čím to vzniklo" se nesmí tvářit jako průchod č. 0).
 */
export const provenanceOf = (e: GatedEdgeRow): EdgeProvenance | null => {
  const p = toProvenance(e.provenance);
  return p.pass === null && p.method === null && p.ref === null
    ? null
    : { pass: p.pass, method: p.method, ref: p.ref };
};

/** Trojice, kterou si každý stavitel hrany bere naráz. */
export const gateFieldsOf = (
  e: GatedEdgeRow,
): { pending: boolean; gate: GateStatus | null; provenance: EdgeProvenance | null } => {
  const gate = gateOf(e);
  return { pending: pendingFromGate(gate), gate, provenance: provenanceOf(e) };
};
