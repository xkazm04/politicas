/*
 * STAV ZDROJŮ PRO TITULNÍ STRANU — čistá projekce atlasu kvality otevřených dat
 * (lib/analysis/atlas.ts) do toho mála, co rubrika „Surový materiál" vykreslí.
 *
 * Proč vůbec existuje: titulní strana do 2026-08-12 vypisovala SEDM ukázkových
 * zdrojů z lib/civic/data.ts („denně", „téměř real-time", „průběžně") pod
 * titulkem „ověřené veřejné zdroje" a bez jediné citace — přitom hlavička toho
 * souboru sama říká, že všechna čísla jsou ilustrativní mock. Atlas přitom už
 * měří skutečný stav každého zdroje a tiskne k němu pravidlo. Fasáda teď čte
 * jeho výstup a nic si nedopočítává.
 *
 * DISCIPLÍNA (tři pravidla, která se odsud nesmí ztratit)
 *  1. NIC SE NEPOČÍTÁ ZNOVU. Pokrytí provenancí je skóre dimenze `coverage`
 *     tak, jak ho spočítal atlas — ne druhý podíl `rowsWithRun / rowsTotal`.
 *     Dvě aritmetiky nad jedním číslem se rozejdou a čtenář dostane dvě čísla
 *     o téže věci.
 *  2. NEHODNOCENO NENÍ NULA. Diskriminovaná unie `AtlasScore` se sem překlápí
 *     jako `number | null`; `null` znamená „bez podkladu" a plocha ho musí
 *     vypsat slovem, nikdy jako 0 (to je tvrzení o kvalitě).
 *  3. POŘADÍ JE POŘADÍ ATLASU. `AtlasReport.sources` je řazený podle klíče
 *     zdroje vzestupně (deterministicky); titulní strana ho nepřerovnává —
 *     jakékoli řazení podle skóre by z rubriky udělalo žebříček zdrojů.
 *  4. TOHLE NENÍ SEZNAM ZDROJŮ PLATFORMY (přidáno 2026-08-13). `AtlasReport
 *     .sources` nese jen ty zdroje, které atlas UMÍ změřit — dnes tři z dvanácti,
 *     se kterými politicas pracuje. Rubrika proto vedle dlaždic vypisuje větu
 *     o dosahu atlasu (`atlas.unscored.landingNote` v DataSources.tsx) a vede na
 *     /atlas, kde je zbytek pojmenovaný i s důvodem. Bez ní tři dlaždice mlčky
 *     tvrdily, že platforma má tři zdroje. Počty tam jsou DEKLAROVANÉ (registr
 *     `INGESTED_SOURCES`), ne měřené — nepatří sem, do projekce měření.
 */

import type { AtlasReport, AtlasScore, Staleness } from "@/lib/analysis/atlas";

/** Skóre dimenze tak, jak ho vykreslí fasáda: číslo, nebo `null` = nehodnoceno. */
function scoreOrNull(s: AtlasScore): number | null {
  return s.status === "hodnoceno" ? s.score : null;
}

/** Jeden zdroj na fasádě — podmnožina `AtlasSourceCard`, kterou rubrika sází. */
export interface LandingSourceState {
  /** Klíč zdroje v atlasu (`psp-hlasovani`) — strojový, vykresluje se doslova. */
  source: string;
  /** Souhrn = průměr HODNOCENÝCH dimenzí; `score: null` = žádná dimenze nemá podklad. */
  composite: {
    status: "hodnoceno" | "částečné" | "nehodnoceno";
    score: number | null;
    evaluated: number;
    of: number;
  };
  /** Pásmo stáří proti DEKLAROVANÉ kadenci; `null` = čerstvost nehodnocena. */
  staleness: Staleness | null;
  /** Řádky zdroje ve store (celkem). */
  rowsTotal: number;
  /** Pokrytí provenancí v procentech — skóre dimenze `coverage`, ne druhý podíl. */
  coveragePct: number | null;
}

/**
 * Report → řádky fasády. `null` (nečitelný store) prochází dál jako `null`:
 * rubrika pak přizná, že stav zdrojů teď nelze změřit — nikdy nedopisuje
 * kadence, které nikdo nezměřil.
 */
export function landingSourceStates(report: AtlasReport | null): LandingSourceState[] | null {
  if (report === null) return null;
  return report.sources.map((card) => ({
    source: card.source,
    composite: {
      status: card.composite.status,
      score: card.composite.score,
      evaluated: card.composite.evaluated,
      of: card.composite.of,
    },
    staleness: card.freshness.staleness,
    rowsTotal: card.rowsTotal,
    coveragePct: scoreOrNull(card.dimensions.coverage),
  }));
}
