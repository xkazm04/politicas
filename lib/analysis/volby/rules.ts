// Volby: zrcadlo — the finding rules (nálezy). Deterministic + PURE, in the discipline
// of lib/analysis/contribution.ts: every threshold is a named export (so /metodika
// imports the figure it prints, never a literal), the rule set carries a formula ref,
// and each composer's JSDoc states what it REFUSES to derive.
//
// What this module never does:
//   - score. A ledger is COUNTS per valence × severity; there is no composite.
//   - guess a date. A lot without `decided_on`/`ended_on` is `figures.undated`.
//   - promote. `law_posudek` stays `pending_review` because the posudek is; the tender
//     rules are `deterministic` because they are arithmetic over register facts.
//   - value a money tie. `money_ties_unrated` is a count with valence `unrated`, and
//     `rollupLedger` never adds it to negative or positive.
//
// The thresholds are the gated artefact: the Director hand-reads the top candidates
// per rule (b007 Havířov as the reference case) and a rule firing on > 15 % of an arena
// is recalibrated, not shipped. Change a threshold → change VOLBY_RULES_REF.

import { krajSlug } from "@/features/civicscore/kraj";
import { nodeClaimRef } from "@/features/shared/provenance/claimRef";
import { inTermWindow } from "./terms";
import type { Arena, Ballot, Finding, FindingKind, Severity, SeverityLedger, Valence } from "./types";

/** THE RULE SET'S NAME — stamped into every finding's provenance by the loaders. */
export const VOLBY_RULES_REF = "volby-rules-v1";

/* ── N1 tender_konvejer ─────────────────────────────────────────────────────── */
/** Flagged-lot share ≥ this multiple of the arena baseline fires N1 (medium). */
export const N1_MULTIPLE_MEDIUM = 3;
/** … and ≥ this multiple is high. */
export const N1_MULTIPLE_HIGH = 6;
/** A winner whose wins at this authority / all its wins ≥ this is dependent. */
export const N1_DEPENDENCE_MIN = 0.9;
/* ── N2 tender_dvorni_dodavatel / N3 tender_rotace ──────────────────────────── */
export const N2_CIRCLE_MIN = 0.6;
export const N2_SWITCH_MAX = 0.2;
export const N3_SWITCH_MIN = 0.6;
/** circle3_share at or above this lifts N2/N3 from medium to high. */
export const CIRCLE_HIGH = 0.8;
/** N2/N3 need this many dated wins — a circle over three wins is noise. */
export const MIN_DATED_WINS = 10;
/* ── N4 tender_kratke_lhuty ─────────────────────────────────────────────────── */
export const N4_MULTIPLE = 3;
export const N4_MIN_LOTS = 10;
/* ── P1 tender_cisty_radar ──────────────────────────────────────────────────── */
export const P1_MIN_LOTS = 20;
export const P1_MAX_MULTIPLE = 0.5;
/* ── law_posudek ────────────────────────────────────────────────────────────── */
/**
 * A posudek is a finding only from this severity up. Every one of the 141 PSP10 bills
 * carries a posudek (the census is closed), so a `low` verdict is the posudek saying
 * „nothing unstated here" — emitting it as a negative would make the ledger count
 * legislative activity itself. Measured 2026-08-27 before this floor: SPOLU carried
 * 346 negatives over 52 seats, all of them posudky.
 */
export const POSUDEK_MIN_SEVERITY: Severity = "medium";
const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };
/* ── law_sponsor_conflict ───────────────────────────────────────────────────── */
export const CONFLICT_HIGH_CZK = 100_000_000;
/* ── effort_rapporteur ──────────────────────────────────────────────────────── */
export const RAPPORTEUR_MIN = 3;

/** The `ruleRef` each kind carries — the /metodika anchor. */
export const RULE_REF: Record<FindingKind, string> = {
  tender_konvejer: "volby:N1",
  tender_dvorni_dodavatel: "volby:N2",
  tender_rotace: "volby:N3",
  tender_kratke_lhuty: "volby:N4",
  tender_cisty_radar: "volby:P1",
  law_posudek: "volby:L1",
  law_sponsor_conflict: "volby:L2",
  law_became_law_clean: "volby:L3",
  effort_workhorse: "volby:P2",
  effort_rapporteur: "volby:P3",
  money_ties_unrated: "volby:U1",
  law_final_vote: "volby:R1",
};

