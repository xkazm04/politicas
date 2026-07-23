// Čistá logika nad jmenovitými hlasováními — počítá se z dat, nehardcoduje.
// Linie strany = většinový směr hlasujících; disciplína = podíl přítomných
// hlasujících, kteří šli s linií. Sytí pilíř Nezávislost (psp.cz — odchylky
// od stranické linie).

import { PARTIES, ROLL_CALLS, type PartyVotes, type RollCall } from "./data";

export type LineDirection = "pro" | "proti";

/** Většinový směr strany v hlasování (remíza padá na „pro"). */
export const partyLine = (pv: PartyVotes): LineDirection => (pv.pro >= pv.proti ? "pro" : "proti");

/**
 * Disciplína strany v jednom hlasování — podíl přítomných (pro+proti+zdržel),
 * kteří hlasovali s linií. 1 = nikdo nevybočil.
 */
export const partyDiscipline = (pv: PartyVotes): number => {
  const present = pv.pro + pv.proti + pv.zdrzel;
  if (present === 0) return 1;
  return Math.max(pv.pro, pv.proti) / present;
};

export interface PartyDisciplineRow {
  code: string;
  name: string;
  color: string;
  seats: number;
  /** Průměrná disciplína přes všechna hlasování, 0–100 (1 desetinné místo). */
  avg: number;
  /** Disciplína po hlasováních (index = ROLL_CALLS), 0–100. */
  perRc: number[];
}

/** Disciplína všech stran přes ROLL_CALLS, seřazeno sestupně. */
export const disciplineByParty = (rollCalls: RollCall[] = ROLL_CALLS): PartyDisciplineRow[] =>
  PARTIES.map((p) => {
    const perRc = rollCalls.map((rc) => Math.round(partyDiscipline(rc.byParty[p.code]) * 1000) / 10);
    const avg = Math.round((perRc.reduce((s, v) => s + v, 0) / (perRc.length || 1)) * 10) / 10;
    return { code: p.code, name: p.name, color: p.color, seats: p.seats, avg, perRc };
  }).sort((a, b) => b.avg - a.avg);

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
