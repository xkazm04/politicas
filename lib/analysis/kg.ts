// Deterministic knowledge-graph edge computation for the civic corpus.
//
// The QUANTITATIVE SUBSTRATE of the self-expanding knowledge-graph loop
// (docs/knowledge-graph-loop.md §4.3): every number here is computed in code from
// raw ballots/memberships, NEVER authored by an LLM. A later Sonnet layer
// INTERPRETS this structure (names blocs, themes), but the counts, the rebellion
// rates, and the co-voting matrix are owned here — a subagent overcounting 2× is
// the documented failure this rule exists to prevent.
//
// Pure and DB-free by design: inputs are plain typed arrays + lookup maps, so each
// computation is unit-tested in isolation (kg.test.ts), exactly like quality.ts.
// scripts/data-analysis/kg-compute.ts is the thin IO wrapper that loads the graph
// via the Store, calls these functions, and persists kg_node/kg_edge.
//
// The tail of the file (§ "writer plumbing") holds rules EVERY kg_* ingest script
// needs and each of them used to retype — starting with `nextPass` (which pass am
// I?). They live here rather than in a script so they are pure and tested.
//
// Two bases, reused from lib/ingest/normalize.ts (the codebase convention, not a
// local reinvention):
//   • POSITIONAL_CHOICES = {yes,no} — the ONLY choices a party line / agreement is
//     measured against. abstain, not-voting, the merged K bucket and absence are
//     non-participation and never count as agreement or rebellion.
//   • Voided (zmatečné) roll calls are excluded from every discipline metric
//     (the coverage-ledger caveat: 16 voided votes in PSP10).

import { POSITIONAL_CHOICES, type VoteChoice } from "@/lib/ingest/normalize";

/* ── thresholds (documented; overridable per call) ─────────────────────────── */

/** Co-voting: min shared positional votes before a pair's agreement rate is signal, not noise. */
export const MIN_SHARED_VOTES = 50;
/** Rebellion: min votes where the MP was positional AND their club had a majority. */
export const MIN_ELIGIBLE_VOTES = 50;
/** Cohesion: a vote only counts toward a club's cohesion if this many of its members took a position. */
export const MIN_CLUB_POSITIONAL = 5;

/** influential_in edge weight by committee role (max role held wins). */
export const ROLE_WEIGHT = { chair: 1, vice: 0.6, member: 0.3 } as const;
export type CommitteeRole = keyof typeof ROLE_WEIGHT;
const ROLE_RANK: Record<CommitteeRole, number> = { chair: 3, vice: 2, member: 1 };

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** A positional choice → "yes"/"no"; anything else → null (non-participation). */
export function positionOf(choice: VoteChoice): "yes" | "no" | null {
  return POSITIONAL_CHOICES.has(choice) ? (choice as "yes" | "no") : null;
}

/* ── inputs (minimal reductions of the store rows) ─────────────────────────── */

export interface BallotInput {
  voteId: number; // vote_event psp_id
  mandateId: number; // mandate psp_id (resolved to a person below)
  choice: VoteChoice;
}
export interface ClubRef {
  organId: number; // the club's organ psp_id (→ party node id)
  abbrev: string;
}
export interface MembershipInput {
  person: number; // person psp_id
  organId: number; // organ psp_id
  functionName: string | null; // Czech role name, e.g. "Předseda" / "Místopředseda"
}

/* ── co-voting (person ↔ person agreement matrix) ──────────────────────────── */

export interface CoVoteEdge {
  src: number; // person psp_id, src < dst (undirected, stored once)
  dst: number;
  shared: number; // votes where both cast a position
  agree: number; // of those, same position
  agreement: number; // agree / shared, 3dp
}

/**
 * Weighted co-voting matrix over non-voided PSP10 votes. Two MPs share a vote
 * only when BOTH cast a positional (yes/no) choice; they agree when the position
 * matches. Emits the full matrix above `minShared` (pruning is a lossy decision
 * left to the bloc-discovery reader, not baked in). Persons are remapped to dense
 * indices so the pair accumulator is a flat typed array — O(present²) per vote.
 */