/** The flag names as `tender.flags` carries them (batch-012). */
export const FLAG_SHORT_DEADLINE = "short_deadline";

/**
 * Stored figures are rounded to 4 places — a rule input, not a display string. The
 * threshold comparisons use the ROUNDED multiple, so a share of 3/10 against a
 * baseline of 1/10 is 3× (not 2,9999…×) and the figure the reader sees is the one
 * the rule decided on.
 */
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

/** The `u.` node reference of a graph id (features/shared/provenance/claimRef). */
export const nodeRef = (id: string): string => nodeClaimRef(id);

/** The ballot a tender arena answers to; statni/nejasne answer to no ballot. */
export function ballotOfArena(arena: Arena): Ballot | null {
  if (arena === "komunalni") return "komunalni";
  if (arena === "krajske") return "krajske";
  return null;
}

/* ── Authority (obec / kraj as zadavatel) ───────────────────────────────────── */

export interface AuthorityLot {
  id: string;
  decidedOn: string | null;
  endedOn: string | null;
  flags: string[];
  winnerIco: string | null;
}
export interface WinnerCircle {
  circle3_share: number;
  switch_rate: number;
  dated_wins: number;
  circle3: { ico: string; name: string; wins: number }[];
}
export interface ArenaBaseline {
  flaggedShare: number;
  shortDeadlineShare: number;
  label: string;
  source: string;
}
export interface AuthorityInput {
  ico: string;
  arena: Arena;
  lots: AuthorityLot[];
  /** winner ico → wins at this authority / all its wins (from the `wins` edge fold). */
  winnerDependence: Record<string, number>;
  circle: WinnerCircle | null;
  baseline: ArenaBaseline;
}

const authorityId = (ico: string) => `company:ico:${ico}`;

/**
 * N1–N4 + P1 over one authority's CPV-45 lots.
 *
 * Term window: for komunalni/krajske the lot's `decidedOn` (fallback `endedOn`) must
 * fall inside the ballot's TERM_WINDOWS row; lots with neither date are counted in
 * `figures.undated` and excluded from every share. For statni/nejasne there is no
 * ballot and so no term filter — `figures.termFiltered = 0` says so, and N1/P1 (the
 * arena-baseline rules) do not fire because the brief scopes them to komunalni/krajske.
 *
 * Refuses to derive: a share over fewer lots than the rule's floor; a baseline it was
 * not given (the census is the loader's, cited by `baseline.source`); any winner name.
 */
