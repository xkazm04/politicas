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

import { pragueDay } from "@/features/denik/pragueDay";
import type { EntityDelta } from "./deriveDeltas";
import type { SeenWatermark } from "./followCodec";

/** Práh pohledu drží PŘEDCHOZÍ razítko; `now` je okamžik téhle návštěvy (ten
 *  se zapíše, až plocha data opravdu ukáže) a `day` jeho den (den, ke kterému
 *  se pak zapíše vodoznak viděného). */
export interface VisitWindow {
  prev: string | null;
  now: string;
  day: string;
}

/** Jednorázová pojistka okna i zápisu. Instance drží komponenta v ref — víc
 *  než jednou se návštěva neotevře ani neorazítkuje. */
export interface VisitGuard {
  stamped: boolean;
  committed: boolean;
}

export const newVisitGuard = (): VisitGuard => ({ stamped: false, committed: false });

/**
 * Otevře okno návštěvy NEJVÝŠ JEDNOU: přečte předchozí razítko a nic
 * nezapíše; druhé volání vrací null.
 *
 * Proč to není jednořádkový `setVisit((v) => v ?? { prev: stampVisit() })`:
 * React ve StrictMode volá updater dvakrát, a kdyby čtení razítko zároveň
 * zapisovalo, druhé volání by za „předchozí" práh vzalo čas právě zapsaný
 * (= teď) a celé okno „od minulé návštěvy" by se potichu zavřelo. Proto se
 * okno počítá PŘED setState a přes tuhle pojistku (test: visitWindow.test.ts).
 */
export function openVisit(
  guard: VisitGuard,
  peek: () => { prev: string | null; now: string },
): VisitWindow | null {
  if (guard.stamped) return null;
  guard.stamped = true;
  const { prev, now } = peek();
  // Den razítka je PRAŽSKÝ den okamžiku (týž kalendář jako `sinceDay` a server).
  return { prev, now, day: pragueDay(new Date(now)) };
}

/**
 * Zapíše razítko návštěvy NEJVÝŠ JEDNOU — a jen tehdy, když plocha čtenáři
 * delty opravdu ukázala: odpověď přišla (`data` není undefined = načítá se,
 * ani null = nelze načíst), nebo nebylo co načítat (nic se nesleduje).
 *
 * Razítko totiž tvrdí „tohle čtenář viděl". Zapsané už při otevření by po
 * chybě načtení nebo po zavření záložky dřív, než data dorazila, posunulo
 * práh na dnešek a zápisy mezi minulou návštěvou a dneškem by příští
 * návštěva už nikdy neukázala. Vrací, zda se zapisovalo.
 */
export function commitVisit(
  guard: VisitGuard,
  visit: VisitWindow | null,
  data: unknown,
  nothingToFetch: boolean,
  commit: (at: string) => void,
): boolean {
  if (guard.committed || visit === null) return false;
  if (!nothingToFetch && (data === undefined || data === null)) return false;
  guard.committed = true;
  commit(visit.now);
  return true;
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
