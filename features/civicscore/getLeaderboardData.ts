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
// `ProfileOnlyFields` (./leaderboardTypes.ts) / `toProfileEntry` below.

import "server-only";
import { cache } from "react";
import { MONEY_MEMO_TTL_MS } from "@/features/dashboard/freshness";
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
import { median } from "@/lib/analysis/score-legibility";
import { EFFORT_VERDICT_FIELDS, readVerdictRung } from "@/lib/analysis/verdict-provenance";
import { CLUB_DISPLAY } from "@/lib/civic/data";
import { STEEL } from "@/features/landing/palette";
import { computeTrend } from "@/lib/analysis/contribution-trend";
import { summarizeContributionProvenance } from "./provenance";
import { componentDefs, type ComponentKey } from "./componentDefs";
import type {
  ClubFacet,
  Directory,
  LeaderboardData,
  LeaderboardEntry,
  LeaderboardListData,
  LeaderboardListEntry,
  ProfileEntry,
} from "./leaderboardTypes";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round1 = (x: number) => Math.round(x * 10) / 10;
const num = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);
/** `num()`'s honest twin. MISSING IS NOT ZERO: a prop the graph never ingested must not
 *  render as "0 vystoupení" — the same rule score-legibility.ts keeps for its own units. */
const numOrNull = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/**
 * The six components moved to `./componentDefs.ts` (2026-08-04) — reader-facing Czech
 * labels and per-row citations cannot live behind `server-only`, because a client
 * surface and a test fixture both need the REAL strings. Re-exported here so every
 * existing import site keeps working.
 */
export { COMPONENT_DEFS, componentDefs, type ComponentDef, type ComponentKey } from "./componentDefs";

/**
 * The entry / payload / directory SHAPES moved to `./leaderboardTypes.ts` (2026-09-01) for
 * the same reason: a "use client" surface (CivicScorePage, HeadToHead, the landing
 * specimen, …) needs the types without reaching behind `server-only`. Re-exported here so
 * every server-side import site (pages, sibling loaders, tests) keeps working.
 */
export type {
  ClubFacet,
  Directory,
  DuelFacts,
  LeaderboardData,
  LeaderboardEntry,
  LeaderboardListData,
  LeaderboardListEntry,
  ProfileEntry,
  ProfileOnlyFields,
} from "./leaderboardTypes";

// Registry club abbrev -> how that club is SET (short display name + its data
// color), read straight from `CLUB_DISPLAY` in lib/civic/data.ts.
//
// This used to go the long way round: `CLUB_TO_PARTY_CODE` mapped the registry
// abbrev to a MOCK party code, and the name and color were then looked up in
// `PARTIES` — a table whose own file header calls itself "ilustrativní mock"
// and whose seats describe the NINTH term (200 of them). All 207 real rows of
// the ranking therefore took their club's name from the sample, and Motoristé
// (absent from a 9th-term table) needed a hardcoded exception right here.
// `CLUB_DISPLAY` is keyed by the registry abbrev, carries MS as a regular
// entry, and reuses the same hexes, so nothing about the rendered output
// changes — only where the strings come from. The display FORMS are kept
// deliberately (Director ruling 2026-08-12): "ANO 2011" / "TOP 09" is
// editorial typography over the registry abbrev, not a claim about data, and
// degrading /dashboard + the landing specimen to "ANO2011" would be a display
// regression. What was dishonest was the DEPENDENCY, and that is what ended.
//
// An unknown abbrev is never invented: it renders as it arrived from the
// registry, in the neutral palette color.
export const CLUB_FALLBACK_COLOR = STEEL;
function clubMeta(abbrev: string | null | undefined): { name: string; color: string } {
  const display = abbrev ? CLUB_DISPLAY[abbrev] : undefined;
  if (display) return { name: display.name, color: display.color };
  return { name: abbrev ?? "—", color: CLUB_FALLBACK_COLOR };
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

/**
 * The rung each of this MP's effort verdicts stands on (G2, deck #12).
 *
 * Only fields the loop actually STAMPED enter the map: a missing key is „nothing
 * was recorded", which the badge states by printing no rung, and defaulting it to
 * `machine` would be a guess about provenance rendered as provenance. The whole
 * derivation lives in lib/analysis/verdict-provenance.ts so this loader, the
 * profile loader and the sentinel cannot drift apart.
 */
function effortVerdictRungs(props: Record<string, unknown>): LeaderboardEntry["effortVerdictRungs"] {
  const out: LeaderboardEntry["effortVerdictRungs"] = {};
  for (const field of EFFORT_VERDICT_FIELDS) {
    const v = readVerdictRung(props, field);
    if (v) out[field] = { rung: v.rung, decidedBy: v.decidedBy, decidedAt: v.decidedAt };
  }
  return out;
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

/**
 * Display order for the leaderboard: score DESC, then Czech collation of the
 * name, then a stable pspId. The pspId tail makes it a TOTAL order — two MPs on
 * an identical score AND identical name would otherwise resolve by input
 * position. Rank itself is competition-ranked and decoupled from position (ties
 * share a rank), so this only pins ROW order; it never moves a rank.
 */
export const compareLeaderboardRow = (
  a: { score: number; name: string; pspId: number },
  b: { score: number; name: string; pspId: number },
): number => b.score - a.score || a.name.localeCompare(b.name, "cs") || a.pspId - b.pspId;

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
    effortVerdictRungs: e.effortVerdictRungs,
    effortLowScoreReason: e.effortLowScoreReason,
    effortRecordedAt: e.effortRecordedAt,
    duelFacts: e.duelFacts,
  };
}

