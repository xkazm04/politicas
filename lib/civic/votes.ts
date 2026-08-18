// Čistá logika nad jmenovitými hlasováními — počítá se z dat, nehardcoduje.
// Linie strany = většinový směr hlasujících; disciplína = podíl přítomných
// hlasujících, kteří šli s linií. Sytí pilíř Nezávislost (psp.cz — odchylky
// od stranické linie).

import { PARTIES, ROLL_CALLS, type PartyVotes, type RollCall } from "./data";

export type LineDirection = "pro" | "proti";

/** Většinový směr strany v hlasování (remíza padá na „pro"). `null` = nikdo
 * nehlasoval (0 pro, 0 proti) — celá strana byla omluvena/nepřítomná pro toto
 * hlasování, což NENÍ totéž jako jednomyslné „pro". */
export const partyLine = (pv: PartyVotes): LineDirection | null =>
  pv.pro === 0 && pv.proti === 0 ? null : pv.pro >= pv.proti ? "pro" : "proti";

/**
 * Disciplína strany v jednom hlasování — podíl přítomných (pro+proti+zdržel),
 * kteří hlasovali s linií. 1 = nikdo nevybočil. `null` = nikdo nebyl přítomen
 * (present === 0) — dřívější sentinel `1` (100 %) tuto stranu zobrazoval jako
 * dokonale jednotnou, přestože neodevzdala jediný hlas.
 */
export const partyDiscipline = (pv: PartyVotes): number | null => {
  const present = pv.pro + pv.proti + pv.zdrzel;
  if (present === 0) return null;
  return Math.max(pv.pro, pv.proti) / present;
};

export interface PartyDisciplineRow {
  code: string;
  name: string;
  color: string;
  seats: number;
  /** Průměrná disciplína přes hlasování s alespoň jedním přítomným, 0–100 (1
   * desetinné místo). `null` když strana nebyla přítomna v žádném hlasování. */
  avg: number | null;
  /** Disciplína po hlasováních (index = ROLL_CALLS), 0–100, nebo `null` pro
   * hlasování bez jediného přítomného člena strany. */
  perRc: (number | null)[];
}

/** Disciplína všech stran přes ROLL_CALLS, seřazeno sestupně (strany bez
 * jediného měřitelného hlasování — `avg === null` — na konec). */
/**
 * Řazení řádků disciplíny: průměr SESTUPNĚ (strany bez měřitelného hlasování,
 * `avg === null`, jdou na konec), pak stabilní rozstřel podle mandátů a kódu.
 * Bez rozstřelu se rovnost průměru rozhodovala jen pořadím `PARTIES` + stabilním
 * V8 sortem — reorder zdroje by tiché strany prohodil (identity-survives-reuse).
 */
export const comparePartyDiscipline = (a: PartyDisciplineRow, b: PartyDisciplineRow): number =>
  (b.avg ?? -1) - (a.avg ?? -1) || b.seats - a.seats || a.code.localeCompare(b.code, "cs");

export const disciplineByParty = (rollCalls: RollCall[] = ROLL_CALLS): PartyDisciplineRow[] =>
  PARTIES.map((p) => {
    const perRc = rollCalls.map((rc) => {
      const d = partyDiscipline(rc.byParty[p.code]);
      return d === null ? null : Math.round(d * 1000) / 10;
    });
    const measured = perRc.filter((v): v is number => v !== null);
    const avg = measured.length > 0 ? Math.round((measured.reduce((s, v) => s + v, 0) / measured.length) * 10) / 10 : null;
    return { code: p.code, name: p.name, color: p.color, seats: p.seats, avg, perRc };
  }).sort(comparePartyDiscipline);

/** Rozdělení sněmovny v hlasování — pro/proti/zdržel/omluven přes všechny strany. */
export const chamberSplit = (rc: RollCall) =>
  PARTIES.reduce(
    (acc, p) => {
      const pv = rc.byParty[p.code];
      acc.pro += pv.pro;
      acc.proti += pv.proti;
      acc.zdrzel += pv.zdrzel;
      acc.omluven += pv.omluven;
      return acc;
    },
    { pro: 0, proti: 0, zdrzel: 0, omluven: 0 },
  );