export function composeAuthorityFindings(input: AuthorityInput): Finding[] {
  const { ico, arena, baseline } = input;
  const subjectId = authorityId(ico);
  const ballot = ballotOfArena(arena);
  const subjectRef = { label: "zadavatel v grafu", ref: nodeRef(subjectId) };
  const baselineRef = { label: baseline.label, ref: baseline.source };

  let undated = 0;
  const inWindow: AuthorityLot[] = [];
  for (const lot of input.lots) {
    const date = lot.decidedOn ?? lot.endedOn;
    if (!date) {
      undated++;
      continue;
    }
    if (ballot === null || inTermWindow(ballot, date)) inWindow.push(lot);
  }
  const lots = inWindow.length;
  const flagged = inWindow.filter((l) => l.flags.length > 0).length;
  const shortDeadline = inWindow.filter((l) => l.flags.includes(FLAG_SHORT_DEADLINE)).length;
  const flaggedShare = lots > 0 ? flagged / lots : 0;
  const shortShare = lots > 0 ? shortDeadline / lots : 0;
  const common = {
    lots,
    undated,
    termFiltered: ballot === null ? 0 : 1,
  };
  const decidedOnLatest = inWindow.reduce<string | null>((acc, l) => {
    const d = (l.decidedOn ?? l.endedOn)!.slice(0, 10);
    return acc === null || d > acc ? d : acc;
  }, null);
  const lotRefs = (pick: (l: AuthorityLot) => boolean, label: string, cap = 5) =>
    inWindow
      .filter(pick)
      .slice(0, cap)
      .map((l) => ({ label, ref: nodeRef(l.id) }));

  const out: Finding[] = [];
  const base = (kind: FindingKind, valence: Valence, severity: Severity, objectId: string | null): Finding => ({
    id: objectId ? `${kind}:${subjectId}:${objectId}` : `${kind}:${subjectId}`,
    kind,
    valence,
    severity,
    subjectId,
    objectId,
    decidedOn: decidedOnLatest,
    laterOn: null,
    laterKind: null,
    reviewState: "deterministic",
    figures: {},
    ruleRef: RULE_REF[kind],
    evidence: [subjectRef],
  });

  // N1 — konvejer: flagged share ≥ 3× baseline AND a dependent winner.
  if (ballot !== null && lots > 0 && baseline.flaggedShare > 0) {
    const multiple = round4(flaggedShare / baseline.flaggedShare);
    const dependent = Object.entries(input.winnerDependence)
      .filter(([, d]) => d >= N1_DEPENDENCE_MIN)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (multiple >= N1_MULTIPLE_MEDIUM && dependent.length > 0) {
      const [winnerIco, dependence] = dependent[0];
      const winnerId = authorityId(winnerIco);
      const f = base("tender_konvejer", "negative", multiple >= N1_MULTIPLE_HIGH ? "high" : "medium", winnerId);
      f.figures = {
        ...common,
        flagged,
        share: round4(flaggedShare),
        baseline: round4(baseline.flaggedShare),
        multiple: round4(multiple),
        dependence: round4(dependence),
        dependentWinners: dependent.length,
      };
      f.evidence = [
        subjectRef,
        { label: "závislý dodavatel", ref: nodeRef(winnerId) },
        baselineRef,
        ...lotRefs((l) => l.flags.length > 0 && l.winnerIco === winnerIco, "označená zakázka"),
      ];
      out.push(f);
    }
  }

  // N2 / N3 — the winner circle (arena-independent; a circle is a circle).
  const c = input.circle;
  if (c && c.dated_wins >= MIN_DATED_WINS && c.circle3_share >= N2_CIRCLE_MIN) {
    const kind: FindingKind | null =
      c.switch_rate <= N2_SWITCH_MAX ? "tender_dvorni_dodavatel" : c.switch_rate >= N3_SWITCH_MIN ? "tender_rotace" : null;
    if (kind) {
      const f = base(kind, "negative", c.circle3_share >= CIRCLE_HIGH ? "high" : "medium", null);
      f.figures = {
        ...common,
        circle3Share: round4(c.circle3_share),
        switchRate: round4(c.switch_rate),
        datedWins: c.dated_wins,
      };
      f.evidence = [
        subjectRef,
        ...c.circle3.map((w) => ({ label: `okruh vítězů — ${w.wins} výher`, ref: nodeRef(authorityId(w.ico)) })),
      ];
      out.push(f);
    }
  }

  // N4 — short deadlines: ≥ 3× arena short_deadline baseline over ≥ 10 lots.
  if (lots >= N4_MIN_LOTS && baseline.shortDeadlineShare > 0) {
    const multiple = round4(shortShare / baseline.shortDeadlineShare);
    if (multiple >= N4_MULTIPLE) {
      const f = base("tender_kratke_lhuty", "negative", "medium", null);
      f.figures = {
        ...common,
        shortDeadline,
        share: round4(shortShare),
        baseline: round4(baseline.shortDeadlineShare),
        multiple: round4(multiple),
      };
      f.evidence = [subjectRef, baselineRef, ...lotRefs((l) => l.flags.includes(FLAG_SHORT_DEADLINE), "krátká lhůta")];
      out.push(f);
    }
  }

  // P1 — clean radar: ≥ 20 lots in the window and flagged share ≤ 0,5× baseline.
  if (ballot !== null && lots >= P1_MIN_LOTS && baseline.flaggedShare > 0) {
    const multiple = round4(flaggedShare / baseline.flaggedShare);
    if (multiple <= P1_MAX_MULTIPLE) {
      const f = base("tender_cisty_radar", "positive", "low", null);
      f.figures = {
        ...common,
        flagged,
        share: round4(flaggedShare),
        baseline: round4(baseline.flaggedShare),
        multiple: round4(multiple),
      };
      f.evidence = [subjectRef, baselineRef];
      out.push(f);
    }
  }

  return out;
}

/* ── MP (person → elected list) ─────────────────────────────────────────────── */

