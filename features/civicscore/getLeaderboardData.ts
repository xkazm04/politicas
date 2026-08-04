// Server-only loader for /zebricek (CivicScore leaderboard) — reads the REAL
// materialized knowledge graph instead of the lib/civic mock. The `server-only`
// import makes any client-component import a build-time error — the PGlite
// WASM must not enter the browser bundle. Degrades to null on any
// failure (no store, empty graph, PGlite unavailable) so the page never breaks.
//
// ── mock → real mapping (documented per task) ─────────────────────────────
// The mock MP had a 0–100 composite over 4 published pillars
// (activity/attendance/independence/integrity). The REAL analog is the
// CONTRIBUTION INDEX (lib/analysis/contribution.ts): a 0–100 composite whose
// SIX components each carry a published weight. We expose those six honestly
// rather than forcing them into the four mock pillars:
//
//   participation ×25 · committee ×20 · legislative ×20 ·
//   speech ×15 · attendance ×10 · leadership ×10        (sum = 100)
//
// `contribution_score` (authoritative, from the deterministic kg-compute pass)
// is the leaderboard score and the ranking key; rank = descending over all 207
// real persons. Component POINTS are re-derived from the published per-MP rates
// using the same weights + saturation caps, purely for the breakdown UI — the
// headline score always comes from the graph, never re-summed here. The parts
// approximate the whole rather than redefining it: each part is rounded to a
// tenth for display, so their visible sum can sit a tenth off the composite
// (measured 2026-07-29 over the real store: 71/207 MPs, max |Δ| 0,1 — it was
// 197/207 and 1,6 until pass 42 published the underlying rates at 3 decimals).
// The footnote under the breakdown says this; it must not claim an identity the
// rounding cannot keep.
//
// `committee_count` counts DISTINCT BODIES since the pass-42 correction
// (2026-07-29) — psp.cz files a led body as two membership rows, and counting
// rows let a filing convention move a rank. See lib/analysis/contribution.ts.
//
// delta / trend (quarter-over-quarter) has NO real backing — single term, no
// time series — so it is OMITTED, never fabricated. The one real movement that
// DOES exist (PSP9 → PSP10, `contribution_psp9`) is a profile-only field: see
// `ProfileOnlyFields` / `toProfileEntry` below.

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { storeReady } from "@/lib/db/readiness";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { getStore } from "@/lib/db/store";
import {
  COMMITTEE_SATURATION,
  CONTRIBUTION_WEIGHTS,
  LEGISLATIVE_SATURATION,
  SPEECH_SATURATION,
} from "@/lib/analysis/contribution";
import { isPublicSafe, publicCopyOrNull } from "@/lib/analysis/public-copy";
import { PARTIES } from "@/lib/civic/data";
import { OCHRE, STEEL } from "@/features/landing/palette";
import { computeTrend, type ContributionTrend } from "@/lib/analysis/contribution-trend";
import type { OrganRow } from "@/lib/db/types";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round1 = (x: number) => Math.round(x * 10) / 10;
const num = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);

/** The six contribution components, in published-weight order — the breakdown axis. */
export const COMPONENT_DEFS = [
  { key: "participation", weight: CONTRIBUTION_WEIGHTS.participation, label: "Účast při hlasování", source: "psp.cz — poziční hlasy" },
  { key: "committee", weight: CONTRIBUTION_WEIGHTS.committee, label: "Práce ve výborech", source: "psp.cz — členství ve výborech" },
  { key: "legislative", weight: CONTRIBUTION_WEIGHTS.legislative, label: "Legislativní výstup", source: "psp.cz — tisky + interpelace" },
  { key: "speech", weight: CONTRIBUTION_WEIGHTS.speech, label: "Vystoupení v sále", source: "psp.cz — stenozáznamy" },
  { key: "attendance", weight: CONTRIBUTION_WEIGHTS.attendance, label: "Docházka", source: "psp.cz — omluvy" },
  { key: "leadership", weight: CONTRIBUTION_WEIGHTS.leadership, label: "Vedení orgánů", source: "psp.cz — funkce ve výborech" },
] as const;

