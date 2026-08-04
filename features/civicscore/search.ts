// Jméno → hledání bez diakritiky (žebříček /zebricek).
//
// PROČ: tabulka hledala `r.name.toLowerCase().includes(q)`, takže „zacek" nenašel
// „Žáček" a „rehor" nenašel „Řehoř" — v české sněmovně to není okrajový případ,
// je to většina jmen. Skládání diakritiky UŽ v repozitáři existuje: `asciiFold()`
// z `@/lib/ingest/normalize` je přesně ta funkce, která při ingestu plní sloupec
// `person.name_norm` (a jeho btree index). Tenhle modul ji jen používá — druhé
// schéma skládání se nezavádí.
//
// Proč se nečte `name_norm` ze storu: žebříček čte `kg_node` (uzel person), ne
// relační tabulku `person`, a jeho popisek je `kg_node.label`. Napojení na
// `name_norm` by znamenalo další čtení celé relace kvůli jednomu textovému poli;
// složit 207 popisků v paměti je levnější a dává TÝŽ výsledek, protože jde o
// tutéž funkci, která ten sloupec vyrobila.
//
// Hledání je čistá funkce s testy (search.test.ts) — stejná disciplína jako
// duel.ts a lens.ts.

import { asciiFold } from "@/lib/ingest/normalize";

/** Dotaz čtenáře → porovnatelný tvar (bez diakritiky, malá písmena, ořezaný). */
export function foldQuery(q: string): string {
  return asciiFold(q);
}

/**
 * Odpovídá jméno dotazu? Prázdný (nebo jen bílý) dotaz odpovídá všemu.
 * Porovnává se podřetězec ve složeném tvaru na OBOU stranách, takže „zacek"
 * najde „Žáček" a „Žáček" najde „Žáček" stejně.
 */
export function nameMatches(foldedName: string, foldedQuery: string): boolean {
  return foldedQuery.length === 0 || foldedName.includes(foldedQuery);
}
