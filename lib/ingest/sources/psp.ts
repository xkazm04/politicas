// Adapter for the Poslanecká sněmovna Parlamentu ČR bulk open data.
//
// SOURCE   https://www.psp.cz/sqw/hp.sqw?k=1300  (index)
//          https://www.psp.cz/eknih/cdrom/opendata/{poslanci,hl-<year>ps}.zip
// LICENCE  free of charge, conditioned on citing the source and (where relevant)
//          the processing date — quoted verbatim from the publisher's page:
//          "Data jsou poskytována bezplatně, využití dat je podmíněno uvedením
//           zdroje dat a případně datem zpracování dat."
//          Every ingested row therefore carries `source` + `source_url` +
//          `fetched_at`, which is exactly what that condition requires.
// FORMAT   UNL (pipe-delimited, windows-1250, backslash escapes) — see ../unl.ts
// REFRESH  full snapshot, rewritten daily; no diff feed is published, so ingest
//          is a full re-upsert on the natural key rather than an incremental.
//
// WHY DIRECT DOWNLOAD RATHER THAN VIA PUMPER: these are binary ZIP bundles of
// windows-1250 UNL, 0.4–3 MB each. Pumper's generic apps (readable / crawl /
// extractor) are HTML→Markdown / DOM-extraction paths; pushing a ZIP through
// them would gain nothing and lose the byte-exact archive. Worse, Pumper's HTML
// fetch currently mis-decodes this publisher's windows-1250 pages into U+FFFD
// replacement characters (verified 2026-07-23 — see docs/data-analysis/onboarding.md),
// which would silently corrupt Czech names. Pumper is used for what it is good at
// here: watching the release page and extracting its machine-readable manifest.

import { asciiFold, fullName, readBirthDate, termCode, voteChoice, voteKind, voteOutcome } from "../normalize";
import { col, colInt, czDateHourToIso, czDateTimeToIso, czDateToIso, decodeUnl, parseUnl, type UnlRow } from "../unl";
import { readZipMap } from "../zip";
import type {
  AbsenceRow,
  MandateRow,
  MembershipRow,
  OrganRow,
  PersonRow,
  VoteBallotRow,
  VoteEventRow,
} from "@/lib/db/types";

export const PSP_OPENDATA_INDEX = "https://www.psp.cz/sqw/hp.sqw?k=1300";
export const PSP_OPENDATA_BASE = "https://www.psp.cz/eknih/cdrom/opendata";

export const SOURCE_POSLANCI = "psp-poslanci";
export const SOURCE_HLASOVANI = "psp-hlasovani";

export interface FetchedDump {
  fileName: string;
  url: string;
  bytes: Uint8Array;
  lastModified: string | null;
  fetchedAt: string;
}

interface Prov {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  ingestRunId: number | null;
}

/** Decode + parse one UNL member of a dump; missing members yield []. */
function unlOf(members: Map<string, Uint8Array>, name: string): UnlRow[] {
  const bytes = members.get(name.toLowerCase());
  return bytes ? parseUnl(decodeUnl(bytes)) : [];
}

/** Row → a plain object keyed by the publisher's own column names (for `raw`). */
function rawOf(names: readonly string[], row: UnlRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  names.forEach((n, i) => {
    out[n] = col(row, i);
  });
  return out;
}

const OSOBY_COLS = ["id_osoba", "pred", "prijmeni", "jmeno", "za", "narozeni", "pohlavi", "zmena", "umrti"] as const;
const ORGANY_COLS = ["id_organ", "organ_id_organ", "id_typ_organu", "zkratka", "nazev_organu_cz", "nazev_organu_en", "od_organ", "do_organ", "priorita", "cl_organ_base"] as const;
const POSLANEC_COLS = ["id_poslanec", "id_osoba", "id_kraj", "id_kandidatka", "id_obdobi", "web", "ulice", "obec", "psc", "email", "telefon", "fax", "psp_telefon", "facebook", "foto"] as const;
const ZARAZENI_COLS = ["id_osoba", "id_of", "cl_funkce", "od_o", "do_o", "od_f", "do_f"] as const;
const HLASOVANI_COLS = ["id_hlasovani", "id_organ", "schuze", "cislo", "bod", "datum", "cas", "pro", "proti", "zdrzel", "nehlasoval", "prihlaseno", "kvorum", "druh_hlasovani", "vysledek", "nazev_dlouhy", "nazev_kratky"] as const;
const OMLUVY_COLS = ["id_organ", "id_poslanec", "den", "od", "do"] as const;

