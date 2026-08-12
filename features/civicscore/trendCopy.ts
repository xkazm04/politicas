/*
 * Datový přístup panelu „Vývoj proti minulému období" (TrendPanel) — PURE, bez Reactu.
 *
 * ČÍM TENHLE SOUBOR BYL: do 2026-08-04 stály všechny věty panelu jako inline
 * literály přímo v JSX, jediná čtenářská kopie v /poslanec, která nepatřila
 * žádnému enginu a nebyla přibitá k jazykové bráně. Přesunuly se sem — a odtud
 * 2026-08-05 do dvoujazyčných katalogů (`civicscore.trend*`), protože panel od
 * té doby skládá věty přes next-intl.
 *
 * ČÍM JE TEĎ: zbyla JEDNA funkce, kterou opravdu někdo volá. Ostatní exporty
 * (`trendHeading`, `TREND_PARTIAL_LABEL`, `TREND_COUNT_LABELS`, `trendPendingNote`,
 * `trendSourceNote`) žily dál jako „referenční kopie" bez jediného volajícího —
 * pět českých vět, které se nikde nevykreslovaly, ale které by při další změně
 * copy někdo poctivě aktualizoval. Mrtvá kopie je horší než žádná: vypadá jako
 * pravda o ploše, kterou už nepopisuje. Smazány 2026-08-12; živé znění je
 * v messages/{cs,en}.json.
 *
 * Co zůstalo, ZÁMĚRNĚ není copy: název dumpu je DATOVÝ údaj (soubor na psp.cz),
 * ne věta — v katalogu by z něj byl překládatelný text, kterým není, a jmenuje
 * se JEN pro období, kterého se týká.
 */

/** Dump, který chybějící složky odemkne — jmenuje se JEN pro období, kterého se týká. */
const PRIOR_TERM_VOTE_DUMP: Record<string, string> = {
  PSP9: "hl-2021ps.zip",
};

/**
 * Název dumpu jmenných hlasování pro dané období, nebo null. Věty kolem něj
 * skládá TrendPanel z katalogu (`civicscore.trend*`); tenhle modul o nich neví.
 */
export function priorTermVoteDump(priorTerm: string): string | null {
  return PRIOR_TERM_VOTE_DUMP[priorTerm] ?? null;
}