export type ComponentKey = (typeof COMPONENT_DEFS)[number]["key"];

// Real club abbrev → mock PARTIES code — reuses the sanctioned party data-colors
// from lib/civic/data.ts (the rule's home for data-driven colors). Motoristé
// (MS) has no mock entry → a palette token; unknown clubs fall back to steel.
const CLUB_TO_PARTY_CODE: Record<string, string> = {
  ANO2011: "ano",
  ODS: "ods",
  STAN: "stan",
  "KDU-ČSL": "kdu",
  SPD: "spd",
  TOP09: "top",
  Piráti: "pir",
};
export const CLUB_FALLBACK_COLOR = STEEL;
function clubMeta(abbrev: string | null | undefined): { name: string; color: string } {
  const code = abbrev ? CLUB_TO_PARTY_CODE[abbrev] : undefined;
  const p = code ? PARTIES.find((x) => x.code === code) : undefined;
  if (p) return { name: p.name, color: p.color };
  if (abbrev === "MS") return { name: "Motoristé", color: OCHRE };
  return { name: abbrev ?? "—", color: STEEL };
}

/** True when the person node carries at least one narrative dossier prop
 * (effort-loop enrichment, batch 001+) — the closed-vocabulary props
 * (tenure, low-score-reason, workhorse) don't count; those already have
 * their own dedicated surfaces. */
function hasDossierProps(props: Record<string, unknown>): boolean {
  const themes = props.effort_work_themes;
  if (Array.isArray(themes) && themes.length > 0) return true;
  // Only prose that would actually RENDER counts as "has a dossier" — a string
  // withheld by the public-copy guard must not light up the dossier affordance
  // and send a reader to a profile that shows nothing.
  for (const key of ["effort_bill_focus", "effort_notes", "effort_public_role"]) {
    if (isPublicSafe(props[key] as string | undefined)) return true;
  }
  return false;
}

/** When the effort-loop enrichment RECORDED its claims about this MP
 *  (`effort_provenance.computedAt`, kept as a bare ISO date). Null when the node carries
 *  no effort provenance — a correction without a vintage is printed undated, never
 *  back-dated to today. */
function effortRecordedAt(props: Record<string, unknown>): string | null {
  const prov = props.effort_provenance;
  if (!prov || typeof prov !== "object") return null;
  const at = (prov as { computedAt?: unknown }).computedAt;
  return typeof at === "string" && at.length >= 10 ? at.slice(0, 10) : null;
}

/** Volební kraj organ nameCz → the label we render. */
function regionLabel(nameCz: string | null): string | null {
  if (!nameCz) return null;
  if (nameCz === "Hlavní město Praha") return "Praha";
  if (nameCz === "Vysočina") return "Vysočina";
  return `${nameCz} kraj`;
}

/** Re-derive the six weighted component POINTS from the stored per-MP rates. */
export function componentPoints(props: Record<string, unknown>): Record<ComponentKey, number> {
  const participationRate = num(props.participation_rate);
  const absenceRate = num(props.absence_rate);
  const committeeCount = num(props.committee_count);
  const leadershipCount = num(props.leadership_count);
  const bills = num(props.bills_authored);
  const interp = num(props.interpellations);
  const speech = num(props.speech_turns);
  // participation/attendance are stored rates that SHOULD already be in [0,1],
  // but unlike the other four components they were never run through clamp01 —
  // a single out-of-range rate (a future unit mismatch, a bad ingest value)
  // would otherwise produce a component point value exceeding its own weight,
  // silently breaking the "points ≤ weight" invariant every bar visualization
  // (leaderboard breakdown bars, head-to-head mirrored bars) depends on.
  return {
    participation: round1(clamp01(participationRate) * CONTRIBUTION_WEIGHTS.participation),
    committee: round1(clamp01(committeeCount / COMMITTEE_SATURATION) * CONTRIBUTION_WEIGHTS.committee),
    legislative: round1(clamp01((bills + interp) / LEGISLATIVE_SATURATION) * CONTRIBUTION_WEIGHTS.legislative),
    speech: round1(clamp01(speech / SPEECH_SATURATION) * CONTRIBUTION_WEIGHTS.speech),
    attendance: round1(clamp01(1 - absenceRate) * CONTRIBUTION_WEIGHTS.attendance),
    leadership: leadershipCount > 0 ? CONTRIBUTION_WEIGHTS.leadership : 0,
  };
}

