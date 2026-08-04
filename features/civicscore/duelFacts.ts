// Souboj — co se vlastně porovnává, kromě kompozitu.
//
// PROBLÉM, KTERÝ TENHLE MODUL ŘEŠÍ: souboj uměl srovnat jen kompozit a šest
// vážených bodových hodnot — nejabstraktnější čísla, jaká aplikace vlastní.
// Čtenář neváží „14,2 bodu legislativy proti 11,8"; váží, jestli člověk mluvil,
// psal pozměňovací návrhy, dělal zpravodaje — a jestli vůbec převzal mandát.
//
// PRAVIDLA (proto je to čistá funkce s testy, ne logika v komponentě):
//  1. VLASTNÍ JEDNOTKA. Každý fakt se tiskne v jednotce, ve které vznikl
//     (vystoupení, návrhy, interpelace, tisky) — ne v odvozených bodech.
//  2. SNĚMOVNÍ REFERENCE = SKUTEČNÝ MEDIÁN. Tatáž konvence, jakou drží
//     lib/analysis/score-legibility.ts na spisu poslance — a přímo jeho
//     `median()`, aby v repozitáři nebyla druhá definice mediánu.
//     Medián se počítá jen z poslanců, kteří hodnotu MAJÍ.
//  3. CHYBĚJÍCÍ NENÍ NULA. `null` znamená „údaj v grafu chybí" a takhle se i
//     vykreslí; nikdy se nedopočítává na nulu.
//  4. VYŠŠÍ NENÍ VERDIKT. `factWinner` říká jen, která strana má vyšší číslo —
//     stejné pravidlo jako `componentWinner` v duel.ts, které se sem importuje
//     místo druhé kopie. Při shodě (nebo když jedné straně údaj chybí)
//     nevyhrává nikdo: srovnávat číslo s prázdnem není souboj.
//  5. PENÍZE SE NEPOROVNÁVAJÍ. Všech 211 vazeb v grafu je `pending_review`;
//     postavit je do souboje by z nepotvrzené stopy udělalo zjištění. Souboj
//     to v patičce říká nahlas, místo aby to mlčky vynechal.

import { median } from "@/lib/analysis/score-legibility";
import { componentWinner } from "./duel";
import type { DuelFacts, LeaderboardListEntry } from "./getLeaderboardData";

export type DuelFactKey = keyof Omit<DuelFacts, "tenureClass">;

export interface DuelFactDef {
  key: DuelFactKey;
  /** Co se měří, česky. */
  label: string;
  /** Jednotka za číslem (plurál se neohýbá — je to popisek osy, ne věta). */
  unit: string;
  /** Citace zdroje, tentýž tvar jako COMPONENT_DEFS. */
  source: string;
}

/** Pořadí = pořadí, ve kterém souboj fakta sází. */
export const DUEL_FACT_DEFS: readonly DuelFactDef[] = [
  { key: "speechTurns", label: "Vystoupení v sále", unit: "vystoupení", source: "psp.cz — stenozáznamy" },
  { key: "amendmentsAuthored", label: "Pozměňovací návrhy", unit: "návrhů", source: "psp.cz — sněmovní tisky" },
  { key: "interpellations", label: "Interpelace", unit: "interpelací", source: "psp.cz — písemné interpelace" },
  { key: "rapporteurLoad", label: "Zpravodajská zátěž", unit: "tisků", source: "psp.cz — tisky, role zpravodaje" },
];

export interface DuelFactRow {
  def: DuelFactDef;
  a: number | null;
  b: number | null;
  /** Medián sněmovny v téže jednotce, jen z poslanců, kteří hodnotu mají. */
  chamberMedian: number | null;
  /** Kolik poslanců do mediánu vstoupilo — bez toho je medián tvrzení bez opory. */
  chamberN: number;
  /** Která strana má vyšší číslo, nebo nikdo. Chybějící údaj = nikdo. */
  winner: "a" | "b" | null;
}

/**
 * Která strana má vyšší hodnotu. Chybějící údaj NIKDY neprohrává — „nevíme"
 * není horší výkon, a proto se nesrovnává.
 */
export function factWinner(a: number | null, b: number | null): "a" | "b" | null {
  if (a === null || b === null) return null;
  return componentWinner(a, b);
}

/**
 * Postaví řádky souboje. `chamber` jsou VŠICHNI poslanci žebříčku (souboj je
 * dostane jako prop — žádné další čtení storu), takže medián je skutečný
 * sněmovní medián, ne medián dvojice.
 */
export function duelFactRows(
  a: LeaderboardListEntry,
  b: LeaderboardListEntry,
  chamber: readonly LeaderboardListEntry[],
): DuelFactRow[] {
  return DUEL_FACT_DEFS.map((def) => {
    const values = chamber
      .map((e) => e.duelFacts[def.key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const va = a.duelFacts[def.key];
    const vb = b.duelFacts[def.key];
    return {
      def,
      a: va,
      b: vb,
      chamberMedian: median(values),
      chamberN: values.length,
      winner: factWinner(va, vb),
    };
  });
}
