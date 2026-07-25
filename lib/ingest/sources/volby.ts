// Adapter for the ČSÚ/volby.gov.cz PS2025 candidate registry — the "Kott-class"
// employment-COI backstop (Q-effort-13, batch 006). Every sitting PSP10 MP was
// a PS2025 candidate, and the registry carries a self-declared `POVOLANI`
// (occupation) field the money loop's ARES-officer-based `linked_to` edges
// structurally cannot see: an employment tie (works FOR a company/sector), not
// an ownership/officer tie.
//
// SOURCE   https://volby.gov.cz/opendata/ps2025/ps2025_opendata.htm  (index)
//          https://volby.gov.cz/opendata/ps2025/PS2025reg20251005_csv.zip
//            (registry package "state as of 2025-10-05" — the PS2025 candidate
//            registration snapshot; ČSÚ republishes no diff feed, so re-sync
//            only happens at the next election)
// LICENCE  ČSÚ open data, free of charge, no auth, no rate limit — confirmed
//          by direct download during batch-006's bounded probe (2026-07-25).
// FORMAT   the "csv" member of the zip is semicolon-delimited RFC4180-style CSV
//          (quoted fields, `""` escapes an embedded quote), windows-1250 encoded
//          — NOT the psp.cz UNL format, so this adapter gets its own tiny CSV
//          parser rather than reusing ../unl. A naive `line.split(";")` breaks:
//          verified on the live file, one MP's own POVOLANI text contains a
//          literal `;` (Hřib, "...stavějící metro, tramvajové tratě a mosty;
//          hrdý obyvatel...") which shifts every later column of a naive split.
//
// FILE SHAPE (verified against the live 2026-07-25 download):
//   csv/psrk.csv  — the candidate list. Header (0-indexed):
//     0 VOLKRAJ (region code, see VOLKRAJ_NAME below) · 1 KSTRANA (local list id,
//     → psrkl.csv KSTRANA) · 2 PORCISLO (ballot position) · 3 JMENO · 4 PRIJMENI
//     · 5 TITULPRED · 6 TITULZA · 7 VEK (age at registration) · 8 POVOLANI
//     (self-declared occupation, free text — see the caveat below) · 9 BYDLISTEN
//     (residence town) · 10 PSTRANA (nominating party, local id) · 11 NSTRANA
//     (nominating party/list, national id) · 12 PLATNOST ("A" = valid
//     registration) · 13 POCHLASU (preference votes) · 14 POCPROC (vote %) ·
//     15 MANDAT ("A" = won a seat) · 16 SKRUTINIUM · 17 PORADIMAND · 18 PORADINAHR.
//   csv/psrkl.csv — party/list registry: KSTRANA;VSTRANA;NAZEVCELK;NAZEV_STRK;
//     ZKRATKAK30;ZKRATKAK8;… — VSTRANA is the national list id (joins psrk.NSTRANA);
//     ZKRATKAK8 is the short abbreviation.
//   There is NO separate employer column — POVOLANI is the only occupation
//   signal the registry carries, and it is sometimes multi-clause free text
//   that names an employer inline ("ředitel společnosti X"), sometimes a bare
//   job title, and — the load-bearing caveat this batch found — for INCUMBENT
//   MPs seeking re-election it is very often self-referential ("poslanec PSP
//   ČR", "ministr…"), not their prior/outside business tie. Measured on the
//   live file: 103 of 199 elected PS2025 candidates (52%) self-declared as
//   sitting MP/minister/senator. This is a structural blind spot for exactly
//   the population the Kott-class signal targets, and is reported honestly in
//   docs/data-analysis/case-effort/batch-006-volby-signal.md rather than
//   masked by a looser classifier.
//
// VOLKRAJ region codes are the standard ČSÚ 14-kraj numbering (undocumented on
// the page itself but verified against real rows this batch: VOLKRAJ=10 for
// Josef Kott's own Vysočina candidacy, VOLKRAJ=1 for two Prague candidates
// including a real elected MP).

export const SOURCE_VOLBY_CANDIDATES = "volby-ps2025-candidates";
export const VOLBY_OPENDATA_INDEX = "https://volby.gov.cz/opendata/ps2025/ps2025_opendata.htm";
export const VOLBY_REGISTRY_CSV_ZIP = "https://volby.gov.cz/opendata/ps2025/PS2025reg20251005_csv.zip";

