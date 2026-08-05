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
 * COPY JE V KATALOGU (2026-08-05, vzor features/overeni/gateVocabulary.ts):
 * modul vrací KLÍČE do messages/{cs,en}.json pod `denik.*`, ne českou větu —
 * plocha je sází přes next-intl. Slovník vlastní klasifikaci, katalog copy.
 *
 * Čistý modul bez I/O: testuje se jako data.
 */

import type { DenikKind, DenikTimeBasis } from "./deriveDenik";

/** Klíč krátkého označení druhu (namespace `denik`). */
export const DENIK_KIND_LABEL_KEYS: Record<DenikKind, string> = {
  contract: "kind.contract",
  billAssigned: "kind.billAssigned",
  billPublished: "kind.billPublished",
  roleStart: "kind.roleStart",
  roleEnd: "kind.roleEnd",
  review: "kind.review",
  change: "kind.change",
  mandate: "kind.mandate",
  organRole: "kind.organRole",
};

/** Klíč pro druh, který slovník nezná — bere `{token}` a plocha ho označí
 *  jako nepřeložený (`DENIK_KIND_UNMAPPED_NOTE_KEY`). Nikdy se nezamlčí. */
export const DENIK_KIND_UNMAPPED_KEY = "kind.unmapped";

/** Klíč poznámky „(nepřeložený druh)" vedle doslovného tokenu. */
export const DENIK_KIND_UNMAPPED_NOTE_KEY = "kind.unmappedNote";

export interface DenikKindInfo {
  /** Doslovný strojový token — vždy k dispozici, i u přeloženého druhu. */
  token: string;
  /** false ⇒ slovník druh nezná; plocha vypíše token DOSLOVA a označí ho. */
  known: boolean;
  /** Klíč do katalogu `denik.*`; u neznámého druhu bere `{token}`. */
  labelKey: string;
}

/** Označení druhu pro jeden řádek — KLASIFIKACE + klíč copy. Neznámý druh si
 *  nese sám sebe (doslova) a plocha ho označí jako nepřeložený. */
export function denikKindInfo(kind: string): DenikKindInfo {
  const labelKey = (DENIK_KIND_LABEL_KEYS as Record<string, string | undefined>)[kind];
  return labelKey
    ? { token: kind, known: true, labelKey }
    : { token: kind, known: false, labelKey: DENIK_KIND_UNMAPPED_KEY };
}

/** Štítek časové osy u řádku („účinné" / „zaznamenáno"). */
export const TIME_BASIS_LABEL_KEYS: Record<DenikTimeBasis, string> = {
  ucinne: "timeBasis.ucinne",
  zaznamenano: "timeBasis.zaznamenano",
};

/** Vysvětlení obou časových os U ŘÁDKU (title + aria-label štítku) — do
 *  opravy 2026-08-04 stály štítky bez výkladu a ten byl o 200 px výš, mimo
 *  pohled čtenáře, který zrovna čte řádek. */
export const TIME_BASIS_TITLE_KEYS: Record<DenikTimeBasis, string> = {
  ucinne: "timeBasis.ucinneTitle",
  zaznamenano: "timeBasis.zaznamenanoTitle",
};

/** Všechny klíče, které tenhle modul umí vrátit — pro test úplnosti katalogu. */
export const DENIK_KIND_COPY_KEYS: readonly string[] = [
  ...Object.values(DENIK_KIND_LABEL_KEYS),
  DENIK_KIND_UNMAPPED_KEY,
  DENIK_KIND_UNMAPPED_NOTE_KEY,
  ...Object.values(TIME_BASIS_LABEL_KEYS),
  ...Object.values(TIME_BASIS_TITLE_KEYS),
];
