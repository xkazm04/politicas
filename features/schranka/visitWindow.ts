/*
 * Okno návštěvy a pravidlo odznaku — ČISTÁ logika, kterou plocha /schranka
 * a odznak v liště jen volají. (Komponenty se v tomhle repu netestují — testy
 * jsou tady, proto tu ta logika bydlí.)
 *
 * ── DVĚ PRAVIDLA, ZÁMĚRNĚ RŮZNÁ ────────────────────────────────────────────
 * PLOCHA je shovívavá: záznamy deníku jsou datované DNEM, práh je proto den
 * poslední návštěvy a ten se počítá CELÝ znovu (deriveDeltas) — raději zápis
 * ukázat podruhé než nějaký zamlčet.
 *
 * ODZNAK to pravidlo mít nemůže: s ním by po návštěvě nikdy nezhasl (den
 * návštěvy zůstává nad prahem až do půlnoci) a číslo v liště by tvrdilo
 * „nové", i když si to čtenář právě přečetl. Odznak proto od počtu odečítá
 * VODOZNAK VIDĚNÉHO — kolik zápisů toho dne plocha při poslední návštěvě
 * skutečně nesla (SeenWatermark, ukládá se do localStorage vedle razítka).
 * Odečítá se jen tehdy, souhlasí-li den vodoznaku s dnem prahu; jinak se
 * neodečítá nic. Rozdíl obou pravidel plocha přiznává v textu.
 *
 * Vodoznak se počítá z řádků, které plocha DOSTALA, a ty jsou na entitu
 * seříznuté na DELTA_ENTRIES_CAP. Entita s víc než tolika zápisy JEDINÉHO dne
 * se tedy do vodoznaku vejde jen zčásti → odznak takový zbytek ukáže znovu.
 * Chyba míří k „ukázat podruhé", nikdy k zamlčení — což je táž volba jako na
 * ploše.
 */

import type { EntityDelta } from "./deriveDeltas";
import type { SeenWatermark } from "./followCodec";

/** Práh pohledu drží PŘEDCHOZÍ razítko; `day` je den razítka NOVÉHO (den,
 *  ke kterému se pak zapíše vodoznak viděného). */
export interface VisitWindow {
  prev: string | null;
  day: string;
}

/** Jednorázová pojistka razítkování. Instance drží komponenta v ref — víc
 *  než jednou se návštěva orazítkovat nesmí. */
export interface VisitGuard {
  stamped: boolean;
}

export const newVisitGuard = (): VisitGuard => ({ stamped: false });

/**
 * Orazítkuje návštěvu NEJVÝŠ JEDNOU a vrátí okno pohledu; druhé volání vrací
 * null a úložiště se nedotkne.
 *
 * Proč to není jednořádkový `setVisit((v) => v ?? { prev: stampVisit() })`:
 * React ve StrictMode volá updater dvakrát, takže by se dvakrát zapsalo
 * razítko — a protože při druhém volání je `v` pořád null, uložený „předchozí"
 * práh by byl čas právě zapsaný (= teď) a celé okno „od minulé návštěvy" by
 * se potichu zavřelo. Razítko se proto počítá PŘED setState a přes tuhle
 * pojistku (test: visitWindow.test.ts).
 */
export function openVisit(
  guard: VisitGuard,
  stamp: () => { prev: string | null; now: string },
): VisitWindow | null {
  if (guard.stamped) return null;
  guard.stamped = true;
  const { prev, now } = stamp();
  return { prev, day: now.slice(0, 10) };
}

/** Kolik zápisů s dnem >= `day` delty nesou (řádky, které plocha ukázala). */
export function countSeen(deltas: readonly EntityDelta[], day: string): number {
  let n = 0;
  for (const d of deltas) for (const e of d.entries) if (e.date >= day) n += 1;
  return n;
}

/**
 * Číslo odznaku: počet novinek od prahu MÍNUS to, co bylo při poslední
 * návštěvě vidět. Vodoznak z jiného dne se ignoruje (odečítat počet z jiného
 * prahu by lhalo), záporný výsledek neexistuje.
 */
export function badgeCount(total: number, since: string, seen: SeenWatermark | null): number {
  if (seen === null || seen.day !== since) return total;
  return Math.max(0, total - seen.count);
}
