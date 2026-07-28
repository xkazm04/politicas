// Effort / contribution index — Case ②. Deterministic + PURE: it measures how much
// real parliamentary WORK an MP does beyond just holding a seat, so the product can
// separate the absentee company-manager (Case ① surfaces the money ties) from the
// actual contributor. COUNTS come from here, never from an LLM — an analyst may reason
// ABOUT the score and flag it hollow, but must never author it (the platform's rule).
//
// Dimensions (all attributable to an id_osoba in the psp.cz bulk data):
//   committee engagement — memberships in Výbor/Komise/Delegace (+ leadership bonus),
//                          NOT club or chamber membership
//   voting participation — position-ballots vs roll calls held
//   attendance           — excused-absence load (omluvy)
//   legislative output   — bills the MP (co-)authored (predkladatel) + interpellations
//   floor presence       — stenographic speaking turns (steno/rec, substantive only)
//
// The 100-point split is a transparent weighted sum; every component is exposed so a
// score is auditable, and the saturation caps are named constants. Missing dimensions
// (e.g. oral interpellations are 0 early in a term) simply contribute 0.

/** Organ taxonomy (organTypeCz) that counts as substantive committee/commission work. */
export const COMMITTEE_ORGAN_TYPES = ["Výbor", "Komise", "Delegace", "Vyšetřovací komise", "Podvýbor"] as const;
/** Function titles that denote a leadership role in a body. */
export const LEADERSHIP_FUNCTIONS = ["předseda", "místopředseda", "ověřovatel"];

/** Point weights (sum to 100) and the saturation points for the count-based terms. */
export const CONTRIBUTION_WEIGHTS = {
  participation: 25,
  committee: 20,
  attendance: 10,
  leadership: 10,
  legislative: 20, // bills authored + interpellations
  speech: 15, // stenographic speaking turns
} as const;
// Exported so read-side surfaces (features/civicscore/getLeaderboardData.ts)
// decompose stored scores with the SAME caps the scorer used — never mirror these.
export const COMMITTEE_SATURATION = 3; // 3+ committees saturates the breadth term
export const LEGISLATIVE_SATURATION = 4; // bills + interpellations that saturates output
export const SPEECH_SATURATION = 40; // speaking turns that saturates floor presence

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round1 = (x: number) => Math.round(x * 10) / 10;
// Stored rates are PUBLISHED inputs: the leaderboard re-derives the participation and
// attendance component points from them, so a 1-decimal rate (0,9 for 938/1000) made the
// published parts disagree with the published whole by up to 1,6 points. 3 decimals keeps
// that derivation true to within 0,02 pt while staying a readable number.
const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** One committee/commission membership ROW held by the MP in the term. */
export interface CommitteeSeat {
  /**
   * psp.cz organ id of the body this row belongs to — the identity the scorer dedupes on
   * (see `computeContribution`). `null`/absent ⇒ the row's body cannot be identified, and
   * the row is then counted on its own rather than silently merged with another.
   */
  organPspId?: number | null;
  organType: string | null; // organTypeCz of the body
  functionType: string | null; // functionTypeCz, e.g. "Předseda", or null for plain membership
}

/** The activity facts for one MP in one term — assembled by the ingest from typed rows. */
export interface ContributionInputs {
  personPspId: number;
  seats: CommitteeSeat[]; // all memberships; non-committee organ types are ignored by the scorer
  ballotsWithPosition: number; // ballots where the MP took a real position (yes/no/abstain/not_voting)
  rollCallsHeld: number; // roll calls the MP's mandate could have voted in
  excusedDays: number; // distinct excused days (omluvy)
  sessionDays: number; // sitting days in the term (denominator for absence load)
  billsAuthored?: number; // tisky the MP (co-)proposed (predkladatel), MP-origin only
  interpellations?: number; // written (druh=6) + oral interpellations by the MP
  speechTurns?: number; // substantive stenographic speaking turns (steno/rec)
}

export interface ContributionProfile {
  personPspId: number;
  /** DISTINCT committee/commission bodies, not membership rows — see `computeContribution`. */
  committeeCount: number;
  /** DISTINCT bodies in which the MP holds a leadership function. */
  leadershipCount: number;
  participationRate: number; // 0–1
  absenceRate: number; // 0–1 (excusedDays / sessionDays)
  billsAuthored: number;
  interpellations: number;
  speechTurns: number;
  /** 0–100 composite; the six component sub-scores are exposed for transparency. */
  contributionScore: number;
  components: { committee: number; leadership: number; participation: number; attendance: number; legislative: number; speech: number };
}

// Exported so downstream extractors (e.g. scripts/case-loops/effort/extract-dossiers.ts) can
// build a committees[] list against the EXACT SAME definition of "committee membership" that
// committeeCount uses below. Batch 006 (Case ② effort loop) measured the divergence between
// this file's membership-row basis and kg-compute.ts's influential_in edges:
//   · "Delegace" is in COMMITTEE_ORGAN_TYPES here but is NOT matched by kg-compute's
//     /v[ýy]bor|komis/i organ-type filter → 39/207 MPs undercounted there;
//   · psp.cz stores a leadership seat as TWO membership rows on one organ (a `member` row
//     plus a `function` row — 251/1062 PSP10 pairs), so committeeCount USED TO count that
//     body twice while influential_in dedupes to one edge → 121/207 MPs affected.
//     **CORRECTED 2026-07-29** (see `computeContribution`): the count is now over DISTINCT
//     organs, so a filing convention no longer moves a rank. The correction removed 220,5
//     index points across 33 MPs and dropped the saturated population 158 → 131.
// NB batch 005 attributed the mismatch to excluded Podvýbor seats; batch 006 disproved that
// (0 PSP10 memberships reference any of the 430 Podvýbor organs, so neither side counts them,
// and /v[ýy]bor|komis/i does in fact match the string "Podvýbor" anyway).
// Do not fork this logic again — import isCommitteeSeat/isLeadership instead.
export const isCommitteeSeat = (s: CommitteeSeat): boolean =>
  !!s.organType && (COMMITTEE_ORGAN_TYPES as readonly string[]).includes(s.organType);