export interface PoslanciBundle {
  persons: PersonRow[];
  organs: OrganRow[];
  mandates: MandateRow[];
  memberships: MembershipRow[];
  /** organ psp_id → term code, for the vote adapter. */
  termCodes: Map<number, string>;
  /** Natural-key collisions per table (see HlasovaniBundle.duplicates). */
  duplicates: { persons: number; organs: number; mandates: number; memberships: number };
}

/**
 * Normalize `poslanci.zip` into graph rows.
 *
 * Registries (person, organ) are loaded in FULL across all electoral terms: they
 * are small, and the graph needs cross-term lookups (an MP's electoral region and
 * party list are `organ` rows from earlier terms). Mandates and memberships are
 * likewise full — `term_code` is the scoping column, not the ingest filter.
 */
export function normalizePoslanci(zipBytes: Uint8Array, prov: Prov): PoslanciBundle {
  const members = readZipMap(zipBytes);

  // ── organ types (lookup only; the label is denormalized onto organ) ──────
  const organTypeCz = new Map<number, string>();
  for (const r of unlOf(members, "typ_organu.unl")) {
    const id = colInt(r, 0);
    if (id != null) organTypeCz.set(id, col(r, 2) ?? "");
  }

  // ── organs ──────────────────────────────────────────────────────────────
  const organs: OrganRow[] = [];
  const termCodes = new Map<number, string>();
  for (const r of unlOf(members, "organy.unl")) {
    const pspId = colInt(r, 0);
    if (pspId == null) continue;
    const typeId = colInt(r, 2);
    const abbrev = col(r, 3);
    const nameCz = col(r, 4);
    organs.push({
      id: `psp:organ:${pspId}`,
      pspId,
      parentPspId: colInt(r, 1),
      organTypeId: typeId,
      organTypeCz: typeId != null ? (organTypeCz.get(typeId) ?? null) : null,
      abbrev,
      nameCz,
      nameEn: col(r, 5),
      nameNorm: asciiFold(nameCz ?? abbrev ?? ""),
      validFrom: czDateToIso(col(r, 6)),
      validTo: czDateToIso(col(r, 7)),
      ...prov,
      raw: rawOf(ORGANY_COLS, r),
    });
    // The chamber organ for a term is abbreviated PSP<n>; that abbreviation is
    // the human-facing term code used everywhere downstream.
    if ((typeId != null && organTypeCz.get(typeId) === "Parlament") || /^PSP\d+$/i.test(abbrev ?? "")) {
      termCodes.set(pspId, termCode(abbrev, pspId));
    }
  }

  // ── persons ─────────────────────────────────────────────────────────────
  const persons: PersonRow[] = [];
  for (const r of unlOf(members, "osoby.unl")) {
    const pspId = colInt(r, 0);
    if (pspId == null) continue;
    const lastName = col(r, 2);
    const firstName = col(r, 3);
    const name = fullName(firstName, lastName);
    const birth = readBirthDate(czDateToIso(col(r, 5)));
    persons.push({
      id: `psp:osoba:${pspId}`,
      pspId,
      titleBefore: col(r, 1),
      firstName,
      lastName,
      titleAfter: col(r, 4),
      nameFull: name,
      nameNorm: asciiFold(name),
      birthDate: birth.date,
      birthDateUnknown: birth.unknown,
      // The publisher documents "M" = male, ANY other value = female. Encoding
      // it as an explicit F (rather than passing the raw byte through) keeps the
      // column a closed vocabulary; the untouched original stays in `raw`.
      gender: col(r, 6) === "M" ? "M" : col(r, 6) ? "F" : null,
      diedAt: czDateToIso(col(r, 8)),
      changedAt: czDateToIso(col(r, 7)),
      ...prov,
      raw: rawOf(OSOBY_COLS, r),
    });
  }

  // ── mandates ────────────────────────────────────────────────────────────
  const mandates: MandateRow[] = [];
  for (const r of unlOf(members, "poslanec.unl")) {
    const pspId = colInt(r, 0);
    const personPspId = colInt(r, 1);
    const termPspId = colInt(r, 4);
    if (pspId == null || personPspId == null || termPspId == null) continue;
    mandates.push({
      id: `psp:poslanec:${pspId}`,
      pspId,
      personPspId,
      termPspId,
      termCode: termCodes.get(termPspId) ?? `ORGAN${termPspId}`,
      regionPspId: colInt(r, 2),
      partyListPspId: colInt(r, 3),
      web: col(r, 5),
      email: col(r, 9),
      phone: col(r, 10),
      pspPhone: col(r, 12),
      facebook: col(r, 13),
      hasPhoto: colInt(r, 14) === 1,
      ...prov,
      raw: rawOf(POSLANEC_COLS, r),
    });
  }

  // ── memberships ─────────────────────────────────────────────────────────
  // zarazeni.cl_funkce distinguishes plain membership (0, id_of → organ) from a
  // held office (1, id_of → funkce, which itself names an organ). Resolving both
  // to `organ_psp_id` is what makes "which club was this MP in on date X" a
  // single indexed lookup instead of a two-hop join at query time.
  const funkceOrgan = new Map<number, { organId: number | null; nameCz: string | null; typeId: number | null }>();
  for (const r of unlOf(members, "funkce.unl")) {
    const id = colInt(r, 0);
    if (id != null) funkceOrgan.set(id, { organId: colInt(r, 1), nameCz: col(r, 3), typeId: colInt(r, 2) });
  }
  const funkceTypeCz = new Map<number, string>();
  for (const r of unlOf(members, "typ_funkce.unl")) {
    const id = colInt(r, 0);
    if (id != null) funkceTypeCz.set(id, col(r, 2) ?? "");
  }

  const memberships: MembershipRow[] = [];
  for (const r of unlOf(members, "zarazeni.unl")) {
    const personPspId = colInt(r, 0);
    const targetPspId = colInt(r, 1);
    const clFunkce = colInt(r, 2);
    if (personPspId == null || targetPspId == null) continue;
    const isFunction = clFunkce === 1;
    const fn = isFunction ? funkceOrgan.get(targetPspId) : undefined;
    const fromAt = czDateHourToIso(col(r, 3));
    memberships.push({
      // od_o is part of the key: the same person can rejoin the same organ.
      id: `psp:zarazeni:${personPspId}:${targetPspId}:${clFunkce ?? 0}:${col(r, 3) ?? ""}`,
      personPspId,
      kind: isFunction ? "function" : "member",
      targetPspId,
      organPspId: isFunction ? (fn?.organId ?? null) : targetPspId,
      functionNameCz: fn?.nameCz ?? null,
      functionTypeCz: fn?.typeId != null ? (funkceTypeCz.get(fn.typeId) ?? null) : null,
      fromAt,
      toAt: czDateHourToIso(col(r, 4)),
      mandateFrom: czDateToIso(col(r, 5)),
      mandateTo: czDateToIso(col(r, 6)),
      ...prov,
      raw: rawOf(ZARAZENI_COLS, r),
    });
  }

  return {
    persons,
    organs,
    mandates,
    memberships,
    termCodes,
    duplicates: {
      persons: countDuplicateIds(persons),
      organs: countDuplicateIds(organs),
      mandates: countDuplicateIds(mandates),
      memberships: countDuplicateIds(memberships),
    },
  };
}

