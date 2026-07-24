// Case ③ Law-change forensics — structured foundation. Parses psp.cz `tisky.zip`
// into law-amendment BILLS: a print that proposes a new or amended law, its origin
// (government / MP / group of MPs / senate), its sponsors (predkladatel → id_osoba),
// and the laws it amends. Same UNL plumbing as psp.ts / psp-activity.ts.
//
// tisky.unl is 25 positional columns (verified). Load-bearing (0-indexed):
//   0 internal id_tisk (predkladatel join key)   1 druh_tisku (1=Vládní návrh zákona,
//   2=Návrh zákona)   3 číslo tisku (public no.)   5 typ_zakon (1=vláda 2=poslanec
//   3=skupina 4=senát)   7 id_org_obd (term organ, 174=PSP10)   8 předkladatel osoba
//   9 předkladatel text (ministry / MP names)   15 FULL title (carries the amended-law
//   citation as free text).
//
// The amended-law link is FREE TEXT only — there is no structured bill→law field in the
// psp.cz bulk (the structured amendment graph lives on the e-Sbírka side, dataset 007).
// So the law citation is regex-extracted from the title; a bill can amend several laws.

import { col, colInt, decodeUnl, parseUnl, type UnlRow } from "../unl";
import { readZipMap } from "../zip";

export const SOURCE_TISKY_LAW = "psp-tisky-law";

/** `č. 37/2021 Sb.` — the only bill→law link the psp.cz data gives (free text in the title). */
export const LAW_CITATION = /č\.\s*(\d{1,4})\s*\/\s*(\d{4})\s*Sb\./g;
export function extractAmendedLaws(title: string | null): string[] {
  if (!title) return [];
  const out = new Set<string>();
  for (const m of title.matchAll(LAW_CITATION)) out.add(`${Number(m[1])}/${m[2]}`);
  return [...out];
}

export type BillOrigin = "government" | "mp" | "mp_group" | "senate" | "other";
function originOf(typZakon: number | null): BillOrigin {
  switch (typZakon) {
    case 1:
      return "government";
    case 2:
      return "mp";
    case 3:
      return "mp_group";
    case 4:
      return "senate";
    default:
      return "other";
  }
}

export interface LawBill {
  tiskId: number; // internal id (predkladatel join)
  cislo: number | null; // public tisk number (for the psp.cz URL)
  druh: number; // druh_tisku (1 government law, 2 other law)
  origin: BillOrigin;
  title: string | null; // full official nazev (col 15)
  submitterText: string | null; // ministry or MP names (col 9)
  sponsorOsobaIds: number[]; // MP sponsors from predkladatel (id_osoba); empty for pure-government bills
  amendedLaws: string[]; // ["37/2021", …] regex-extracted from the title
}

/** druh_tisku that denote a bill proposing/amending a law. */
const LAW_BILL_DRUH = new Set([1, 2]);

/**
 * Law-amendment bills for one term (organ id, 174 = PSP10). MP sponsors come from
 * `predkladatel` (multi-author); government bills carry the ministry in `submitterText`
 * and usually have no predkladatel MP rows. `druh_tisku ∈ {1,2}` keeps návrhy zákona and
 * drops budgets/treaties/reports/interpellations.
 */
export function parseLawBills(
  tisky: readonly UnlRow[],
  predkladatel: readonly UnlRow[],
  termPspId: number,
): LawBill[] {
  const sponsorsByTisk = new Map<number, number[]>();
  for (const r of predkladatel) {
    const idTisk = colInt(r, 0);
    const idOsoba = colInt(r, 1);
    if (idTisk == null || idOsoba == null) continue;
    const arr = sponsorsByTisk.get(idTisk) ?? [];
    if (!arr.includes(idOsoba)) arr.push(idOsoba);
    sponsorsByTisk.set(idTisk, arr);
  }

  const bills: LawBill[] = [];
  for (const r of tisky) {
    const tiskId = colInt(r, 0);
    const druh = colInt(r, 1);
    if (tiskId == null || druh == null || !LAW_BILL_DRUH.has(druh) || colInt(r, 7) !== termPspId) continue;
    const title = col(r, 15);
    bills.push({
      tiskId,
      cislo: colInt(r, 3),
      druh,
      origin: originOf(colInt(r, 5)),
      title,
      submitterText: col(r, 9),
      sponsorOsobaIds: sponsorsByTisk.get(tiskId) ?? [],
      amendedLaws: extractAmendedLaws(title),
    });
  }
  return bills;
}

function unlOf(members: Map<string, Uint8Array>, name: string): UnlRow[] {
  const bytes = members.get(name.toLowerCase());
  return bytes ? parseUnl(decodeUnl(bytes)) : [];
}

/** The IO wrapper: read tisky.zip and produce the term's law-amendment bills. */
export function normalizeLegislation(tiskyZip: Uint8Array, termPspId: number): LawBill[] {
  const m = readZipMap(tiskyZip);
  return parseLawBills(unlOf(m, "tisky.unl"), unlOf(m, "predkladatel.unl"), termPspId);
}
