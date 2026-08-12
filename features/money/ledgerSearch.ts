// Hledání v knize vazeb (/penize) — bez diakritiky, čistá funkce s testy.
//
// PROČ: kniha porovnávala `mp.name.toLowerCase().includes(q)`, takže „teplarny"
// nenašlo Teplárny Brno a „reznicek" nenašlo Řezníčka. V českém obchodním
// rejstříku to není okrajový případ — je to většina názvů firem i jmen.
//
// PROČ TAHLE FUNKCE SKLÁDÁNÍ: `asciiFold()` z `@/lib/ingest/normalize` je
// TÁŽ funkce, která při ingestu plní `person.name_norm` (a jeho btree index).
// Druhé schéma skládání nad jedním korpusem znamená, že jedna plocha najde to,
// co druhá ne — a money modul takové druhé schéma měl (`reviewTypes.foldKey`),
// dokud nespadlo sem. Zdůvodnění volby vypisuje features/civicscore/search.ts,
// který je pro žebříček přesně tímhle modulem.
//
// IČO se do složeného tvaru bere SYROVÉ: je to číslice, `asciiFold` na něm nic
// nemění a řetězec dotazu se s ním porovnává stejně jako se jménem.

import { asciiFold } from "@/lib/ingest/normalize";

/**
 * Složený tvar JEDNOHO řádku knihy — jméno poslance, název firmy a IČO
 * v jednom porovnávacím řetězci. Skládá se JEDNOU na seznam (memoizovaně
 * v komponentě), nikdy per úhoz per řádek: vzor je LeaderboardTable.tsx.
 */
export function tieSearchFold(mpName: string, company: string, ico: string): string {
  return `${asciiFold(mpName)} ${asciiFold(company)} ${ico}`;
}

/** Dotaz čtenáře → porovnatelný tvar. Prázdný (nebo jen bílý) dotaz = bez filtru. */
export function foldTieQuery(q: string): string {
  return asciiFold(q);
}

/** Odpovídá řádek dotazu? Prázdný dotaz odpovídá všemu. */
export function tieMatches(fold: string, foldedQuery: string): boolean {
  return foldedQuery.length === 0 || fold.includes(foldedQuery);
}
