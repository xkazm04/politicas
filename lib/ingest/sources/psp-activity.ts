// Adapter for the psp.cz activity dumps that feed the Case ② contribution index:
// sněmovní tisky (bill authorship + written interpellations), interpelace (oral
// interpellations), and stenozáznamy (floor-speech turns). Same publisher, same UNL
// format (windows-1250, pipe-delimited) as poslanci/hlasovani — see ./psp.ts.
//
// Everything attributes to `id_osoba` (the person key we already use); term scope is
// the term's organ id (PSP10 = 174), read from a different column per dataset. Schema
// verified against the live 2026-07-23 dumps (see the research spec):
//   tisky.zip  : tisky.unl (id_tisk|id_druh|…|id_navrh|id_org_obd|id_osoba|…),
//                predkladatel.unl (id_tisk|id_osoba|poradi|typ)  ← authoritative authorship
//   interp.zip : li.unl (id_los|…|id_org), poradi.unl (id_poradi|id_losovani|id_poslanec=id_osoba|…)
//   steno.zip  : steno.unl (id_steno|id_org|…), rec.unl (id_steno|id_osoba|aname|id_bod|druh)
//
// The aggregation logic is pure over parsed UNL rows (testable with parseUnl on UNL
// strings); the zip-reading wrapper is the only IO.

import { colInt, decodeUnl, parseUnl, type UnlRow } from "../unl";
import { readZipMap } from "../zip";

export const SOURCE_TISKY = "psp-tisky";
export const SOURCE_INTERP = "psp-interp";
export const SOURCE_STENO = "psp-steno";

/** Bill-print kinds (druh_tisku). 6 = Písemná interpelace (a written interpellation). */
const DRUH_PISEMNA_INTERPELACE = 6;
/** Proposer categories (typ_zakon): 2 = single MP, 3 = group of MPs → MP-authored. */
const MP_ORIGIN_NAVRH = new Set([2, 3]);
/** rec.druh speaker roles: 3/5 = substantive speaker (2/4 = chair, excluded). */
const SUBSTANTIVE_SPEAKER = new Set([3, 5]);

export interface ActivityCounts {
  billsAuthored: number;
  writtenInterpellations: number;
  oralInterpellations: number;
  speechTurns: number;
}
export const emptyCounts = (): ActivityCounts => ({ billsAuthored: 0, writtenInterpellations: 0, oralInterpellations: 0, speechTurns: 0 });

const bump = (m: Map<number, number>, k: number | null) => {
  if (k != null) m.set(k, (m.get(k) ?? 0) + 1);
};

/**
 * Bill authorship + written interpellations from tisky.zip, scoped to `termPspId`.
 * MP-authored bills come from `predkladatel` (multi-author, ordered) — NOT from
 * tisky.id_osoba, which is empty for recent-term MP bills. Only `id_navrh ∈ {2,3}`
 * (single MP / group of MPs) count, so a government or committee bill is never credited
 * to an MP. Written interpellations (`id_druh = 6`) are attributed via tisky.id_osoba
 * (populated for those). `id_druh = 0` shells and other-term (Senate) rows are skipped.
 */
export function billsAndWrittenInterp(
  tisky: readonly UnlRow[],
  predkladatel: readonly UnlRow[],
  termPspId: number,
): { billsByPerson: Map<number, number>; writtenInterpByPerson: Map<number, number>; mpAuthoredBills: number } {
  const mpBillTiskIds = new Set<number>();
  const writtenInterpByPerson = new Map<number, number>();
  for (const r of tisky) {
    const idTisk = colInt(r, 0);
    const idDruh = colInt(r, 1);
    const idNavrh = colInt(r, 5);
    const idOrgObd = colInt(r, 7);
    const idOsoba = colInt(r, 8);
    if (idTisk == null || idOrgObd !== termPspId || idDruh == null || idDruh === 0) continue;
    if (idDruh === DRUH_PISEMNA_INTERPELACE) bump(writtenInterpByPerson, idOsoba);
    else if (idNavrh != null && MP_ORIGIN_NAVRH.has(idNavrh)) mpBillTiskIds.add(idTisk);
  }
  const billsByPerson = new Map<number, number>();
  for (const r of predkladatel) {
    const idTisk = colInt(r, 0);
    const idOsoba = colInt(r, 1);
    if (idTisk == null || !mpBillTiskIds.has(idTisk)) continue;
    bump(billsByPerson, idOsoba);
  }
  return { billsByPerson, writtenInterpByPerson, mpAuthoredBills: mpBillTiskIds.size };
}

/**
 * Q-effort-2 — split the SAME authorship universe as `billsAndWrittenInterp` by
 * predkladatel rank (`poradi`): rank 1 = first signatory (předložil), rank > 1 =
 * co-signer (spolupodepsal). Row-for-row identical filtering, so per person
 * firstSigned + coSigned always equals billsAuthored — the composite number the
 * contribution index consumes stays untouched; this only adds provenance.
 */