export const VOLKRAJ_NAME: Record<number, string> = {
  1: "Hlavní město Praha",
  2: "Středočeský",
  3: "Jihočeský",
  4: "Plzeňský",
  5: "Karlovarský",
  6: "Ústecký",
  7: "Liberecký",
  8: "Královéhradecký",
  9: "Pardubický",
  10: "Vysočina",
  11: "Jihomoravský",
  12: "Olomoucký",
  13: "Zlínský",
  14: "Moravskoslezský",
};

/* ── CSV parsing (RFC4180-ish, `;` delimiter, `""` quote-escape) ──────────── */

/**
 * Parse a whole CSV body into rows of raw string fields. Scans the whole body
 * (not line-by-line) because a quoted field may legitimately contain the
 * delimiter or a newline; `""` inside a quoted field is an escaped literal
 * quote. Unlike ../unl.ts's pipe format, this file uses real CSV quoting.
 */
export function parseCsv(body: string, delimiter = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawAny = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inQuotes) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      sawAny = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      sawAny = true;
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      sawAny = false;
      continue;
    }
    field += ch;
    sawAny = true;
  }
  if (sawAny || field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Decode a windows-1250 payload (same encoding as the psp.cz UNL dumps). */
export function decodeVolbyCsv(bytes: Uint8Array): string {
  return new TextDecoder("windows-1250").decode(bytes);
}

const s = (v: string | undefined): string | null => (v == null || v === "" ? null : v);
const n = (v: string | undefined): number | null => {
  if (v == null || v === "") return null;
  const x = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(x) ? x : null;
};
const flag = (v: string | undefined): boolean => (v ?? "").trim().toUpperCase() === "A";

export interface CandidateRow {
  volKraj: number | null;
  volKrajName: string | null;
  kStrana: number | null;
  porCislo: number | null;
  firstName: string;
  lastName: string;
  fullName: string;
  titleBefore: string | null;
  titleAfter: string | null;
  age: number | null;
  /** POVOLANI — self-declared occupation, free text; see the file-header caveat. */
  occupation: string | null;
  residence: string | null;
  pStrana: number | null;
  nStrana: number | null;
  validRegistration: boolean;
  votes: number | null;
  votesPercent: number | null;
  /** MANDAT — true when this candidacy won a PS2025 seat. */
  elected: boolean;
  scrutiny: boolean;
}

/** `csv/psrk.csv` → typed candidate rows. Skips the header row. */
export function parseCandidates(csvBody: string): CandidateRow[] {
  const rows = parseCsv(csvBody);
  if (rows.length === 0) return [];
  const out: CandidateRow[] = [];
  for (const r of rows.slice(1)) {
    if (r.length < 16) continue; // short/blank trailing row
    const firstName = r[3]?.trim() ?? "";
    const lastName = r[4]?.trim() ?? "";
    if (!firstName && !lastName) continue;
    const volKraj = n(r[0]);
    out.push({
      volKraj,
      volKrajName: volKraj != null ? (VOLKRAJ_NAME[volKraj] ?? null) : null,
      kStrana: n(r[1]),
      porCislo: n(r[2]),
      firstName,
      lastName,
      fullName: [firstName, lastName].filter(Boolean).join(" "),
      titleBefore: s(r[5]),
      titleAfter: s(r[6]),
      age: n(r[7]),
      occupation: s(r[8]),
      residence: s(r[9]),
      pStrana: n(r[10]),
      nStrana: n(r[11]),
      validRegistration: flag(r[12]),
      votes: n(r[13]),
      votesPercent: n(r[14]),
      elected: flag(r[15]),
      scrutiny: flag(r[16]),
    });
  }
  return out;
}

export interface PartyListRow {
  kStrana: number;
  /** VSTRANA — the national list id, joins CandidateRow.nStrana. */
  nStrana: number | null;
  nameFull: string | null;
  abbrev8: string | null;
}

/** `csv/psrkl.csv` → party/list registry rows, keyed by the local KSTRANA id. */
export function parsePartyLists(csvBody: string): PartyListRow[] {
  const rows = parseCsv(csvBody);
  if (rows.length === 0) return [];
  const out: PartyListRow[] = [];
  for (const r of rows.slice(1)) {
    const kStrana = n(r[0]);
    if (kStrana == null) continue;
    out.push({ kStrana, nStrana: n(r[1]), nameFull: s(r[2]), abbrev8: s(r[5]) });
  }
  return out;
}

/* ── IO wrapper ────────────────────────────────────────────────────────────
 * Adapters in this repo (see ../psp.ts) keep the actual `fetch()` out of the
 * module — the ingest script owns the network call and caching, this module
 * only turns already-fetched bytes into typed rows. `normalizeCandidates`
 * takes the raw member bytes straight from the zip's `csv/` folder. */

export interface VolbyRegistryBundle {
  candidates: CandidateRow[];
  partyLists: PartyListRow[];
}

export function normalizeCandidates(psrkCsvBytes: Uint8Array, psrklCsvBytes?: Uint8Array): VolbyRegistryBundle {
  return {
    candidates: parseCandidates(decodeVolbyCsv(psrkCsvBytes)),
    partyLists: psrklCsvBytes ? parsePartyLists(decodeVolbyCsv(psrklCsvBytes)) : [],
  };
}

/* ── Join: candidate registry → the 207 current PSP10 MPs ─────────────────
 * The registry carries no shared person id with psp.cz — same join-risk class
 * as every other cross-source join in this repo (batch-005's assessment).
 * Match on full name; a candidate registry name collision (a common Czech
 * surname fielded by several parties/regions) is disambiguated by region
 * where the MP's own mandate region is known, and otherwise flagged rather
 * than silently resolved — never drop an unresolved collision quietly. */

import { asciiFold } from "../normalize";

export interface MpForJoin {
  pspId: number;
  name: string;
  /** Mandate region name (e.g. "Vysočina"), when known. */
  region?: string | null;
  club?: string | null;
}

export type JoinStatus = "matched" | "ambiguous" | "unmatched";

export interface CandidateJoinResult {
  mp: MpForJoin;
  status: JoinStatus;
  candidate: CandidateRow | null;
  /** All same-name candidates found, for audit when status is not "matched". */
  candidateMatches: CandidateRow[];
}

/**
 * Join each MP to their PS2025 candidacy by folded full name, disambiguating
 * same-name collisions by region when more than one candidate shares the
 * name. A collision that region cannot resolve (or where the MP's own region
 * is unknown) is reported as "ambiguous", never silently picked.
 */
export function joinCandidatesToMps(candidates: readonly CandidateRow[], mps: readonly MpForJoin[]): CandidateJoinResult[] {
  const byName = new Map<string, CandidateRow[]>();
  for (const c of candidates) {
    const key = asciiFold(c.fullName);
    const arr = byName.get(key) ?? [];
    arr.push(c);
    byName.set(key, arr);
  }

  return mps.map((mp) => {
    const key = asciiFold(mp.name);
    const hits = byName.get(key) ?? [];
    if (hits.length === 0) return { mp, status: "unmatched", candidate: null, candidateMatches: [] };
    if (hits.length === 1) return { mp, status: "matched", candidate: hits[0], candidateMatches: hits };

    // Same-name collision: narrow by region first (several parties can field a
    // same-surname candidate in different regions).
    const mpRegionFold = mp.region ? asciiFold(mp.region) : null;
    const byRegion = mpRegionFold ? hits.filter((h) => h.volKrajName && asciiFold(h.volKrajName) === mpRegionFold) : hits;
    if (byRegion.length === 1) return { mp, status: "matched", candidate: byRegion[0], candidateMatches: hits };

    // Still tied (e.g. two same-surname candidates on different party lists in
    // the SAME region, real case: two "Miroslav Krejčí" both in Jihočeský):
    // a sitting MP won a seat, so if exactly one of the remaining candidates
    // actually won (MANDAT=A), that is the disambiguator — never a guess when
    // more than one elected candidate remains tied.
    const pool = byRegion.length > 0 ? byRegion : hits;
    const electedPool = pool.filter((h) => h.elected);
    if (electedPool.length === 1) return { mp, status: "matched", candidate: electedPool[0], candidateMatches: hits };

    return { mp, status: "ambiguous", candidate: null, candidateMatches: hits };
  });
}

/* ── Employment-COI classifier (the Kott-class signal) ─────────────────────
 * Deterministic, code-owned. Maps a committee to the policy sector it
 * oversees, and a set of Czech occupation word-stems to that same sector; a
 * hit is a candidate whose declared POVOLANI stem-matches a sector their OWN
 * committee membership oversees. Stems are matched with a leading word
 * boundary on ASCII-folded text (never `.includes()` — the P42 lesson:
 * `.includes()` lets an unrelated word that merely CONTAINS the stem
 * mid-word fire a false positive; a leading `\b` anchors the stem to a real
 * word start, so a declined Czech form ("zemědělství", "zemědělská") still
 * matches while an unrelated word containing the same letters mid-token does
 * not). */

export type CoiSector =
  | "agriculture"
  | "business_economy"
  | "health"
  | "environment"
  | "defense_security"
  | "public_admin"
  | "education_science"
  | "finance_budget"
  | "law"
  | "media";

interface SectorDef {
  sector: CoiSector;
  /** Committee abbreviations (as carried on the person's `influential_in` edges) this sector's oversight remit covers. */
  committees: string[];
  /** ASCII-folded, lowercase word-stems; matched with a leading `\b`. */
  stems: string[];
}

export const COI_SECTORS: SectorDef[] = [
  { sector: "agriculture", committees: ["ZEV"], stems: ["zemedel", "agronom", "farmar", "chovatel", "rostlinn", "potravin", "agrofert", "vinar", "sadkar"] },
  { sector: "business_economy", committees: ["HV"], stems: ["podnikatel", "manazer", "reditel", "obchodni", "firm", "byznys", "jednatel"] },
  { sector: "health", committees: ["VZ"], stems: ["lekar", "zdravotn", "farmaceut", "nemocnic", "stomatolog", "veterinar", "lekarn"] },
  { sector: "environment", committees: ["VŽP", "VZP"], stems: ["ekolog", "odpadov", "envi"] },
  { sector: "defense_security", committees: ["VO", "VB"], stems: ["vojak", "armad", "policist", "hasic", "bezpecnostn", "voják"] },
  { sector: "public_admin", committees: ["VSR"], stems: ["starost", "mistostarost", "uredni", "radn", "hejtman", "tajemn"] },
  { sector: "education_science", committees: ["VVVMS"], stems: ["ucitel", "profesor", "vedec", "akademik", "vyzkumn", "pedagog"] },
  { sector: "finance_budget", committees: ["RV"], stems: ["ucetn", "auditor", "bankez", "bankeř", "financn", "danov"] },
  { sector: "law", committees: ["ÚPV", "UPV"], stems: ["pravnik", "advokat", "soudce", "notar"] },
  { sector: "media", committees: ["VMZ"], stems: ["novinar", "redaktor", "moderator"] },
];

/** Committee abbreviation of the Chamber's general anti-corruption/state-audit oversight body. */
export const CONTROL_COMMITTEE_ABBREV = "KV";

/** Self-referential occupation stems ("poslanec", "ministr"…) — the structural blind spot: an
 *  incumbent's PS2025 POVOLANI names their OWN office, not the outside tie the signal looks for. */
const SELF_REFERENTIAL_STEMS = ["poslan", "senator", "ministr", "hejtman", "europoslan"];

function stemHit(foldedText: string, stem: string): boolean {
  return new RegExp(`\\b${stem}`, "i").test(foldedText);
}

export function isSelfReferentialOccupation(occupation: string | null): boolean {
  if (!occupation) return false;
  const folded = asciiFold(occupation);
  return SELF_REFERENTIAL_STEMS.some((st) => stemHit(folded, st));
}

export interface CommitteeRef {
  abbrev: string;
}

export interface CoiHit {
  pspId: number;
  name: string;
  sector: CoiSector;
  matchedStem: string;
  occupation: string;
  committee: string;
  /** true when the MP also sits on the Control Committee (KV) — the Kott-class combined signal. */
  onControlCommittee: boolean;
}

/**
 * The deterministic Kott-class classifier: for one MP (with their joined
 * candidacy occupation text and their real committee memberships), return
 * every sector where the occupation stem-matches a committee this MP
 * actually sits on. Self-referential occupations ("poslanec…") are excluded
 * up front — they carry no outside-tie information — and reported instead
 * via `isSelfReferentialOccupation` so the batch's yield count stays honest.
 */
export function classifyEmploymentCoi(pspId: number, name: string, occupation: string | null, committees: readonly CommitteeRef[]): CoiHit[] {
  if (!occupation || isSelfReferentialOccupation(occupation)) return [];
  const folded = asciiFold(occupation);
  const committeeAbbrevs = new Set(committees.map((c) => c.abbrev));
  const onControl = committeeAbbrevs.has(CONTROL_COMMITTEE_ABBREV);

  const hits: CoiHit[] = [];
  for (const def of COI_SECTORS) {
    const stem = def.stems.find((st) => stemHit(folded, st));
    if (!stem) continue;
    for (const c of def.committees) {
      if (committeeAbbrevs.has(c)) {
        hits.push({ pspId, name, sector: def.sector, matchedStem: stem, occupation, committee: c, onControlCommittee: onControl });
      }
    }
  }
  return hits;
}