/** One ranked MP as rendered by the leaderboard + profile. */
export interface LeaderboardEntry {
  pspId: number;
  rank: number;
  name: string;
  clubAbbrev: string;
  clubName: string;
  clubColor: string;
  region: string | null;
  score: number; // authoritative contribution_score (0–100)
  /**
   * How many MPs hold EXACTLY this score, this MP included (1 = unique). A 0–100 index
   * published to one decimal over 207 MPs ties often — 25 groups, 55 MPs at the pass-42
   * recompute — and `rank` is shared across each group, so a surface that prints a rank
   * has to be able to say whether it is shared. Never used to reorder anything.
   */
  tiedCount: number;
  components: Record<ComponentKey, number>; // earned points, sum ≈ score
  absenteeManagerLead: boolean;
  // raw underlying stats (for profile cards / honest headline)
  participationRate: number;
  committeeCount: number;
  leadershipCount: number;
  absenceRate: number;
  billsAuthored: number;
  interpellations: number;
  speechTurns: number;
  // Effort-loop enrichment (batch 001+): a closed-vocabulary reason the score
  // sits low that is a STRUCTURAL artifact, not disengagement (declined mandate,
  // replacement, dual mandate, ministerial role, …) — see lib/analysis/low-score-reason.ts.
  // Null where enrichment found no structural explanation (graceful null; never
  // fabricated) — 34 of the 207 carry one (measured on the live graph 2026-08-04).
  effortLowScoreReason: string | null;
  /**
   * When the correction above was RECORDED (`effort_provenance.computedAt`, ISO date).
   * A correction is a claim with a vintage — it was true of the term as the enrichment
   * pass found it, not forever — so a surface that prints the reason must be able to
   * date it. Null when the node carries no effort provenance; never invented.
   */
  effortLowScoreRecordedAt: string | null;
  // Quiet-workhorse surface (batch 003, O-effort-3): P31's two positive-symmetry
  // flavours — legislative-authorship vs oversight-institutional. Null/false for the
  // ~191/207 MPs not (yet) flagged by the deterministic triage lens; never fabricated.
  effortWorkhorse: boolean;
  effortWorkhorseFlavour: string | null;
  // Rapporteur load (batch 008): distinct bills the MP is zpravodaj for
  // (pass-34 rapporteur edges, deterministic count). 0 for the 128/207 without
  // an assignment; ≥3 earns the „Zpravodajský tahoun" badge (18/207 at pass 36).
  effortRapporteurLoad: number;
  // Dossier coverage flag (Case ② effort-loop, batch 001–005): true when this
  // MP carries at least one of the rich narrative dossier props (work themes,
  // bill focus, notes, public role) — used to surface a "dossier available"
  // affordance on the leaderboard and an honest coverage count. 165/207 as of
  // batch 005; grows as later batches enrich the remaining army.
  effortHasDossier: boolean;
}