export const isLeadership = (s: CommitteeSeat): boolean =>
  !!s.functionType && LEADERSHIP_FUNCTIONS.some((f) => s.functionType!.toLowerCase().includes(f));

/**
 * The identity a committee row is counted under. psp.cz files one body an MP leads as TWO
 * membership rows (a `member` row + a `function` row), so ROWS are a filing convention and
 * BODIES are the fact. A row whose organ id is absent cannot be proven to be the same body
 * as any other, so it keeps a per-row identity rather than being merged on a guess.
 */
const seatKey = (s: CommitteeSeat, index: number): string =>
  typeof s.organPspId === "number" && Number.isFinite(s.organPspId) ? `organ:${s.organPspId}` : `row:${index}`;

/**
 * Compute an MP's contribution profile — a transparent weighted sum (max 100) over the
 * six dimensions in CONTRIBUTION_WEIGHTS. Each term is normalized so the number means
 * the same across MPs; count-based terms saturate at the named caps.
 *
 * **Committee breadth counts DISTINCT BODIES, not membership rows** (corrected 2026-07-29).
 * Role weighting is unchanged and lives where it always did: the separate `leadership`
 * component, which likewise counts the distinct bodies the MP leads — so a chair still
 * outscores a plain member, but chairing one committee can no longer outrank sitting on two.
 */
export function computeContribution(input: ContributionInputs): ContributionProfile {
  const committeeSeats = input.seats.filter(isCommitteeSeat);
  const bodies = new Set<string>();
  const ledBodies = new Set<string>();
  committeeSeats.forEach((s, i) => {
    const key = seatKey(s, i);
    bodies.add(key);
    if (isLeadership(s)) ledBodies.add(key);
  });
  const committeeCount = bodies.size;
  const leadershipCount = ledBodies.size;

  const participationRate = input.rollCallsHeld > 0 ? clamp01(input.ballotsWithPosition / input.rollCallsHeld) : 0;
  const absenceRate = input.sessionDays > 0 ? clamp01(input.excusedDays / input.sessionDays) : 0;
  const billsAuthored = input.billsAuthored ?? 0;
  const interpellations = input.interpellations ?? 0;
  const speechTurns = input.speechTurns ?? 0;

  const committee = clamp01(committeeCount / COMMITTEE_SATURATION) * CONTRIBUTION_WEIGHTS.committee;
  const leadership = leadershipCount > 0 ? CONTRIBUTION_WEIGHTS.leadership : 0;
  const participation = participationRate * CONTRIBUTION_WEIGHTS.participation;
  const attendance = (1 - absenceRate) * CONTRIBUTION_WEIGHTS.attendance;
  const legislative = clamp01((billsAuthored + interpellations) / LEGISLATIVE_SATURATION) * CONTRIBUTION_WEIGHTS.legislative;
  const speech = clamp01(speechTurns / SPEECH_SATURATION) * CONTRIBUTION_WEIGHTS.speech;

  const contributionScore = round1(committee + leadership + participation + attendance + legislative + speech);

  return {
    personPspId: input.personPspId,
    committeeCount,
    leadershipCount,
    participationRate: round3(participationRate),
    absenceRate: round3(absenceRate),
    billsAuthored,
    interpellations,
    speechTurns,
    contributionScore,
    components: {
      committee: round1(committee),
      leadership,
      participation: round1(participation),
      attendance: round1(attendance),
      legislative: round1(legislative),
      speech: round1(speech),
    },
  };
}

/**
 * The Case ② × Case ① crossover — the headline. An MP with real money ties (companies
 * linked, public contracts flowing) but a LOW contribution score is a candidate
 * "absentee company-manager": present on paper and in the money graph, thin on actual
 * legislative work. This is a LEAD for review, never a verdict — thresholds are
 * deliberate and the money side is itself human-gated (pending_review).
 */
export interface AbsenteeSignal {
  personPspId: number;
  contributionScore: number;
  linkedCompanies: number;
  contractCzk: number;
  isAbsenteeManagerLead: boolean;
}
export function absenteeManagerSignal(
  contribution: ContributionProfile,
  money: { linkedCompanies: number; contractCzk: number },
  opts: { maxContribution?: number; minCzk?: number } = {},
): AbsenteeSignal {
  const maxContribution = opts.maxContribution ?? 40;
  const minCzk = opts.minCzk ?? 1_000_000;
  return {
    personPspId: contribution.personPspId,
    contributionScore: contribution.contributionScore,
    linkedCompanies: money.linkedCompanies,
    contractCzk: money.contractCzk,
    isAbsenteeManagerLead:
      contribution.contributionScore < maxContribution &&
      money.linkedCompanies > 0 &&
      money.contractCzk >= minCzk,
  };
}
