// Shared shapes for the CivicScore leaderboard — the entry, payload and directory types
// that `getLeaderboardData.ts` (server-only) fills and that /zebricek, /kraj, the landing
// specimen and /poslanec render. Plain module (no server imports) so both the server
// loader and the "use client" surfaces can import these — a client component must never
// reach behind `server-only` for a type, or the PGlite loader enters its import graph.

import type { ContributionTrend } from "@/lib/analysis/contribution-trend";
import type { OrganRow } from "@/lib/db/types";
import type { ComponentDef, ComponentKey } from "./componentDefs";
import type { ContributionProvenance } from "./provenance";

/**
 * The per-MP FACTS the head-to-head compares — the things a reader actually weighs,
 * kept apart from the six abstract component point-values because they report in their
 * OWN units and because every one of them is `number | null`, never `num()`'s 0.
 *
 * All five exist on all 207 person nodes today (measured 2026-08-04); the nullability
 * is not decoration — an un-ingested counter has to render „údaj v grafu chybí", and a
 * `never_seated` MP's empty record must never be printed as a low score.
 *
 * `rapporteurLoad` is the nullable twin of `LeaderboardEntry.effortRapporteurLoad`
 * (which defaults to 0 so the badge threshold can be evaluated); the duel needs to tell
 * "zero assignments" from "no data", the badge does not.
 */
export interface DuelFacts {
  /** psp.cz stenozáznamy — floor turns. */
  speechTurns: number | null;
  /** psp.cz tisky — written amendments authored. */
  amendmentsAuthored: number | null;
  /** psp.cz — written interpellations. */
  interpellations: number | null;
  /** Distinct bills this MP is zpravodaj for (pass-34 rapporteur edges). */
  rapporteurLoad: number | null;
  /** `effort_tenure_class` — full_term / replacement / departed / never_seated. */
  tenureClass: string | null;
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
  /**
   * `absence_rate` = omluvené dny / jednací dny (lib/analysis/contribution.ts) — the
   * OMLUVY register, the same input the index's docházka component scores.
   *
   * NULLABLE SINCE 2026-08-12, and that is the whole point: it used to arrive through
   * `num()`, so an MP whose node carries no `absence_rate` entered every average as
   * `0` — i.e. as a POLITICIAN WITH PERFECT ATTENDANCE. The only consumer is the
   * chamber mean on /dashboard, and a mean that reads a missing figure as the best
   * possible one is a claim the graph does not carry. `null` means the node carries
   * no rate; a surface must exclude it and say so, never substitute a value.
   */
  absenceRate: number | null;
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
   * When the effort-loop enrichment RECORDED its claims about this MP
   * (`effort_provenance.computedAt`, ISO date). Every enrichment verdict is a claim with
   * a vintage — it was true of the term as the pass found it, not forever — so a surface
   * that prints one must be able to date it. Null when the node carries no effort
   * provenance; never invented, never back-dated to today.
   *
   * Renamed from `effortLowScoreRecordedAt` on 2026-08-04: it was ALWAYS the whole
   * `effort_provenance` date, filled for every MP regardless of a low-score reason, and
   * the low-score-specific name is why the workhorse and rapporteur badges — written by
   * the same pass, on the same node — went undated for months while the chip beside them
   * carried its vintage.
   */
  effortRecordedAt: string | null;
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
  /**
   * WHICH RUNG each person-level verdict stands on (G2, deck #12, 2026-09-04):
   * `machine` (the pipeline said it, nobody looked) · `pending` (a human sent it
   * back) · `verified` (with a name and a date) · `rejected` (the claim is
   * withheld, disclosed). Keyed by the prop the verdict is about, because
   * rejecting „this MP is a workhorse" says NOTHING about the low-score reason
   * stored on the same node.
   *
   * A field ABSENT from this map is a field the loop never stamped — the badge
   * then prints no rung at all rather than defaulting to `machine`, because
   * assuming a provenance is the same act as inventing one.
   *
   * `decidedBy`/`decidedAt` are null on `machine` by construction: no human was
   * involved, and a stale decider must never appear beside „strojově odvozeno".
   */
  effortVerdictRungs: Record<
    string,
    { rung: "machine" | "pending" | "verified" | "rejected"; decidedBy: string | null; decidedAt: string | null }
  >;
  /** What the Souboj compares beyond the composite — see `DuelFacts`. */
  duelFacts: DuelFacts;
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
  // Added 2026-09-04 (G2): the rung each person-level verdict stands on. Carried
  // on the row because the badges render ON the row — the ladder of assertion has
  // to be visible exactly where the claim is made, not one click away.
  | "effortVerdictRungs"
  // Added 2026-08-04: the honest correction the ranking owed the reader. It exists on
  // 34 of 207 person nodes and used to reach only /poslanec, so /zebricek printed a low
  // number for an MP who declined the mandate with nothing beside it. MEASURED cost of
  // the two fields over all 207 rows: 81 179 -> 95 653 B raw (+14 474 B, +17,8 %) but
  // 7 450 -> 7 909 B gzipped (+459 B, +6,2 %) — most of the raw growth is 173 repeats
  // of two null fields, which is exactly what compresses away. Paid deliberately: the
  // alternative is a leaderboard that keeps the reason out of the reader's sight.
  | "effortLowScoreReason"
  | "effortRecordedAt"
  // Added 2026-08-04 for the Souboj. The duel could compare only the composite and six
  // weighted point-values — the most abstract numbers the app owns — because nothing
  // else ever entered the /zebricek payload. MEASURED cost of `duelFacts` over 207 rows:
  // 95 653 -> 120 264 B raw (+24 611 B), 7 909 -> 9 137 B gzipped (+1 228 B, +15,5 %);
  // warm buildLeaderboard() unchanged at 424–519 ms. No new store reads: every field
  // comes from the person props the chamber pass already holds, and the duel's chamber
  // medians are computed from the entries the page is already rendering.
  | "duelFacts"
>;

export interface LeaderboardData {
  entries: LeaderboardEntry[]; // all 207, ranked desc by score — FULL shape (getLeaderboardData, dashboard)
  clubs: ClubFacet[];
  summary: { avg: number; median: number; sigma: number; count: number };
  histogram: { from: number; label: string; count: number }[];
  components: ComponentDef[];
  /**
   * The contribution-index pass that authored the scores — non-null ONLY when every
   * person node agrees on it. A partially recomputed chamber has no single pass, and
   * this field says so by being null; `provenance` carries the whole picture.
   */
  provenancePass: number | null;
  /** Chamber-wide `{pass, ref}` aggregate + the formula-ref comparison (./provenance.ts). */
  provenance: ContributionProvenance;
  dossierCoverage: { withDossier: number; total: number }; // effort-loop enrichment reach
  /**
   * Party abbrev → its `kg_node` id, from the `kind:"party"` read this pass ALREADY
   * performs at `KG_READ_CAP` (it was folded into `seatsByAbbrev` and the ids thrown
   * away). Optional and additive: /zebricek, /metodika and /kraj ignore it.
   *
   * It exists because /dashboard ran its OWN `listKgNodes({kind:"party", limit:50})`
   * for exactly this map — the measured small-LIMIT anti-pattern documented at
   * `readChamber()` below (498/632/723 ms for 8 rows vs 2,4/2,9/41,7 ms at the cap),
   * on a page that awaits this payload anyway. Reading it here costs nothing new and
   * rides the cross-request chamber memo.
   */
  partyNodeIdByLabel?: Record<string, string>;
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