/**
 * The two fields ONLY `/poslanec` reads, split out of `LeaderboardEntry` because the
 * chamber pass computed them 207 times per request and every surface except one profile
 * page threw them away.
 *
 * Measured on the live store (2026-08-04, 207 MPs): `computeTrend` 3,5 ms and the
 * `effort_public_role` public-copy guard 25,7 ms per request — ~29 ms of a read path
 * whose whole warm cost is ~500 ms after this change. `trend` additionally serialized
 * a full per-component prior-term structure for MPs no page was showing it to.
 *
 * `toProfileEntry()` re-attaches them for the ONE MP a profile renders, from the person
 * props the chamber pass already read (`Directory.personPropsByPspId`) — so this is a
 * shape split, not a second read.
 */
export interface ProfileOnlyFields {
  /** Term-over-term (PSP9→PSP10) movement — null until the prior term is restored onto
   *  the node (`contribution_psp9`). Null ⇒ the UI shows today's single-term view. */
  trend: ContributionTrend | null;
  /** Analyst prose, rendered VERBATIM → passed through the public-copy guard. */
  effortPublicRole: string | null;
}

/** A `LeaderboardEntry` with the profile-only fields attached — what `/poslanec` needs. */
export type ProfileEntry = LeaderboardEntry & ProfileOnlyFields;

/** Attach the profile-only fields to one ranked entry, from that MP's raw person props. */
export function toProfileEntry(entry: LeaderboardEntry, props: Record<string, unknown>): ProfileEntry {
  return {
    ...entry,
    trend: computeTrend(
      {
        score: entry.score,
        components: entry.components,
        billsAuthored: entry.billsAuthored,
        interpellations: entry.interpellations,
        speechTurns: entry.speechTurns,
        committeeCount: entry.committeeCount,
        leadershipCount: entry.leadershipCount,
      },
      props.contribution_psp9,
    ),
    effortPublicRole: publicCopyOrNull(props.effort_public_role as string | undefined),
  };
}

export interface ClubFacet {
  abbrev: string;
  name: string;
  color: string;
  seats: number;
}

/** What /zebricek actually renders per row (list + duel) — a fraction of
 *  LeaderboardEntry. The full entry also carries `effortLowScoreReason` and seven raw
 *  per-MP counters: real fields, but ones the leaderboard list never read.
 *  `getProfileData.ts` still calls `buildLeaderboard()` directly and gets the FULL
 *  `LeaderboardEntry` (plus `ProfileOnlyFields`, via `toProfileEntry`) for the one MP a
 *  profile page needs — only this list-facing wrapper trims. Measured on the live store
 *  2026-08-04: the whole `LeaderboardData` payload serializes to 296 473 bytes, the
 *  trimmed list payload to 81 179. */
export type LeaderboardListEntry = Pick<
  LeaderboardEntry,
  | "pspId"
  | "rank"
  | "name"
  | "clubAbbrev"
  | "clubName"
  | "clubColor"
  | "region"
  | "score"
  | "tiedCount"
  | "components"
  | "effortWorkhorse"
  | "effortWorkhorseFlavour"
  | "effortRapporteurLoad"
  | "effortHasDossier"
  // Added 2026-08-04: the honest correction the ranking owed the reader. It exists on
  // 34 of 207 person nodes and used to reach only /poslanec, so /zebricek printed a low
  // number for an MP who declined the mandate with nothing beside it. MEASURED cost of
  // the two fields over all 207 rows: 81 179 -> 95 653 B raw (+14 474 B, +17,8 %) but
  // 7 450 -> 7 909 B gzipped (+459 B, +6,2 %) — most of the raw growth is 173 repeats
  // of two null fields, which is exactly what compresses away. Paid deliberately: the
  // alternative is a leaderboard that keeps the reason out of the reader's sight.
  | "effortLowScoreReason"
  | "effortLowScoreRecordedAt"
>;

