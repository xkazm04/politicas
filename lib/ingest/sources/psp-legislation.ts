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
//
// F15 — formal per-bill committee routing. tisky.zip also carries hist_vybory.unl, the
// "přikázání tisku výborům" table (committee assignment of a print). Verified schema
// (psp.cz open-data k=1303, 0-indexed): 0 id_tisku (→tisky.id_tisk) · 1 id_organ (→GLOBAL
// organy.id_organ, the same id used by psp:organ:<pspId>) · 2 typ (1=navrženo k přikázání,
// 2=přikázáno, 3=projednáno iniciativně) · 3 id_hist (→hist.id_hist, the step that carries
// the DATE) · 4 id_posl (zpravodaj) · 5 poradi · 6 garancni (1|2 ⇒ garanční/věcně příslušný
// výbor). hist_vybory has NO date column — the timing comes via id_hist → hist.datum
// (hist.unl: 0 id_hist · 1 id_tisk · 2 datum "YYYY-MM-DD HH:MM"). We collapse the event
// rows to one assignment per (tisk, committee): garanční if any row flags it, and the
// strongest status seen (přikázáno > iniciativně > navrženo). This upgrades F12's name-based
// committee remit (owns) to formal per-bill routing.

import { col, colInt, decodeUnl, parseUnl, type UnlRow } from "../unl";
import { readZipMap } from "../zip";

export const SOURCE_TISKY_LAW = "psp-tisky-law";

/** `č. 37/2021 Sb.` — the only bill→law link the psp.cz data gives (free text in the title).
 * Batch-005 fix (D2, Opus audit): negative lookahead excludes `Sb. m. s.` (Sbírka mezinárodních
 * smluv — international-treaty citations, e.g. "č. 64/2017 Sb. m. s." for the Paris Agreement),
 * a genuinely DIFFERENT numbering collection that previously collided with real Sbírka-zákonů
 * refs of the same number/year (proven false edges: tisk 63→64/2017, tisk 52→55/2006, tisk
 * 144→108/2004 — each an international treaty, not a law). */
export const LAW_CITATION = /č\.\s*(\d{1,4})\s*\/\s*(\d{4})\s*Sb\.(?!\s*m\.\s*s\.)/g;
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

/* ── F15: formal per-bill committee routing (hist_vybory ⋈ hist) ──────────── */

/** The strongest routing state a print reached with a committee (přikázáno beats navrženo). */
export type AssignmentStatus = "prikazano" | "iniciativne" | "navrzeno";
/** garanční/věcně příslušný výbor vs a further (další) committee the print was routed to. */
export type AssignmentRole = "garancni" | "dalsi";

export interface CommitteeAssignment {
  tiskId: number; // internal id_tisk — same key as billUrn / LawBill.tiskId
  organId: number; // global organy.id_organ — same id as psp:organ:<pspId>
  role: AssignmentRole; // garanční výbor, else a further committee
  status: AssignmentStatus; // strongest hist_vybory.typ collapsed over the print's rows
  assignedOn: string | null; // YYYY-MM-DD from the linked hist step (null if the step has no date)
}

const STATUS_BY_TYP: Record<string, AssignmentStatus> = { "1": "navrzeno", "2": "prikazano", "3": "iniciativne" };
const STATUS_RANK: Record<AssignmentStatus, number> = { navrzeno: 1, iniciativne: 2, prikazano: 3 };

/** `hist.datum` is `YYYY-MM-DD HH:MM`; keep the date only (assignment resolves to a day). */
function histDate(v: string | null): string | null {
  const m = v ? /^(\d{4}-\d{2}-\d{2})/.exec(v.trim()) : null;
  return m ? m[1] : null;
}

/**
 * Collapse hist_vybory event rows into ONE formal assignment per (tisk, committee).
 * A print is proposed for (typ 1), then formally assigned to (typ 2), and may be taken
 * up initiatively (typ 3) by one garanční plus several further committees — many rows per
 * pair. We keep the strongest status and mark the pair garanční if any of its rows do, and
 * date it from the linked `hist` step (hist_vybory itself carries no date). Term/bill
 * filtering is the caller's job (the graph's 141 bills gate which pairs become edges).
 */
export function parseCommitteeAssignments(
  histVybory: readonly UnlRow[],
  hist: readonly UnlRow[],
): CommitteeAssignment[] {
  const dateByHist = new Map<number, string | null>();
  for (const r of hist) {
    const idHist = colInt(r, 0);
    if (idHist != null) dateByHist.set(idHist, histDate(col(r, 2)));
  }

  const byPair = new Map<string, CommitteeAssignment & { rank: number }>();
  for (const r of histVybory) {
    const tiskId = colInt(r, 0);
    const organId = colInt(r, 1);
    if (tiskId == null || organId == null) continue;
    const status = STATUS_BY_TYP[col(r, 2) ?? ""] ?? "navrzeno";
    const garancni = col(r, 6) === "1" || col(r, 6) === "2";
    const idHist = colInt(r, 3);
    const date = idHist != null ? (dateByHist.get(idHist) ?? null) : null;
    const rank = STATUS_RANK[status];

    const key = `${tiskId}:${organId}`;
    const prev = byPair.get(key);
    if (!prev) {
      byPair.set(key, {
        tiskId,
        organId,
        role: garancni ? "garancni" : "dalsi",
        status,
        assignedOn: date,
        rank,
      });
      continue;
    }
    if (garancni) prev.role = "garancni"; // garanční is the committee's strongest role for the print
    if (rank >= prev.rank) {
      prev.rank = rank;
      prev.status = status;
      if (date) prev.assignedOn = date; // prefer the stronger step's date
    } else if (prev.assignedOn == null && date) {
      prev.assignedOn = date;
    }
  }

  return [...byPair.values()].map(({ rank: _rank, ...a }) => a);
}

/** IO wrapper: read tisky.zip and produce the collapsed committee assignments (all terms). */
export function normalizeCommitteeRouting(tiskyZip: Uint8Array): CommitteeAssignment[] {
  const m = readZipMap(tiskyZip);
  return parseCommitteeAssignments(unlOf(m, "hist_vybory.unl"), unlOf(m, "hist.unl"));
}