export interface SponsoredBill {
  tisk: string;
  forensicSeverity: Severity | null;
  forensicRecordedAt: string | null;
  flaggedConflict: boolean;
  sponsorContractCzk: number | null;
  sponsorMoneyCompanies: number | null;
  fateSb: string | null;
  fatePublishedOn: string | null;
  sponsoredOn: string | null;
  /**
   * Den POSLEDNÍHO jmenovitého hlasování o tisku (hrany `decides`), nebo `null`.
   *
   * Není to datum volby ani rozhodnutí poslance — je to POZDĚJŠÍ datovaný fakt o
   * tisku, který poslanec předložil. Proto nikdy neplní `decidedOn`: to zůstává
   * `null`, dokud graf nenese datum předložení. Sněmovna hlasovala potom.
   */
  finalVoteOn: string | null;
}
export interface MpInput {
  pspId: number;
  sponsoredBills: SponsoredBill[];
  effortWorkhorse: boolean;
  effortRapporteurLoad: number;
  effortRecordedAt: string | null;
  moneyTieCount: number;
}

const personId = (pspId: number) => `person:${pspId}`;
const billId = (tisk: string) => `bill:${tisk}`;

/**
 * law_posudek / law_sponsor_conflict / law_became_law_clean per sponsored bill, the
 * two effort badges, and the unrated money-tie count.
 *
 * Refuses to derive: a severity for a bill without a posudek (no `law_posudek`);
 * a conflict from money ties alone (only `flagged_conflict === true`, Case ①'s gate);
 * a valence for money ties (always `unrated`, and only emitted when the count > 0);
 * a "clean" law whose sponsor is flagged.
 */
export function composeMpFindings(input: MpInput): Finding[] {
  const subjectId = personId(input.pspId);
  const subjectRef = { label: "poslanec v grafu", ref: nodeRef(subjectId) };
  const out: Finding[] = [];
  const mk = (kind: FindingKind, valence: Valence, severity: Severity, objectId: string | null): Finding => ({
    id: objectId ? `${kind}:${subjectId}:${objectId}` : `${kind}:${subjectId}`,
    kind,
    valence,
    severity,
    subjectId,
    objectId,
    decidedOn: null,
    laterOn: null,
    laterKind: null,
    reviewState: "deterministic",
    figures: {},
    ruleRef: RULE_REF[kind],
    evidence: [subjectRef],
  });

  for (const bill of input.sponsoredBills) {
    const oid = billId(bill.tisk);
    const billRef = { label: `sněmovní tisk ${bill.tisk}`, ref: nodeRef(oid) };
    if (
      bill.forensicSeverity !== null &&
      SEVERITY_RANK[bill.forensicSeverity] >= SEVERITY_RANK[POSUDEK_MIN_SEVERITY]
    ) {
      const f = mk("law_posudek", "negative", bill.forensicSeverity, oid);
      f.reviewState = "pending_review";
      f.decidedOn = bill.sponsoredOn;
      f.laterOn = bill.forensicRecordedAt;
      f.laterKind = bill.forensicRecordedAt ? "forensic_verdict" : null;
      f.evidence = [subjectRef, billRef];
      out.push(f);
    }
    if (bill.flaggedConflict) {
      // MISSING IS NOT ZERO (2026-09-07): a flagged conflict whose contract sum the
      // graph does not carry is medium (it cannot clear the high bar) and prints NO
      // amount - until now `?? 0` put „0 Kč" on the finding row as if measured.
      const czk = bill.sponsorContractCzk;
      const f = mk("law_sponsor_conflict", "negative", czk !== null && czk >= CONFLICT_HIGH_CZK ? "high" : "medium", oid);
      f.reviewState = "pending_review";
      f.decidedOn = bill.sponsoredOn;
      f.figures = {
        ...(czk !== null ? { sponsor_contract_czk: czk } : {}),
        ...(bill.sponsorMoneyCompanies !== null ? { sponsor_money_companies: bill.sponsorMoneyCompanies } : {}),
      };
      f.evidence = [subjectRef, billRef];
      out.push(f);
    }
    // ZÁZNAMOVÝ řádek, ne nález: sněmovna o předloženém tisku jmenovitě hlasovala
    // a je to DATOVANÉ. Valence `unrated` schválně — doktrína `contested.ts`:
    // ledger tenhle řádek ukáže a spočítá, ale nezapočte do `total`, protože
    // „hlasovalo se" není ani plus, ani minus u předkladatele. Bez toho by první
    // datovaný sněmovní výstup na časové ose /volby musel být buď nálezem, který
    // není, nebo neviditelný.
    if (bill.finalVoteOn !== null) {
      const f = mk("law_final_vote", "unrated", "low", oid);
      // `decidedOn` zůstává null: hlasování je pozdější fakt, ne volba poslance
      // (datum předložení graf nenese — viz volbyLoader `sponsoredOn`).
      f.laterOn = bill.finalVoteOn;
      f.laterKind = "final_vote";
      f.evidence = [subjectRef, billRef];
      out.push(f);
    }
    if (bill.fateSb !== null && !bill.flaggedConflict) {
      const f = mk("law_became_law_clean", "positive", "low", oid);
      f.decidedOn = bill.sponsoredOn;
      f.laterOn = bill.fatePublishedOn;
      f.laterKind = bill.fatePublishedOn ? "fate_sb" : null;
      f.evidence = [subjectRef, billRef];
      out.push(f);
    }
  }

  if (input.effortWorkhorse) {
    const f = mk("effort_workhorse", "positive", "low", null);
    f.decidedOn = input.effortRecordedAt;
    out.push(f);
  }
  if (input.effortRapporteurLoad >= RAPPORTEUR_MIN) {
    const f = mk("effort_rapporteur", "positive", "low", null);
    f.decidedOn = input.effortRecordedAt;
    f.figures = { rapporteurLoad: input.effortRapporteurLoad, min: RAPPORTEUR_MIN };
    out.push(f);
  }
  if (input.moneyTieCount > 0) {
    const f = mk("money_ties_unrated", "unrated", "low", null);
    f.reviewState = "pending_review";
    f.figures = { ties: input.moneyTieCount };
    out.push(f);
  }
  return out;
}

