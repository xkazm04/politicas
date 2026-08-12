/*
 * OMLUVY PO DNECH — čistá projekce evidence omluv na jeden mandát.
 *
 * Spis dosud tiskl JEDINÉ číslo o docházce: `absence_rate`, s citací
 * „omluvené dny / jednací dny" — tedy poměr dvou veličin, které nikde nestály.
 * Přitom evidence, ze které ten čitatel vzniká, je datovaná a časovaná: 6 425
 * řádků za 10. období (změřeno 2026-08-12). Tenhle modul z nich dělá řádky,
 * které si čtenář může přečíst.
 *
 * PRAVIDLA
 *  • Jeden DEN = jeden řádek. psp.cz podává omluvu jako ČASOVÉ OKNO a jeden den
 *    jich klidně nese víc (v 10. období 1 243 dvojic mandát×den má víc než jedno
 *    okno). Okna se proto skládají pod svůj den; slučovat je do „celého dne" by
 *    znamenalo tvrdit něco, co zdroj neříká — dvě sousední okna nejsou jeden
 *    celodenní záznam, dokud to tak sněmovna sama nezapíše (`whole_day`).
 *  • Řadí se od nejnovějšího dne. Uvnitř dne od nejdřívějšího okna (prázdný
 *    začátek první), aby pořadí neurčovalo pořadí čtení z databáze.
 *  • Strop se PŘIZNÁVÁ: `days` je useknutý výpis, `totalDays` a `filings`
 *    počítají celý záznam (precedens PROFILE_REBELLION_ROWS).
 *  • BUDOUCÍ DEN JE SKUTEČNÝ ZÁZNAM. Omluva se podává dopředu — v 10. období
 *    jich 10 leží za dneškem. Nevyhazují se ani se neopravují; jen se počítají,
 *    aby stránka mohla říct, proč seznam začíná datem, které ještě nenastalo.
 *  • Den, který se nedá přečíst jako datum, není datovaný záznam: vypadne a
 *    počítá se (precedens `droppedImplausible` v deníku).
 *
 * Co tady NENÍ a být nemůže: DŮVOD. `omluvy.unl` má přesně sloupce
 * (id_organ, id_poslanec, den, od, do) — proč poslanec chyběl, zdroj nezveřejňuje
 * (lib/ingest/sources/psp.ts). Stránka to říká místo aby čtenář domýšlel.
 *
 * Čistý modul (žádný store, žádný server) — sdílí ho loader i test.
 */

/** Dnů, které spis vypisuje. Prezentační mez jako `PROFILE_REBELLION_ROWS`,
 *  a jako ona přiznaná: medián poslance 10. období je 25 dnů, maximum 72. */
export const PROFILE_ABSENCE_DAYS = 12;

/** Jedno podání: časové okno, nebo celý den, jak to zapsala sněmovna. */
export interface AbsenceWindow {
  /** `od` — čas ve tvaru „HH:MM"; null = zdroj čas neuvádí. */
  from: string | null;
  /** `do` — čas ve tvaru „HH:MM"; null = zdroj čas neuvádí. */
  to: string | null;
  /** `whole_day` ze zdroje (ingest: ani `od`, ani `do`). Nikdy se nedovozuje. */
  wholeDay: boolean;
}

export interface AbsenceDay {
  /** ISO den (YYYY-MM-DD). */
  day: string;
  /** Okna toho dne, od nejdřívějšího. */
  windows: AbsenceWindow[];
  /** Nese ten den aspoň jedno celodenní podání? */
  wholeDay: boolean;
  /** Leží ten den v budoucnosti vůči dni, ke kterému se stránka staví? */
  future: boolean;
}

export interface ProfileAbsenceRecord {
  /** Nejnovější dny, useknuté na `PROFILE_ABSENCE_DAYS`. */
  days: AbsenceDay[];
  /** Dny s aspoň jednou omluvou v CELÉM záznamu (před stropem výpisu).
   *  Tohle je veličina, kterou index počítá jako čitatele míry docházky. */
  totalDays: number;
  /** Řádků evidence (podání), tedy oken — ne dnů. */
  filings: number;
  /** Nejstarší a nejnovější den záznamu. */
  from: string | null;
  to: string | null;
  /** Dnů, které leží za dneškem (omluva podaná dopředu). */
  futureDays: number;
  /** Řádků, jejichž den se nedal přečíst — vypadly, a je jich vidět kolik. */
  droppedUndated: number;
}

/** Řádek evidence, jak ho vrací store (`AbsenceRow`), zúžený na to, co se čte. */
export interface AbsenceRowInput {
  day: string;
  fromTime: string | null;
  toTime: string | null;
  wholeDay: boolean;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Klíč okna — dvě identická podání téhož dne jsou jeden řádek, ne dva. */
const windowKey = (w: AbsenceWindow) => `${w.from ?? ""}|${w.to ?? ""}|${w.wholeDay ? "1" : "0"}`;

/**
 * Evidence → dny. `today` je den, ke kterému se měří „budoucí" (pražský den
 * loaderu — datum se tady nikdy nebere z hodin, aby projekce zůstala čistá).
 */
export function buildAbsenceRecord(
  rows: readonly AbsenceRowInput[],
  today: string,
  cap: number = PROFILE_ABSENCE_DAYS,
): ProfileAbsenceRecord {
  const byDay = new Map<string, Map<string, AbsenceWindow>>();
  let droppedUndated = 0;
  let filings = 0;

  for (const r of rows) {
    const day = (r.day ?? "").slice(0, 10);
    if (!ISO_DAY.test(day)) {
      droppedUndated++;
      continue;
    }
    filings++;
    const w: AbsenceWindow = { from: r.fromTime, to: r.toTime, wholeDay: r.wholeDay };
    let windows = byDay.get(day);
    if (!windows) {
      windows = new Map();
      byDay.set(day, windows);
    }
    const key = windowKey(w);
    if (!windows.has(key)) windows.set(key, w);
  }

  const dayKeys = [...byDay.keys()].sort((a, b) => b.localeCompare(a));
  const days: AbsenceDay[] = dayKeys.slice(0, Math.max(0, cap)).map((day) => {
    const windows = [...byDay.get(day)!.values()].sort(
      (a, b) => (a.from ?? "").localeCompare(b.from ?? "") || (a.to ?? "").localeCompare(b.to ?? ""),
    );
    return {
      day,
      windows,
      wholeDay: windows.some((w) => w.wholeDay),
      future: day > today,
    };
  });

  return {
    days,
    totalDays: dayKeys.length,
    filings,
    from: dayKeys.length > 0 ? dayKeys[dayKeys.length - 1] : null,
    to: dayKeys.length > 0 ? dayKeys[0] : null,
    futureDays: dayKeys.filter((d) => d > today).length,
    droppedUndated,
  };
}