function toListEntry(e: LeaderboardEntry): LeaderboardListEntry {
  return {
    pspId: e.pspId,
    rank: e.rank,
    name: e.name,
    clubAbbrev: e.clubAbbrev,
    clubName: e.clubName,
    clubColor: e.clubColor,
    region: e.region,
    score: e.score,
    tiedCount: e.tiedCount,
    components: e.components,
    effortWorkhorse: e.effortWorkhorse,
    effortWorkhorseFlavour: e.effortWorkhorseFlavour,
    effortRapporteurLoad: e.effortRapporteurLoad,
    effortHasDossier: e.effortHasDossier,
    effortLowScoreReason: e.effortLowScoreReason,
    effortLowScoreRecordedAt: e.effortLowScoreRecordedAt,
  };
}

export interface LeaderboardData {
  entries: LeaderboardEntry[]; // all 207, ranked desc by score — FULL shape (getLeaderboardData, dashboard)
  clubs: ClubFacet[];
  summary: { avg: number; median: number; sigma: number; count: number };
  histogram: { from: number; label: string; count: number }[];
  components: { key: ComponentKey; weight: number; label: string; source: string }[];
  provenancePass: number | null; // contribution-index pass that authored the scores
  dossierCoverage: { withDossier: number; total: number }; // effort-loop enrichment reach
}

/** Same shape as `LeaderboardData` but with the trimmed `LeaderboardListEntry`
 *  — what `getLeaderboardListData()` (the /zebricek-only entry point) returns. */
export interface LeaderboardListData extends Omit<LeaderboardData, "entries"> {
  entries: LeaderboardListEntry[];
}

/**
 * Directory maps used by both loaders — resolves each person's name, club and
 * region from the person nodes + mandates. Exported so the profile loader
 * reuses exactly the same identity resolution.
 */
export interface Directory {
  nameByPspId: Map<number, string>;
  clubByPersonPspId: Map<number, string>;
  regionByPersonPspId: Map<number, string | null>;
  /**
   * Raw person-node props keyed by pspId, and the organ rows, from the reads this
   * function ALREADY performs. Exposed so a per-MP loader (getProfileData) never
   * re-reads the `person` node relation or the `organ` table a second time inside
   * the same request — it used to do both (person nodes read 3×, organs 2× with two
   * different limits over the same 1 790 rows).
   */
  personPropsByPspId: Map<number, Record<string, unknown>>;
  organByPspId: Map<number, OrganRow>;
}

/**
 * The one chamber-wide read pass. `react.cache`-wrapped: a single request may hit
 * it from `generateMetadata`, the page body and `generateStaticParams` — before
 * this wrapper each of those ran the whole pipeline again (207 persons + mandates
 * + clubs + organs + party nodes, every time).
 */
