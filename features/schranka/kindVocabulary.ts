/*
 * Občanská schránka — SLOVNÍK DRUHŮ zápisu (moonshot 7A, vlna 2).
 *
 * Delta nese `kind` na každém řádku od začátku (deriveDeltas), ale plocha
 * kreslila nerozlišený seznam: čtenář viděl osm řádků a musel je přečíst, aby
 * zjistil, že šest jsou smlouvy a dva rozhodnutí brány. Souhrn druhů to řekne
 * v hlavičce entity.
 *
 * PRAVIDLO: čtenáři se nikdy neukáže strojový token (`billAssigned`). Tenhle
 * modul je JEDINÝ slovník — česká podstatná jména ve třech tvarech, které
 * čeština u počtu potřebuje (1 · 2–4 · 5+ a 0). Chybí-li druh ve slovníku,
 * vypíše se token DOSLOVA a označí jako nepřeložený (precedens
 * features/money/tieFlags.ts) — nikdy se nezamlčí.
 *
 * Čistý modul bez I/O: testuje se jako data.
 */

import type { DeltaEntry } from "./deriveDeltas";

/** Tři tvary, které česká shoda s číslovkou potřebuje. */
export interface KindNoun {
  /** 1 smlouva */
  one: string;
  /** 2–4 smlouvy */
  few: string;
  /** 0, 5+ smluv */
  many: string;
}

/**
 * Druh zápisu → české podstatné jméno. Formulace jsou tytéž, jakými o těch
 * proudech mluví deník i plocha schránky (žádný druhý hlas).
 */
export const KIND_NOUNS: Record<DeltaEntry["kind"], KindNoun> = {
  contract: { one: "smlouva", few: "smlouvy", many: "smluv" },
  billAssigned: { one: "přikázání tisku", few: "přikázání tisku", many: "přikázání tisku" },
  billPublished: { one: "vyhlášení ve Sbírce", few: "vyhlášení ve Sbírce", many: "vyhlášení ve Sbírce" },
  roleStart: { one: "zápis role", few: "zápisy role", many: "zápisů role" },
  roleEnd: { one: "výmaz role", few: "výmazy role", many: "výmazů role" },
  review: { one: "rozhodnutí brány", few: "rozhodnutí brány", many: "rozhodnutí brány" },
  change: { one: "zápis do grafu", few: "zápisy do grafu", many: "zápisů do grafu" },
  mandate: { one: "zápis o mandátu", few: "zápisy o mandátu", many: "zápisů o mandátu" },
  organRole: {
    one: "zápis o funkci v orgánu",
    few: "zápisy o funkci v orgánu",
    many: "zápisů o funkci v orgánu",
  },
  forensic: { one: "forenzní posudek", few: "forenzní posudky", many: "forenzních posudků" },
  recompute: { one: "přepočet indexu", few: "přepočty indexu", many: "přepočtů indexu" },
};

/**
 * Tvar podstatného jména pro počet. Čeština: 1 → one, 2–4 → few, jinak many
 * (včetně nuly). Záporný počet neexistuje; kdyby přišel, chová se jako many.
 */
export function kindNoun(kind: string, count: number): { text: string; translated: boolean } {
  const noun = (KIND_NOUNS as Record<string, KindNoun | undefined>)[kind];
  // Neznámý druh: token DOSLOVA, označený jako nepřeložený — zamlčet ho by
  // znamenalo, že řádky zmizí ze součtu, kterému má čtenář věřit.
  if (!noun) return { text: kind, translated: false };
  if (count === 1) return { text: noun.one, translated: true };
  if (count >= 2 && count <= 4) return { text: noun.few, translated: true };
  return { text: noun.many, translated: true };
}

/** Jedna položka souhrnu druhů — počet + hotová česká fráze („3 smlouvy"). */
export interface KindTally {
  kind: string;
  count: number;
  /** Podstatné jméno ve tvaru pro `count`. */
  nounCs: string;
  /** false = druh není ve slovníku a `nounCs` je strojový token. */
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
    const noun = kindNoun(c.kind, c.count);
    out.push({ kind: c.kind, count: c.count, nounCs: noun.text, translated: noun.translated });
  }
  return out;
}
