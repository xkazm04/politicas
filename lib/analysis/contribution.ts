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
const COMMITTEE_SATURATION = 3; // 3+ committees saturates the breadth term
const LEGISLATIVE_SATURATION = 4; // bills + interpellations that saturates output
const SPEECH_SATURATION = 40; // speaking turns that saturates floor presence

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round1 = (x: number) => Math.round(x * 10) / 10;

/** One committee/commission membership held by the MP in the term. */
export interface CommitteeSeat {
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
  committeeCount: number;
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
// this file's raw-membership-row basis and kg-compute.ts's influential_in edges:
//   · "Delegace" is in COMMITTEE_ORGAN_TYPES here but is NOT matched by kg-compute's
//     /v[ýy]bor|komis/i organ-type filter → 39/207 MPs undercounted there;
//   · psp.cz stores a leadership seat as TWO membership rows on one organ (a `member` row
//     plus a `function` row — 251/1062 PSP10 pairs), so committeeCount below counts that
//     body TWICE while influential_in dedupes to one edge → 121/207 MPs. This is the
//     dominant cause, and it means committeeCount over-counts leadership bodies (escalated
//     as a defect in batch 006's handoff — NOT silently fixed here, see case gate (a)).
// NB batch 005 attributed the mismatch to excluded Podvýbor seats; batch 006 disproved that
// (0 PSP10 memberships reference any of the 430 Podvýbor organs, so neither side counts them,
// and /v[ýy]bor|komis/i does in fact match the string "Podvýbor" anyway).
// Do not fork this logic again — import isCommitteeSeat/isLeadership instead.
export const isCommitteeSeat = (s: CommitteeSeat): boolean =>
  !!s.organType && (COMMITTEE_ORGAN_TYPES as readonly string[]).includes(s.organType);
export const isLeadership = (s: CommitteeSeat): boolean =>
  !!s.functionType && LEADERSHIP_FUNCTIONS.some((f) => s.functionType!.toLowerCase().includes(f));

/**
 * Compute an MP's contribution profile — a transparent weighted sum (max 100) over the
 * six dimensions in CONTRIBUTION_WEIGHTS. Each term is normalized so the number means
 * the same across MPs; count-based terms saturate at the named caps.
 */
export function computeContribution(input: ContributionInputs): ContributionProfile {
  const committeeSeats = input.seats.filter(isCommitteeSeat);
  const committeeCount = committeeSeats.length;
  const leadershipCount = committeeSeats.filter(isLeadership).length;

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
    participationRate: round1(participationRate),
    absenceRate: round1(absenceRate),
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