type BuiltChamber = { data: LeaderboardData; directory: Directory };

/**
 * Cross-request memo for the chamber pass. `react.cache()` is scoped to ONE
 * request, and this pass is not per-request work: it is a fold over the whole
 * `kg_node` person slice plus mandates, clubs, organs and party nodes, and it
 * changes only when `da:kg-compute` writes. /poslanec is 207 statically
 * generated pages that each await it, so a build ran the chamber pass 207 times
 * for one identical answer; /zebricek, /kraj, /dashboard and /overeni pay it
 * again per request. (/schranka does NOT — its badge reads the narrower
 * `getRecomputeFact` on purpose.)
 *
 * The bound is the money layer's — `MONEY_MEMO_TTL_MS`, imported, never
 * re-declared: two memos over one graph on two clocks is how two surfaces print
 * two vintages of one number.
 *
 * FAILURE-HONEST by construction: `null` is never memoized (an unreachable
 * store must degrade on the next request, not for a day), and neither is an
 * EMPTY chamber (a half-ingested read must not freeze into "0 poslanců").
 */
let chamberMemo: { at: number; built: BuiltChamber } | null = null;
let chamberPasses = 0;

/** Test/measurement seam: drop the cross-request memo and the pass counter
 *  (`resetRebellionMemo` / `resetSuppliesMemo` precedent). Never called by the app. */
export function resetLeaderboardMemo(): void {
  chamberMemo = null;
  chamberPasses = 0;
}

/** How many times the chamber pass actually READ the store since the last reset.
 *  This is the number a static build multiplies by 207 when the memo is absent. */
export function leaderboardReadPasses(): number {
  return chamberPasses;
}

/**
 * The one chamber-wide read pass. `react.cache`-wrapped for the intra-request
 * case (a single request may hit it from `generateMetadata`, the page body and
 * `generateStaticParams`) and memoized ACROSS requests by `chamberMemo` above.
 */
export const buildLeaderboard = cache(async function buildLeaderboard(): Promise<BuiltChamber | null> {
  const now = Date.now();
  if (chamberMemo && now - chamberMemo.at < MONEY_MEMO_TTL_MS) return chamberMemo.built;
  const built = await readChamber();
  // Never memoize a failure, and never memoize an empty chamber.
  if (built && built.data.entries.length > 0) chamberMemo = { at: now, built };
  return built;
});

async function readChamber(): Promise<BuiltChamber | null> {
  chamberPasses += 1;
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

    const rows = persons.map((p) => {
      const pspId = Number(p.id.split(":").pop());
      nameByPspId.set(pspId, p.label);
      personPropsByPspId.set(pspId, p.props);
      const club = clubByPersonPspId.get(pspId) ?? null;
      const meta = clubMeta(club);
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
        // MISSING IS NOT ZERO — a node without an excuse rate is not an MP who never
        // filed one. See the field's doc comment on `LeaderboardEntry`.
        absenceRate: numOrNull(p.props.absence_rate),
        billsAuthored,
        interpellations,
        speechTurns,
        effortLowScoreReason: typeof p.props.effort_low_score_reason === "string" ? p.props.effort_low_score_reason : null,
        effortRecordedAt: effortRecordedAt(p.props),
        effortWorkhorse: p.props.effort_workhorse === true,
        effortWorkhorseFlavour: typeof p.props.effort_workhorse_flavour === "string" ? p.props.effort_workhorse_flavour : null,
        effortRapporteurLoad:
          typeof p.props.effort_rapporteur_load === "number" && Number.isFinite(p.props.effort_rapporteur_load)
            ? p.props.effort_rapporteur_load
            : 0,
        effortHasDossier: hasDossierProps(p.props),
        effortVerdictRungs: effortVerdictRungs(p.props),
        duelFacts: {
          speechTurns: numOrNull(p.props.speech_turns),
          amendmentsAuthored: numOrNull(p.props.amendments_authored),
          interpellations: numOrNull(p.props.interpellations),
          rapporteurLoad: numOrNull(p.props.effort_rapporteur_load),
          tenureClass: typeof p.props.effort_tenure_class === "string" ? p.props.effort_tenure_class : null,
        },
      };
    });

    // Provenance is read over the WHOLE chamber, never off the first node — see
    // ./provenance.ts for the half-recomputed and stale-formula cases that hides.
    const provenance = summarizeContributionProvenance(persons.map((p) => p.props));

    // Display order is score desc, then Czech collation of the name — deterministic, and
    // it carries NO meaning inside a tie (the surface says so).
    rows.sort(compareLeaderboardRow);

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
    // ONE median. `lib/analysis/score-legibility.ts` has exported this exact
    // computation since the legibility panel shipped — and the chamber summary
    // carried a second, byte-identical copy of it, over the same 207 scores the
    // panel medians per component. Two implementations of one statistic on one
    // page is how they diverge; the empty chamber keeps producing NaN here (the
    // averages beside it already do), because the pass never memoizes one.
    const medianScore = median(scores) ?? Number.NaN;
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
        summary: { avg: round1(avg), median: round1(medianScore), sigma: round1(sigma), count: n },
        histogram,
        components: componentDefs(),
        provenancePass: provenance.state === "uniform" ? provenance.pass : null,
        provenance,
        dossierCoverage: { withDossier: entries.filter((e) => e.effortHasDossier).length, total: entries.length },
        // Same read as `seatsByAbbrev` above — the ids were simply discarded.
        partyNodeIdByLabel: Object.fromEntries(partyNodes.map((p) => [p.label, p.id])),
      },
    };
  } catch (err) {
    reportLoaderFailure("buildLeaderboard", err);
    return null;
  }
}

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