/* ── Ledger, timeline, keys ─────────────────────────────────────────────────── */

const emptySeverities = (): Record<Severity, number> => ({ low: 0, medium: 0, high: 0 });

/**
 * Counts per valence × severity. `total` = negative + positive — an unrated finding
 * is COUNTED under `counts.unrated` so the reader sees it, but never enters `total`.
 */
export function rollupLedger(findings: readonly Finding[], baseline: SeverityLedger["baseline"]): SeverityLedger {
  const counts: SeverityLedger["counts"] = {
    negative: emptySeverities(),
    positive: emptySeverities(),
    unrated: emptySeverities(),
  };
  let total = 0;
  for (const f of findings) {
    counts[f.valence][f.severity]++;
    if (f.valence !== "unrated") total++;
  }
  return { counts, total, baseline };
}

/**
 * One finding per (kind, object) — the LIST-level view. A bill co-signed by twelve
 * members of one list is one bill on that list's ledger, not twelve; findings without
 * an object (effort badges, tie counts) are per person and all kept. First occurrence
 * wins, so callers pass findings in a stable member order.
 */
export function dedupeByObject(findings: readonly Finding[]): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const f of findings) {
    if (f.objectId === null) {
      out.push(f);
      continue;
    }
    const k = `${f.kind}:${f.objectId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

/** Findings with a later dated fact, newest later fact first; ties by id (stable). */
export function outcomeTimeline(findings: readonly Finding[]): Finding[] {
  return findings
    .filter((f) => f.laterOn !== null)
    .sort((a, b) => (b.laterOn as string).localeCompare(a.laterOn as string) || a.id.localeCompare(b.id));
}

/**
 * Party-list organ label → URL slug, the SAME fold as /kraj/[kraj]
 * („ANO 2011" → `ano-2011`, „SPOLU – ODS, KDU-ČSL a TOP 09" → `spolu-ods-kdu-csl-a-top-09`).
 */
export const listSlug = (label: string): string => krajSlug(label);

export interface HolderRow {
  pspId: number;
  partyListPspId: number | null;
  mandateId: number;
}

/**
 * One row per current holder. PSP10 carries 207 mandate rows for 200 seats because
 * a mid-term replacement gets a FRESH mandate row (verdict psp-poslanci×PSP10×mandate);
 * the row carries no dates and no seat id, so the only dedupe the data supports is
 * per PERSON: a person is kept once, on their highest (latest) mandate id. Rows of
 * the predecessor and the náhradník are DIFFERENT persons and both survive — this
 * function refuses to collapse a seat it cannot identify.
 */
export function dedupeCurrentHolders<T extends HolderRow>(rows: readonly T[]): T[] {
  const byPerson = new Map<number, T>();
  for (const r of rows) {
    const prev = byPerson.get(r.pspId);
    if (!prev || r.mandateId > prev.mandateId) byPerson.set(r.pspId, r);
  }
  return [...byPerson.values()];
}