export function coVotingEdges(
  ballots: readonly BallotInput[],
  voided: ReadonlySet<number>,
  mandateToPerson: ReadonlyMap<number, number>,
  minShared: number = MIN_SHARED_VOTES,
): CoVoteEdge[] {
  const index = new Map<number, number>();
  const persons: number[] = [];
  const idxOf = (person: number): number => {
    let i = index.get(person);
    if (i === undefined) {
      i = persons.length;
      index.set(person, i);
      persons.push(person);
    }
    return i;
  };

  const byVote = new Map<number, Array<{ i: number; pos: 0 | 1 }>>();
  for (const b of ballots) {
    if (voided.has(b.voteId)) continue;
    const pos = positionOf(b.choice);
    if (pos === null) continue;
    const person = mandateToPerson.get(b.mandateId);
    if (person === undefined) continue;
    let list = byVote.get(b.voteId);
    if (!list) {
      list = [];
      byVote.set(b.voteId, list);
    }
    list.push({ i: idxOf(person), pos: pos === "yes" ? 1 : 0 });
  }

  const k = persons.length;
  const shared = new Int32Array(k * k);
  const agree = new Int32Array(k * k);
  for (const list of byVote.values()) {
    list.sort((a, b) => a.i - b.i); // always accumulate the (min,max) cell
    for (let a = 0; a < list.length; a++) {
      const ia = list[a].i;
      const pa = list[a].pos;
      const base = ia * k;
      for (let b = a + 1; b < list.length; b++) {
        const cell = base + list[b].i;
        shared[cell]++;
        if (pa === list[b].pos) agree[cell]++;
      }
    }
  }

  const edges: CoVoteEdge[] = [];
  for (let a = 0; a < k; a++) {
    for (let b = a + 1; b < k; b++) {
      const s = shared[a * k + b];
      if (s < minShared) continue;
      const g = agree[a * k + b];
      const pa = persons[a];
      const pb = persons[b];
      edges.push({
        src: Math.min(pa, pb),
        dst: Math.max(pa, pb),
        shared: s,
        agree: g,
        agreement: round3(g / s),
      });
    }
  }
  edges.sort((x, y) => x.src - y.src || x.dst - y.dst);
  return edges;
}

/* ── rebellion (MP → party, votes against the club majority) ───────────────── */

export interface RebellionStat {
  person: number;
  clubOrganId: number;
  clubAbbrev: string;
  rebelVotes: number;
  eligibleVotes: number; // positional votes where the club had a (non-tied) majority
  rate: number; // rebelVotes / eligibleVotes, 3dp
}

/**
 * Per-MP rebellion against the parliamentary club line. For each non-voided vote
 * the club's line is the STRICT majority position among its positional voters
 * (a tie yields no line and the vote is skipped for that club). An MP rebels when
 * their position opposes that line. `edges`/`byPerson` are gated to MPs with at
 * least `minEligible` eligible votes so a rate is never published off a handful.
 */