export function splitBillAuthorship(
  tisky: readonly UnlRow[],
  predkladatel: readonly UnlRow[],
  termPspId: number,
): { firstByPerson: Map<number, number>; coByPerson: Map<number, number> } {
  const mpBillTiskIds = new Set<number>();
  for (const r of tisky) {
    const idTisk = colInt(r, 0);
    const idDruh = colInt(r, 1);
    const idNavrh = colInt(r, 5);
    if (idTisk == null || colInt(r, 7) !== termPspId || idDruh == null || idDruh === 0) continue;
    if (idDruh !== DRUH_PISEMNA_INTERPELACE && idNavrh != null && MP_ORIGIN_NAVRH.has(idNavrh)) mpBillTiskIds.add(idTisk);
  }
  const firstByPerson = new Map<number, number>();
  const coByPerson = new Map<number, number>();
  for (const r of predkladatel) {
    const idTisk = colInt(r, 0);
    const idOsoba = colInt(r, 1);
    if (idTisk == null || !mpBillTiskIds.has(idTisk)) continue;
    bump(colInt(r, 2) === 1 ? firstByPerson : coByPerson, idOsoba);
  }
  return { firstByPerson, coByPerson };
}

/** Oral interpellations from interp.zip: poradi.id_poslanec (an id_osoba) per losování
 *  whose li.id_org matches the term. (PSP10 is 0 early in the term — correct, not a bug.) */
export function oralInterp(li: readonly UnlRow[], poradi: readonly UnlRow[], termPspId: number): Map<number, number> {
  const losIds = new Set<number>();
  for (const r of li) {
    const idLos = colInt(r, 0);
    if (idLos != null && colInt(r, 7) === termPspId) losIds.add(idLos);
  }
  const byPerson = new Map<number, number>();
  for (const r of poradi) {
    const idLos = colInt(r, 1);
    if (idLos == null || !losIds.has(idLos)) continue;
    bump(byPerson, colInt(r, 2)); // id_poslanec is actually an id_osoba
  }
  return byPerson;
}

/** Substantive stenographic speaking turns per id_osoba, scoped to the term's steno
 *  records. Chair turns (rec.druh 2/4) are excluded; the dump carries no text, so a
 *  turn count is the honest floor-presence metric. */
export function speechTurns(steno: readonly UnlRow[], rec: readonly UnlRow[], termPspId: number): Map<number, number> {
  const stenoIds = new Set<number>();
  for (const r of steno) {
    const idSteno = colInt(r, 0);
    if (idSteno != null && colInt(r, 1) === termPspId) stenoIds.add(idSteno);
  }
  const byPerson = new Map<number, number>();
  for (const r of rec) {
    const idSteno = colInt(r, 0);
    const druh = colInt(r, 4);
    if (idSteno == null || !stenoIds.has(idSteno) || druh == null || !SUBSTANTIVE_SPEAKER.has(druh)) continue;
    bump(byPerson, colInt(r, 1));
  }
  return byPerson;
}

function unlOf(members: Map<string, Uint8Array>, name: string): UnlRow[] {
  const bytes = members.get(name.toLowerCase());
  return bytes ? parseUnl(decodeUnl(bytes)) : [];
}

export interface ActivityBundle {
  byPerson: Map<number, ActivityCounts>;
  totals: { mpAuthoredBills: number; writtenInterpellations: number; oralInterpellations: number; speechTurnPeople: number };
}

/**
 * Read the three activity zips (any may be omitted) and produce per-id_osoba activity
 * counts for the term. The IO wrapper over the pure aggregators above.
 */
export function normalizeActivity(
  dumps: { tiskyZip?: Uint8Array; interpZip?: Uint8Array; stenoZip?: Uint8Array },
  termPspId: number,
): ActivityBundle {
  let bills = new Map<number, number>();
  let written = new Map<number, number>();
  let mpAuthoredBills = 0;
  if (dumps.tiskyZip) {
    const m = readZipMap(dumps.tiskyZip);
    const r = billsAndWrittenInterp(unlOf(m, "tisky.unl"), unlOf(m, "predkladatel.unl"), termPspId);
    bills = r.billsByPerson;
    written = r.writtenInterpByPerson;
    mpAuthoredBills = r.mpAuthoredBills;
  }
  let oral = new Map<number, number>();
  if (dumps.interpZip) {
    const m = readZipMap(dumps.interpZip);
    oral = oralInterp(unlOf(m, "li.unl"), unlOf(m, "poradi.unl"), termPspId);
  }
  let speeches = new Map<number, number>();
  if (dumps.stenoZip) {
    const m = readZipMap(dumps.stenoZip);
    speeches = speechTurns(unlOf(m, "steno.unl"), unlOf(m, "rec.unl"), termPspId);
  }

  const byPerson = new Map<number, ActivityCounts>();
  const ensure = (id: number) => {
    let c = byPerson.get(id);
    if (!c) byPerson.set(id, (c = emptyCounts()));
    return c;
  };
  for (const [id, n] of bills) ensure(id).billsAuthored = n;
  for (const [id, n] of written) ensure(id).writtenInterpellations = n;
  for (const [id, n] of oral) ensure(id).oralInterpellations = n;
  for (const [id, n] of speeches) ensure(id).speechTurns = n;

  return {
    byPerson,
    totals: {
      mpAuthoredBills,
      writtenInterpellations: [...written.values()].reduce((a, b) => a + b, 0),
      oralInterpellations: [...oral.values()].reduce((a, b) => a + b, 0),
      speechTurnPeople: speeches.size,
    },
  };
}