export const buildLeaderboard = cache(async function buildLeaderboard(): Promise<
  { data: LeaderboardData; directory: Directory } | null
> {
  try {
    const store = await getStore();
    if (!store) return null;
    if (!(await storeReady(store, ["person"]))) return null;

    // Every read on this path uses the ONE shared cap (lib/db/readCap.ts). The four
    // hand-picked limits this replaced were not just inconsistent, they were SLOW: a
    // small limit makes the planner walk the `kg_node` primary key and filter by kind
    // instead of using `kg_node_kind_idx`, so it scans the whole 154k-row table until
    // it has collected N matches. Measured on the live store (2026-08-04, 3 rounds):
    // `listKgNodes({kind:"party", limit:30})` cost 498/632/723 ms and returns 8 rows;
    // the same read at the cap cost 2,4/2,9/41,7 ms. `listOrgans({limit:2000})` was
    // also 210 rows from silent truncation (1 790 actual) with no guard behind it —
    // `graph.ts`'s listers now carry the same `warnIfTruncated` the kg listers do.
    const persons = await store.listKgNodes({ kind: "person", limit: KG_READ_CAP });
    if (persons.length === 0) return null;

    const mandates = await store.listMandates({ termCode: "PSP10", limit: KG_READ_CAP });
    const clubByMandate = await store.clubByMandate("PSP10");
    const organs = await store.listOrgans({ limit: KG_READ_CAP });
    const organByPsp = new Map(organs.map((o) => [o.pspId, o]));
    const partyNodes = await store.listKgNodes({ kind: "party", limit: KG_READ_CAP });
    const seatsByAbbrev = new Map(partyNodes.map((p) => [p.label, num(p.props.seats)]));

    // personPspId → club abbrev / region label
    const clubByPersonPspId = new Map<number, string>();
    const regionByPersonPspId = new Map<number, string | null>();
    for (const m of mandates) {
      const club = clubByMandate.get(m.pspId);
      if (club) clubByPersonPspId.set(m.personPspId, club);
      const region = m.regionPspId ? regionLabel(organByPsp.get(m.regionPspId)?.nameCz ?? null) : null;
      regionByPersonPspId.set(m.personPspId, region);
    }

    const nameByPspId = new Map<number, string>();
    const personPropsByPspId = new Map<number, Record<string, unknown>>();
    let provenancePass: number | null = null;

    const rows = persons.map((p) => {
      const pspId = Number(p.id.split(":").pop());
      nameByPspId.set(pspId, p.label);
      personPropsByPspId.set(pspId, p.props);
      const club = clubByPersonPspId.get(pspId) ?? null;
      const meta = clubMeta(club);
      if (provenancePass === null) {
        const prov = p.props.contribution_provenance as { pass?: number } | undefined;
        if (prov && typeof prov.pass === "number") provenancePass = prov.pass;
      }
      const components = componentPoints(p.props);
      const score = num(p.props.contribution_score);
      const billsAuthored = num(p.props.bills_authored);
      const interpellations = num(p.props.interpellations);
      const speechTurns = num(p.props.speech_turns);
      const committeeCount = num(p.props.committee_count);
      const leadershipCount = num(p.props.leadership_count);
      return {
        pspId,
        name: p.label,
        clubAbbrev: club ?? "—",
        clubName: meta.name,
        clubColor: meta.color,
        region: regionByPersonPspId.get(pspId) ?? null,
        score,
        components,
        absenteeManagerLead: p.props.absentee_manager_lead === true,
        participationRate: num(p.props.participation_rate),
        committeeCount,
        leadershipCount,
        absenceRate: num(p.props.absence_rate),
        billsAuthored,
        interpellations,
        speechTurns,
        effortLowScoreReason: typeof p.props.effort_low_score_reason === "string" ? p.props.effort_low_score_reason : null,
        effortLowScoreRecordedAt: effortRecordedAt(p.props),
        effortWorkhorse: p.props.effort_workhorse === true,
        effortWorkhorseFlavour: typeof p.props.effort_workhorse_flavour === "string" ? p.props.effort_workhorse_flavour : null,
        effortRapporteurLoad:
          typeof p.props.effort_rapporteur_load === "number" && Number.isFinite(p.props.effort_rapporteur_load)
            ? p.props.effort_rapporteur_load
            : 0,
        effortHasDossier: hasDossierProps(p.props),
      };
    });

    // Display order is score desc, then Czech collation of the name — deterministic, and
    // it carries NO meaning inside a tie (the surface says so).
    rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "cs"));

    // COMPETITION RANKING (1, 2, 2, 4). A rank is one more than the number of MPs who
    // actually score HIGHER, so tied MPs share it and nothing is decided by where a name
    // falls in the alphabet — the leaderboard used to print ranks 2 and 3 for two MPs on
    // an identical 95,4, one of them inside the red top-3 styling. The next distinct score
    // resumes at the position it truly occupies, so "rank N of 207" stays readable.
    // NB this is the same rule `lib/analysis/score-legibility.ts` already uses for
    // `rankAtCap` (1 + how many real MPs score above the projection).
    const tiedCountByScore = new Map<number, number>();
    for (const r of rows) tiedCountByScore.set(r.score, (tiedCountByScore.get(r.score) ?? 0) + 1);
    let rank = 0;
    let placed = 0;
    let prevScore = Number.NaN;
    const entries: LeaderboardEntry[] = rows.map((r) => {
      placed++;
      if (r.score !== prevScore) {
        rank = placed;
        prevScore = r.score;
      }
      return { ...r, rank, tiedCount: tiedCountByScore.get(r.score) ?? 1 };
    });

    // Club facets present in the chamber, ordered by seats desc.
    const clubSet = new Map<string, ClubFacet>();
    for (const e of entries) {
      if (e.clubAbbrev === "—" || clubSet.has(e.clubAbbrev)) continue;
      clubSet.set(e.clubAbbrev, {
        abbrev: e.clubAbbrev,
        name: e.clubName,
        color: e.clubColor,
        seats: seatsByAbbrev.get(e.clubAbbrev) ?? entries.filter((x) => x.clubAbbrev === e.clubAbbrev).length,
      });
    }
    const clubs = [...clubSet.values()].sort((a, b) => b.seats - a.seats);

    // Summary over real scores.
    const scores = entries.map((e) => e.score);
    const n = scores.length;
    const avg = scores.reduce((s, v) => s + v, 0) / n;
    const sorted = [...scores].sort((a, b) => a - b);
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const sigma = Math.sqrt(scores.reduce((s, v) => s + (v - avg) ** 2, 0) / n);

    // Histogram in 5-pt bands spanning the real range. A band is the half-open interval
    // [from, from+5), so it is LABELLED with the bound it actually runs to and the surface
    // states that the upper bound belongs to the next band. Labelling [65,70) as "65–69"
    // put 37 MPs above their own band's printed ceiling.
    const lo = Math.floor(Math.min(...scores) / 5) * 5;
    // Strictly ABOVE the maximum, so the top score falls inside a band whose printed
    // bound is true of it. `Math.ceil` left a maximum that is itself a multiple of 5
    // outside every band, and the `??` fallback below then filed it under a band it
    // sits on the boundary of.
    const hi = Math.floor(Math.max(...scores) / 5) * 5 + 5;
    const histogram: { from: number; label: string; count: number }[] = [];
    for (let from = lo; from < hi; from += 5) histogram.push({ from, label: `${from}–${from + 5}`, count: 0 });
    for (const s of scores) {
      const b = histogram.find((h) => s >= h.from && s < h.from + 5) ?? histogram[histogram.length - 1];
      if (b) b.count++;
    }

    return {
      directory: { nameByPspId, clubByPersonPspId, regionByPersonPspId, personPropsByPspId, organByPspId: organByPsp },
      data: {
        entries,
        clubs,
        summary: { avg: round1(avg), median: round1(median), sigma: round1(sigma), count: n },
        histogram,
        components: COMPONENT_DEFS.map((c) => ({ key: c.key, weight: c.weight, label: c.label, source: c.source })),
        provenancePass,
        dossierCoverage: { withDossier: entries.filter((e) => e.effortHasDossier).length, total: entries.length },
      },
    };
  } catch (err) {
    reportLoaderFailure("buildLeaderboard", err);
    return null;
  }
});

/** Full-detail loader — `/dashboard` (top-5 widget, needs `absenceRate` etc.)
 *  and anything else needing the whole `LeaderboardEntry` per MP. */
export async function getLeaderboardData(): Promise<LeaderboardData | null> {
  const built = await buildLeaderboard();
  return built?.data ?? null;
}

/** /zebricek-only loader — trims every entry to `LeaderboardListEntry` before
 *  it reaches the client component tree (see the type's doc comment). Do NOT
 *  use this for a surface that needs `trend`, dossier prose, or raw counters —
 *  use `getLeaderboardData()` for those. */
export async function getLeaderboardListData(): Promise<LeaderboardListData | null> {
  const built = await buildLeaderboard();
  if (!built) return null;
  return { ...built.data, entries: built.data.entries.map(toListEntry) };
}
