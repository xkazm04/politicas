/*
 * Občanská schránka — SLOVNÍK DRUHŮ zápisu (moonshot 7A, vlna 2).
 *
 * Delta nese `kind` na každém řádku od začátku (deriveDeltas), ale plocha
 * kreslila nerozlišený seznam: čtenář viděl osm řádků a musel je přečíst, aby
 * zjistil, že šest jsou smlouvy a dva rozhodnutí brány. Souhrn druhů to řekne
 * v hlavičce entity.
 *
 * PRAVIDLO: čtenáři se nikdy neukáže strojový token (`billAssigned`). Tenhle
 * modul je JEDINÝ slovník — od 2026-08-05 vrací KLÍČE do katalogu
 * `schranka.kinds.*` v messages/*.json (ICU plural nese tvary 1 · 2–4 · 5+,
 * které čeština u počtu potřebuje); plocha je sází přes next-intl (precedens
 * features/overeni/gateVocabulary.ts). Chybí-li druh ve slovníku, vypíše se
 * token DOSLOVA a označí jako nepřeložený (precedens features/money/tieFlags.ts)
 * — nikdy se nezamlčí.
 *
 * Čistý modul bez I/O: testuje se jako data.
 */

import type { DeltaEntry } from "./deriveDeltas";

/**
 * Druh zápisu → klíč podstatného jména v katalogu `schranka.*`. Hodnoty
 * v messages/*.json jsou ICU plural zprávy ({count, plural, …}) — tvar pro
 * počet vybírá katalog, ne tenhle modul.
 */
export const KIND_NOUN_KEYS: Record<DeltaEntry["kind"], string> = {
  contract: "kinds.contract",
  billAssigned: "kinds.billAssigned",
  billPublished: "kinds.billPublished",
  roleStart: "kinds.roleStart",
  roleEnd: "kinds.roleEnd",
  review: "kinds.review",
  change: "kinds.change",
  mandate: "kinds.mandate",
  organRole: "kinds.organRole",
  forensic: "kinds.forensic",
  recompute: "kinds.recompute",
};

/**
 * Klíč podstatného jména pro druh. Neznámý druh: klíč není (null) a `token`
 * nese druh DOSLOVA, označený jako nepřeložený — zamlčet ho by znamenalo, že
 * řádky zmizí ze součtu, kterému má čtenář věřit.
 */
export function kindNounKey(kind: string): { key: string | null; token: string; translated: boolean } {
  const key = (KIND_NOUN_KEYS as Record<string, string | undefined>)[kind];
  if (key === undefined) return { key: null, token: kind, translated: false };
  return { key, token: kind, translated: true };
}

/** Jedna položka souhrnu druhů — počet + klíč katalogu (nebo doslovný token). */
export interface KindTally {
  kind: string;
  count: number;
  /** Klíč do `schranka.*` (ICU plural bere {count}); null = druh není ve slovníku. */
  nounKey: string | null;
  /** false = druh není ve slovníku a plocha sází `kind` doslova. */
  translated: boolean;
}

/**
 * Souhrn druhů pro už spočítané dvojice (druh, počet) — pořadí VSTUPU se
 * zachovává (deriveDeltas je vydává v KIND_ORDER, což je pořadí, ve kterém
 * jsou řádky pod hlavičkou). Nulové počty se nevydávají.
 */
export function kindTallies(counts: readonly { kind: string; count: number }[]): KindTally[] {
  const out: KindTally[] = [];
  for (const c of counts) {
    if (c.count <= 0) continue;
    const noun = kindNounKey(c.kind);
    out.push({ kind: c.kind, count: c.count, nounKey: noun.key, translated: noun.translated });
  }
  return out;
}
