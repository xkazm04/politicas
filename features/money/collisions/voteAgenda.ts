// Autoritativní spojení hlasování → sněmovní tisk přes pořad schůze.
//
// Titulky hlasování v opendatech PSP číslo tisku NENESOU (změřeno na živém
// ledgeru: 0 z 2 014 titulků PSP10 obsahuje „tisk N" — tvary jako
// „Vl.n.z. o evidenci tržeb" jsou zkratky bez čísla). Deterministický klíč
// existuje jinde: vote_event nese (termPspId, sessionNo, agendaItem) a dump
// schuze.zip mapuje bod pořadu na INTERNÍ id tisku:
//   schuze.unl     : 0 id_schuze | 1 id_org (organ volebního období) | 2 číslo schůze
//   bod_schuze.unl : 0 id_bod | 1 id_schuze | 2 id_tisk (interní id, týž klíč
//                    jako bill:tisk:<id>; prázdné u netiskových bodů) | 4 číslo bodu
// (rozvržení sloupců ověřené proti živým dumpům — týž zápis jako
// lib/ingest/sources/psp-activity.ts, pass 35.)
//
// VYHLÁŠENÉ PRAVIDLO (součást metodiky na /penize/strety): hlasování je
// napojeno na tisk, právě když jeho (schůze, bod) vede v pořadu schůze na
// PRÁVĚ JEDEN tisk. Bod projednávající víc tisků najednou (společná rozprava)
// se poctivě VYNECHÁVÁ a počítá zvlášť — konzervativně žádný kandidát nad
// nejednoznačným klíčem. Žádné porovnávání názvů, žádná inference.
//
// Čisté funkce nad UnlRow (parsery lib/ingest se importují jen ke čtení);
// IO (čtení .data/psp/schuze.zip) drží loader.

import { colInt, type UnlRow } from "@/lib/ingest/unl";

/** Klíč hlasování v pořadu schůze. */
export const agendaKey = (termPspId: number, sessionNo: number, agendaItem: number): string =>
  `${termPspId}:${sessionNo}:${agendaItem}`;

export type AgendaTisk = number | "ambiguous";

/**
 * (organ období, číslo schůze, číslo bodu) → interní id tisku, nebo
 * "ambiguous", když bod vede na víc různých tisků. Body bez tisku se
 * nevkládají vůbec (procedurální hlasování tak z joinu vypadnou mlčky
 * správně — nemají co zasáhnout).
 */
export function buildAgendaTiskMap(
  schuze: readonly UnlRow[],
  bodSchuze: readonly UnlRow[],
): Map<string, AgendaTisk> {
  // id_schuze → (id_org, číslo schůze); dumpy obsahují řádky vícekrát
  // (varianty stavu) — hodnoty jsou identické, poslední zápis vyhrává.
  const schuzeById = new Map<number, { org: number; no: number }>();
  for (const r of schuze) {
    const id = colInt(r, 0);
    const org = colInt(r, 1);
    const no = colInt(r, 2);
    if (id != null && org != null && no != null) schuzeById.set(id, { org, no });
  }

  const out = new Map<string, AgendaTisk>();
  for (const r of bodSchuze) {
    const idSchuze = colInt(r, 1);
    const idTisk = colInt(r, 2);
    const bodNo = colInt(r, 4);
    if (idSchuze == null || idTisk == null || bodNo == null) continue;
    const s = schuzeById.get(idSchuze);
    if (!s) continue;
    const key = agendaKey(s.org, s.no, bodNo);
    const prev = out.get(key);
    if (prev === undefined) out.set(key, idTisk);
    else if (prev !== idTisk) out.set(key, "ambiguous");
  }
  return out;
}