export function rebellion(
  ballots: readonly BallotInput[],
  voided: ReadonlySet<number>,
  mandateToPerson: ReadonlyMap<number, number>,
  mandateToClub: ReadonlyMap<number, ClubRef>,
  minEligible: number = MIN_ELIGIBLE_VOTES,
): { edges: RebellionStat[]; byPerson: Map<number, RebellionStat> } {
  const byVote = new Map<number, Array<{ person: number; club: ClubRef; pos: 0 | 1 }>>();
  for (const b of ballots) {
    if (voided.has(b.voteId)) continue;
    const pos = positionOf(b.choice);
    if (pos === null) continue;
    const person = mandateToPerson.get(b.mandateId);
    if (person === undefined) continue;
    const club = mandateToClub.get(b.mandateId);
    if (club === undefined) continue;
    let list = byVote.get(b.voteId);
    if (!list) {
      list = [];
      byVote.set(b.voteId, list);
    }
    list.push({ person, club, pos: pos === "yes" ? 1 : 0 });
  }

  const stat = new Map<number, RebellionStat>();
  const ensure = (person: number, club: ClubRef): RebellionStat => {
    let s = stat.get(person);
    if (!s) {
      s = { person, clubOrganId: club.organId, clubAbbrev: club.abbrev, rebelVotes: 0, eligibleVotes: 0, rate: 0 };
      stat.set(person, s);
    }
    return s;
  };

  for (const list of byVote.values()) {
    const tally = new Map<number, { yes: number; no: number }>();
    for (const v of list) {
      let t = tally.get(v.club.organId);
      if (!t) {
        t = { yes: 0, no: 0 };
        tally.set(v.club.organId, t);
      }
      if (v.pos === 1) t.yes++;
      else t.no++;
    }
    for (const v of list) {
      const t = tally.get(v.club.organId)!;
      const majority = t.yes > t.no ? 1 : t.no > t.yes ? 0 : -1;
      if (majority === -1) continue; // tie → no club line on this vote
      const s = ensure(v.person, v.club);
      s.eligibleVotes++;
      if (v.pos !== majority) s.rebelVotes++;
    }
  }

  const byPerson = new Map<number, RebellionStat>();
  const edges: RebellionStat[] = [];
  for (const s of stat.values()) {
    s.rate = s.eligibleVotes ? round3(s.rebelVotes / s.eligibleVotes) : 0;
    if (s.eligibleVotes >= minEligible) {
      byPerson.set(s.person, s);
      edges.push(s);
    }
  }
  edges.sort((a, b) => b.rate - a.rate || a.person - b.person);
  return { edges, byPerson };
}

/* ── party cohesion (Rice index, a party-node property) ────────────────────── */

export interface ClubCohesion {
  clubOrganId: number;
  clubAbbrev: string;
  cohesion: number; // mean Rice index over qualifying votes, 3dp (1 = perfectly whipped)
  votes: number; // qualifying votes
}

/**
 * Rice cohesion index per club: for each non-voided vote with at least
 * `minClubPositional` of the club's members taking a position, |yes−no|/(yes+no);
 * the club's cohesion is the mean across qualifying votes. 1.0 = perfect discipline.
 */
export function partyCohesion(
  ballots: readonly BallotInput[],
  voided: ReadonlySet<number>,
  mandateToClub: ReadonlyMap<number, ClubRef>,
  minClubPositional: number = MIN_CLUB_POSITIONAL,
): Map<number, ClubCohesion> {
  const byVote = new Map<number, Map<number, { yes: number; no: number; abbrev: string }>>();
  for (const b of ballots) {
    if (voided.has(b.voteId)) continue;
    const pos = positionOf(b.choice);
    if (pos === null) continue;
    const club = mandateToClub.get(b.mandateId);
    if (club === undefined) continue;
    let clubs = byVote.get(b.voteId);
    if (!clubs) {
      clubs = new Map();
      byVote.set(b.voteId, clubs);
    }
    let t = clubs.get(club.organId);
    if (!t) {
      t = { yes: 0, no: 0, abbrev: club.abbrev };
      clubs.set(club.organId, t);
    }
    if (pos === "yes") t.yes++;
    else t.no++;
  }

  const acc = new Map<number, { sum: number; votes: number; abbrev: string }>();
  for (const clubs of byVote.values()) {
    for (const [organId, t] of clubs) {
      const total = t.yes + t.no;
      if (total < minClubPositional) continue;
      const rice = Math.abs(t.yes - t.no) / total;
      let a = acc.get(organId);
      if (!a) {
        a = { sum: 0, votes: 0, abbrev: t.abbrev };
        acc.set(organId, a);
      }
      a.sum += rice;
      a.votes++;
    }
  }

  const out = new Map<number, ClubCohesion>();
  for (const [organId, a] of acc) {
    out.set(organId, { clubOrganId: organId, clubAbbrev: a.abbrev, cohesion: round3(a.sum / a.votes), votes: a.votes });
  }
  return out;
}

