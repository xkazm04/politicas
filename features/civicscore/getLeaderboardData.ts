// Server-only loader for /zebricek (CivicScore leaderboard) — reads the REAL
// materialized knowledge graph instead of the lib/civic mock. Must NEVER be
// imported into a client component: getStore() carries a client guard and the
// PGlite WASM must not enter the browser bundle. Degrades to null on any
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
// headline score always comes from the graph, never re-summed here (rounding of
// the stored rates means the parts approximate, not redefine, the whole).
//
// delta / trend (quarter-over-quarter) has NO real backing — single term, no
// time series — so it is OMITTED, never fabricated.

import { getStore } from "@/lib/db/store";
import { CONTRIBUTION_WEIGHTS } from "@/lib/analysis/contribution";
import { PARTIES } from "@/lib/civic/data";
import { OCHRE, STEEL } from "@/features/landing/palette";
import { computeTrend, type ContributionTrend } from "@/lib/analysis/contribution-trend";

// Saturation caps MIRROR the (module-private) constants in
// lib/analysis/contribution.ts — kept in sync there. Count-based components
// saturate at these caps, exactly as the scorer that authored the stored score.
const COMMITTEE_SATURATION = 3;
const LEGISLATIVE_SATURATION = 4;
const SPEECH_SATURATION = 40;

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
  return {
    participation: round1(participationRate * CONTRIBUTION_WEIGHTS.participation),
    committee: round1(clamp01(committeeCount / COMMITTEE_SATURATION) * CONTRIBUTION_WEIGHTS.committee),
    legislative: round1(clamp01((bills + interp) / LEGISLATIVE_SATURATION) * CONTRIBUTION_WEIGHTS.legislative),
    speech: round1(clamp01(speech / SPEECH_SATURATION) * CONTRIBUTION_WEIGHTS.speech),
    attendance: round1((1 - absenceRate) * CONTRIBUTION_WEIGHTS.attendance),
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
  // Term-over-term (PSP9→PSP10) movement — null until the prior term is restored
  // onto the node (contribution_psp9). Null ⇒ the UI shows today's single-term view.
  trend: ContributionTrend | null;
  // Effort-loop enrichment (batch 001+): a closed-vocabulary reason the score
  // sits low that is a STRUCTURAL artifact, not disengagement (declined mandate,
  // replacement, dual mandate, ministerial role, …) — see lib/analysis/low-score-reason.ts.
  // Null for the ~189/207 MPs not yet enriched, or where enrichment found no
  // structural explanation (graceful null; never fabricated).
  effortLowScoreReason: string | null;
  effortPublicRole: string | null;
}

export interface ClubFacet {
  abbrev: string;
  name: string;
  color: string;
  seats: number;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[]; // all 207, ranked desc by score
  clubs: ClubFacet[];
  summary: { avg: number; median: number; sigma: number; count: number };
  histogram: { from: number; label: string; count: number }[];
  components: { key: ComponentKey; weight: number; label: string; source: string }[];
  provenancePass: number | null; // contribution-index pass that authored the scores
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
}

export async function buildLeaderboard(): Promise<{ data: LeaderboardData; directory: Directory } | null> {
  try {
    const store = await getStore();
    if (!store) return null;

    const persons = await store.listKgNodes({ kind: "person", limit: 1000 });
    if (persons.length === 0) return null;

    const mandates = await store.listMandates({ termCode: "PSP10" });
    const clubByMandate = await store.clubByMandate("PSP10");
    const organs = await store.listOrgans({ limit: 2000 });
    const organByPsp = new Map(organs.map((o) => [o.pspId, o]));
    const partyNodes = await store.listKgNodes({ kind: "party", limit: 30 });
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
    let provenancePass: number | null = null;

    const rows = persons.map((p) => {
      const pspId = Number(p.id.split(":").pop());
      nameByPspId.set(pspId, p.label);
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
        trend: computeTrend(
          { score, components, billsAuthored, interpellations, speechTurns, committeeCount, leadershipCount },
          p.props.contribution_psp9,
        ),
        effortLowScoreReason: typeof p.props.effort_low_score_reason === "string" ? p.props.effort_low_score_reason : null,
        effortPublicRole: typeof p.props.effort_public_role === "string" ? p.props.effort_public_role : null,
      };
    });

    rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "cs"));
    const entries: LeaderboardEntry[] = rows.map((r, i) => ({ ...r, rank: i + 1 }));

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

    // Histogram in 5-pt bands spanning the real range.
    const lo = Math.floor(Math.min(...scores) / 5) * 5;
    const hi = Math.ceil(Math.max(...scores) / 5) * 5;
    const histogram: { from: number; label: string; count: number }[] = [];
    for (let from = lo; from < hi; from += 5) histogram.push({ from, label: `${from}–${from + 4}`, count: 0 });
    for (const s of scores) {
      const b = histogram.find((h) => s >= h.from && s < h.from + 5) ?? histogram[histogram.length - 1];
      if (b) b.count++;
    }

    return {
      directory: { nameByPspId, clubByPersonPspId, regionByPersonPspId },
      data: {
        entries,
        clubs,
        summary: { avg: round1(avg), median: round1(median), sigma: round1(sigma), count: n },
        histogram,
        components: COMPONENT_DEFS.map((c) => ({ key: c.key, weight: c.weight, label: c.label, source: c.source })),
        provenancePass,
      },
    };
  } catch {
    return null;
  }
}

export async function getLeaderboardData(): Promise<LeaderboardData | null> {
  const built = await buildLeaderboard();
  return built?.data ?? null;
}