export interface HlasovaniBundle {
  voteEvents: VoteEventRow[];
  ballots: VoteBallotRow[];
  absences: AbsenceRow[];
  /** psp organ ids the dump's roll calls belong to (normally exactly one term). */
  termPspIds: number[];
  /**
   * Rows the publisher emitted more than once under the same natural key. Not
   * an ingest artefact — the psp.cz `omluvy` export has no unique constraint and
   * repeats whole rows. Counted, not hidden: `validity` scores against it.
   */
  duplicates: { voteEvents: number; ballots: number; absences: number };
}

/** Count natural-key collisions in a batch (the duplicates a de-duping upsert eats). */
export function countDuplicateIds(rows: { id: string }[]): number {
  return rows.length - new Set(rows.map((r) => r.id)).size;
}

/**
 * Normalize one `hl-<year>ps.zip` term dump into roll calls, ballots and excuses.
 *
 * `omluvy.unl` in these bundles is NOT term-scoped — it carries every excuse the
 * Chamber has ever recorded (1.05M rows in the 2025 bundle). Only the rows whose
 * `id_organ` matches a term present in THIS dump are kept, otherwise ingesting
 * two terms would write the same million rows twice.
 */
export function normalizeHlasovani(
  zipBytes: Uint8Array,
  prov: Prov,
  termCodes: Map<number, string>,
): HlasovaniBundle {
  const members = readZipMap(zipBytes);
  const names = [...members.keys()];

  const votesFile = names.find((n) => /^hl\d{4}s\.unl$/.test(n));
  const ballotFiles = names.filter((n) => /^hl\d{4}h\d+\.unl$/.test(n)).sort();
  const voidedFile = names.find((n) => n === "zmatecne.unl");
  const absenceFile = names.find((n) => n === "omluvy.unl");

  const voided = new Set<number>();
  if (voidedFile) {
    for (const r of unlOf(members, voidedFile)) {
      const id = colInt(r, 0);
      if (id != null) voided.add(id);
    }
  }

  const voteEvents: VoteEventRow[] = [];
  const termPspIds = new Set<number>();
  if (votesFile) {
    for (const r of unlOf(members, votesFile)) {
      const pspId = colInt(r, 0);
      const termPspId = colInt(r, 1);
      if (pspId == null || termPspId == null) continue;
      termPspIds.add(termPspId);
      const titleLong = col(r, 15);
      const titleShort = col(r, 16);
      const votedAt = czDateTimeToIso(col(r, 5), col(r, 6));
      voteEvents.push({
        id: `psp:hlasovani:${pspId}`,
        pspId,
        termPspId,
        termCode: termCodes.get(termPspId) ?? `ORGAN${termPspId}`,
        sessionNo: colInt(r, 2),
        voteNo: colInt(r, 3),
        agendaItem: colInt(r, 4),
        votedAt,
        votedOn: czDateToIso(col(r, 5)),
        yes: colInt(r, 7),
        no: colInt(r, 8),
        abstain: colInt(r, 9),
        notVoting: colInt(r, 10),
        present: colInt(r, 11),
        quorum: colInt(r, 12),
        kind: voteKind(col(r, 13)),
        outcome: voteOutcome(col(r, 14)),
        titleLong,
        titleShort,
        titleNorm: asciiFold(titleLong ?? titleShort ?? ""),
        voided: voided.has(pspId),
        ...prov,
        raw: rawOf(HLASOVANI_COLS, r),
      });
    }
  }

  const ballots: VoteBallotRow[] = [];
  for (const file of ballotFiles) {
    for (const r of unlOf(members, file)) {
      const mandatePspId = colInt(r, 0);
      const votePspId = colInt(r, 1);
      if (mandatePspId == null || votePspId == null) continue;
      const code = col(r, 2) ?? "";
      ballots.push({
        id: `psp:hlas:${votePspId}:${mandatePspId}`,
        votePspId,
        mandatePspId,
        code,
        choice: voteChoice(code),
        ...prov,
      });
    }
  }

  const absences: AbsenceRow[] = [];
  if (absenceFile) {
    for (const r of unlOf(members, absenceFile)) {
      const termPspId = colInt(r, 0);
      const mandatePspId = colInt(r, 1);
      const day = czDateToIso(col(r, 2));
      if (termPspId == null || mandatePspId == null || day == null) continue;
      if (!termPspIds.has(termPspId)) continue;
      const fromTime = col(r, 3);
      const toTime = col(r, 4);
      absences.push({
        // The full tuple is the natural key: an MP legitimately has several
        // excuse windows on one day, and (day, from) alone collides 71× in PSP10.
        id: `psp:omluva:${termPspId}:${mandatePspId}:${day}:${fromTime ?? ""}:${toTime ?? ""}`,
        termPspId,
        mandatePspId,
        day,
        fromTime,
        toTime,
        wholeDay: fromTime === null && toTime === null,
        ...prov,
        raw: rawOf(OMLUVY_COLS, r),
      });
    }
  }

  return {
    voteEvents,
    ballots,
    absences,
    termPspIds: [...termPspIds],
    duplicates: {
      voteEvents: countDuplicateIds(voteEvents),
      ballots: countDuplicateIds(ballots),
      absences: countDuplicateIds(absences),
    },
  };
}

/** Constants exported for the schema documentation / catalog publisher. */
export const PSP_SOURCE_DOCS = {
  licence:
    "Data jsou poskytována bezplatně, využití dat je podmíněno uvedením zdroje dat a případně datem zpracování dat. (psp.cz, k=1300)",
  encoding: "windows-1250",
  format: "UNL (pipe-delimited, backslash escapes)",
  refresh: "full snapshot, republished daily; no diff feed",
  index: PSP_OPENDATA_INDEX,
} as const;