/* ── committee influence (MP → organ, degree + role) ───────────────────────── */

export interface InfluenceEdge {
  person: number;
  organId: number;
  role: CommitteeRole;
  weight: number; // ROLE_WEIGHT[role]
}

/** Czech role name → role rank. místopředseda(kyně) is checked before předseda(kyně). */
export function classifyRole(functionName: string | null): CommitteeRole {
  const n = (functionName ?? "").toLowerCase();
  if (n.includes("místopředs")) return "vice";
  if (n.includes("předs")) return "chair";
  return "member";
}

/**
 * influential_in edges over committee memberships. For each (person, committee)
 * the MAX role held sets the edge weight; a person's degree centrality is the
 * count of distinct committees they sit on. Richer (eigenvector) centrality is a
 * future frontier item — this degree+role signal is the deterministic v1.
 */
export function committeeInfluence(
  memberships: readonly MembershipInput[],
  committeeOrganIds: ReadonlySet<number>,
): { edges: InfluenceEdge[]; degree: Map<number, number> } {
  const best = new Map<string, InfluenceEdge>();
  for (const m of memberships) {
    if (!committeeOrganIds.has(m.organId)) continue;
    const role = classifyRole(m.functionName);
    const key = `${m.person}:${m.organId}`;
    const prev = best.get(key);
    if (!prev || ROLE_RANK[role] > ROLE_RANK[prev.role]) {
      best.set(key, { person: m.person, organId: m.organId, role, weight: ROLE_WEIGHT[role] });
    }
  }

  const degree = new Map<number, number>();
  const edges: InfluenceEdge[] = [];
  for (const e of best.values()) {
    edges.push(e);
    degree.set(e.person, (degree.get(e.person) ?? 0) + 1);
  }
  edges.sort((a, b) => a.person - b.person || a.organId - b.organId);
  return { edges, degree };
}

/* ── writer plumbing shared by every kg_* ingest script ────────────────────────
 *
 * Not edge computation, but the same discipline: one definition, unit-tested,
 * imported by the scripts rather than retyped in each of them. Both rules below
 * exist because the retyped version was wrong in six and five places respectively.
 */

/** The minimum a row must carry for `nextPass` to read it — every `kg_node` does. */
export interface PassStampedRow {
  readonly firstSeenPass: number;
}

/**
 * The pass number a writer stamps when the operator did not name one: one past
 * the highest `firstSeenPass` in the graph (an empty graph therefore starts at 1).
 *
 * WHY THIS IS A FUNCTION AND NOT `Math.max(0, ...rows.map(…)) + 1`: the spread
 * pushes ONE ARGUMENT PER ROW onto the call stack, and the live graph holds
 * ~153 700 `kg_node` rows — measured on node 24, a 200 000-element spread throws
 * `RangeError: Maximum call stack size exceeded`. Every writer that wrote it that
 * way therefore died before reading a single value, i.e. it worked ONLY when the
 * operator passed an explicit `--pass=N` and failed on the bare invocation each
 * script's own header documents as its default. Found and fixed in
 * kg-contribution-ingest.ts on 2026-08-04; six siblings carried the same line
 * until 2026-08-13, when it became this one helper. A `reduce` walks the rows and
 * allocates no argument list.
 *
 * UNCHANGED BY THIS HELPER, and still true: `firstSeenPass` UNDERSTATES the
 * graph-log sequence, because later passes enrich props without creating nodes.
 * An explicit `--pass=N` remains the right answer whenever the operator knows it;
 * `docs/data-analysis/graph-log.md` is the pass ledger.
 */
export function nextPass(rows: readonly PassStampedRow[]): number {
  return rows.reduce((max, r) => Math.max(max, r.firstSeenPass), 0) + 1;
}
