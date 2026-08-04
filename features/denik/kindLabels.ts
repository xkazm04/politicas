/*
 * Deník republiky — ČTENÁŘSKÉ NÁZVY DRUHŮ ZÁPISU (2026-08-04).
 *
 * Druh řádku nesla do téhle opravy JEDINĚ barevná tečka, a ta je
 * `aria-hidden` — takže pro čtečku obrazovky, pro tisk i pro každého, kdo ty
 * čtyři odstíny nerozliší, deník svůj vlastní systém neexistoval. Druh se
 * proto vypisuje SLOVEM a tečka zůstává jen dekorací toho slova.
 *
 * PROČ NE slovník schránky (features/schranka/kindVocabulary.ts): ten dává
 * podstatné jméno pro POČET („3 smlouvy", tři tvary české shody s číslovkou)
 * a slouží souhrnu v hlavičce entity. Tady je potřeba jedno krátké označení
 * JEDNOHO řádku. Dvě různé práce, dva tvary — ne dvě kopie jedné věci; oba
 * slovníky ale mluví o týchž proudech týmiž slovy.
 *
 * PRAVIDLO: strojový token (`billAssigned`) se čtenáři neukáže nikdy. Druh,
 * který ve slovníku není, se vypíše DOSLOVA a označí jako nepřeložený
 * (precedens features/money/tieFlags.ts) — nikdy se nezamlčí.
 *
 * Čistý modul bez I/O: testuje se jako data.
 */

import type { DenikKind } from "./deriveDenik";

export const DENIK_KIND_LABELS: Record<DenikKind, string> = {
  contract: "smlouva",
  billAssigned: "přikázání tisku",
  billPublished: "vyhlášení ve Sbírce",
  roleStart: "zápis role",
  roleEnd: "výmaz role",
  review: "rozhodnutí brány",
  change: "zápis do grafu",
  mandate: "mandát",
  organRole: "funkce v orgánu",
};

/** Označení druhu pro jeden řádek. `translated: false` = slovník ho nezná a
 *  `text` je strojový token, který plocha označí jako nepřeložený. */
export function denikKindLabel(kind: string): { text: string; translated: boolean } {
  const label = (DENIK_KIND_LABELS as Record<string, string | undefined>)[kind];
  return label ? { text: label, translated: true } : { text: kind, translated: false };
}

/** Vysvětlení obou časových os U ŘÁDKU — do téhle opravy stály štítky
 *  „účinné"/„zaznamenáno" bez výkladu a ten byl o 200 px výš, mimo pohled
 *  čtenáře, který zrovna čte řádek. */
export const TIME_BASIS_TITLE = {
  ucinne:
    "účinné — řádek nese den, kdy se událost stala podle svého registru (podpis smlouvy, zápis role, krok tisku), ne den, kdy ji ingest našel",
  zaznamenano:
    "zaznamenáno — řádek nese den, kdy fakt vstoupil do záznamu: rozhodnutí lidské brány, nebo změna v grafu samotném",
} as const;
