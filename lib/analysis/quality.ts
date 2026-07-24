// Deterministic quality scorer for the civic corpus.
//
// Computes the SIX UNIVERSAL CRITERIA (1–5) per slice straight from the store —
// no LLM anywhere. This module is the single source of truth for every number a
// /data-analysis run quotes; a subagent may reason ABOUT these numbers and flag
// one as semantically hollow, but it must never author one.
//
// The six criteria are fixed by cross-repo convention (completeness, freshness,
// categorization, validity, richness, volume) so scores are comparable against
// the other corpora onboarded onto the same platform. What each one MEANS is
// necessarily domain-specific — "has an award amount" is meaningless for a roll
// call — so the per-entity predicates below are the politicas interpretation,
// and each is documented next to its implementation. The arithmetic (fracScore,
// volumeScore thresholds, composite = mean of six) is kept byte-identical to the
// reference implementation so the composites really are comparable.

import type {
  AbsenceRow,
  IngestRunRow,
  MandateRow,
  MembershipRow,
  OrganRow,
  PersonRow,
  SliceQualityRow,
  SourceReleaseRow,
  VoteBallotRow,
  VoteEventRow,
} from "@/lib/db/types";
import { POSITIONAL_CHOICES } from "@/lib/ingest/normalize";

export const QUALITY_TAXONOMY_VERSION = "det-cz-v1";

export const ENTITY_KINDS = [
  "person",
  "organ",
  "mandate",
  "membership",
  "vote_event",
  "vote_ballot",
  "absence",
  "source_release",
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

/* ── shared arithmetic (identical to the reference scorer) ─────────────────── */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const round1 = (x: number) => Math.round(x * 10) / 10;
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** A 0–1 fraction → a 1–5 score. */
export const fracScore = (f: number) => round1(1 + 4 * clamp01(f));

/** Row-count bands. Kept identical to the reference repo for cross-corpus comparison. */
export function volumeScore(n: number): number {
  if (n >= 1000) return 5;
  if (n >= 200) return 4;
  if (n >= 50) return 3;
  if (n >= 10) return 2;
  return 1;
}

/** Days since the source snapshot was fetched. */
export function syncAgeScore(ageDays: number | null): number {
  if (ageDays == null) return 1;
  if (ageDays <= 1) return 5;
  if (ageDays <= 7) return 4;
  if (ageDays <= 30) return 3;
  if (ageDays <= 90) return 2;
  return 1;
}

/**
 * Days between the newest ROW in a slice and the snapshot that carried it —
 * i.e. how far behind reality the data is, independent of when we synced.
 *
 * BEWARE (and say so in a verdict): a Chamber recess legitimately pushes this
 * up. A low freshness on `vote_event` in August is the parliament not sitting,
 * not a broken pipeline. Distinguishing the two is the analyst's job.
 */
export function lagScore(lagDays: number | null): number {
  if (lagDays == null) return 1;
  if (lagDays <= 7) return 5;
  if (lagDays <= 30) return 4;
  if (lagDays <= 90) return 3;
  if (lagDays <= 180) return 2;
  return 1;
}

/* ── context the row predicates need ──────────────────────────────────────── */

export interface ScoringContext {
  personIds: Set<number>;
  organIds: Set<number>;
  organTypeById: Map<number, string | null>;
  mandateIds: Set<number>;
  mandateTermById: Map<number, string>;
  voteEventIds: Set<number>;
  voteEventKindById: Map<number, string>;
  /** mandate psp_id → parliamentary club abbreviation, resolved via membership. */
  clubByMandate: Map<number, string>;
  /** Electoral-term windows keyed by term code, for date-range validity. */
  termWindow: Map<string, { from: string | null; to: string | null }>;
}

export function buildContext(input: {
  persons: PersonRow[];
  organs: OrganRow[];
  mandates: MandateRow[];
  voteEvents: VoteEventRow[];
  clubByMandate: Map<number, string>;
}): ScoringContext {
  const organTypeById = new Map<number, string | null>();
  const termWindow = new Map<string, { from: string | null; to: string | null }>();
  for (const o of input.organs) {
    organTypeById.set(o.pspId, o.organTypeCz);
    if (o.abbrev && /^PSP\d+$/i.test(o.abbrev)) {
      termWindow.set(o.abbrev.toUpperCase(), { from: o.validFrom, to: o.validTo });
    }
  }
  return {
    personIds: new Set(input.persons.map((p) => p.pspId)),
    organIds: new Set(input.organs.map((o) => o.pspId)),
    organTypeById,
    mandateIds: new Set(input.mandates.map((m) => m.pspId)),
    mandateTermById: new Map(input.mandates.map((m) => [m.pspId, m.termCode])),
    voteEventIds: new Set(input.voteEvents.map((v) => v.pspId)),
    voteEventKindById: new Map(input.voteEvents.map((v) => [v.pspId, v.kind])),
    clubByMandate: input.clubByMandate,
    termWindow,
  };
}

/** The four per-row dimensions. Freshness and volume are slice-level, not per row. */
export interface RowFlags {
  complete: boolean;
  categorized: boolean;
  valid: boolean;
  rich: boolean;
}

const nonEmpty = (v: string | null | undefined): boolean => !!v && v.trim().length > 0;
/** U+FFFD anywhere means bytes were lost in decoding — never a valid civic record. */
const mangled = (...vs: (string | null | undefined)[]) => vs.some((v) => !!v && v.includes("�"));
const isAscii = (v: string) => /^[\x20-\x7E]*$/.test(v);
const notBefore = (later: string | null, earlier: string | null) =>
  later === null || earlier === null || later >= earlier;

/* ── per-entity predicates ────────────────────────────────────────────────── */

export function scorePerson(p: PersonRow, ctx: ScoringContext, linked: Set<number>): RowFlags {
  return {
    // Identity a civic record cannot function without.
    complete: nonEmpty(p.firstName) && nonEmpty(p.lastName) && nonEmpty(p.nameFull) && nonEmpty(p.nameNorm),
    // Placed in the graph: this person actually holds/held a seat or a body membership.
    categorized: linked.has(p.pspId),
    // Diacritic folding produced pure ASCII, no decode damage, and death does not
    // precede birth.
    valid:
      isAscii(p.nameNorm) &&
      !mangled(p.nameFull, p.firstName, p.lastName) &&
      notBefore(p.diedAt, p.birthDate) &&
      ctx.personIds.has(p.pspId),
    // Optional depth the product needs for a profile page.
    rich: !p.birthDateUnknown && nonEmpty(p.gender),
  };
}

export function scoreOrgan(o: OrganRow, ctx: ScoringContext): RowFlags {
  return {
    complete: nonEmpty(o.abbrev) && nonEmpty(o.nameCz) && o.validFrom !== null,
    // Typed into the publisher's organ taxonomy (Klub / Výbor / Komise / …).
    categorized: nonEmpty(o.organTypeCz),
    valid:
      isAscii(o.nameNorm) &&
      !mangled(o.nameCz, o.abbrev) &&
      notBefore(o.validTo, o.validFrom) &&
      (o.parentPspId === null || ctx.organIds.has(o.parentPspId)),
    // Bilingual label + a resolved parent: what a public API needs to render it.
    rich: nonEmpty(o.nameEn) && o.parentPspId !== null,
  };
}

export function scoreMandate(m: MandateRow, ctx: ScoringContext): RowFlags {
  return {
    complete:
      ctx.personIds.has(m.personPspId) &&
      m.termPspId > 0 &&
      nonEmpty(m.termCode) &&
      m.regionPspId !== null &&
      m.partyListPspId !== null,
    // The pillar-bearing classification: which parliamentary club this seat sits in.
    // NOTE this is deliberately NOT `party_list` — an MP elected on one list can
    // sit in another club (or none), and conflating the two is the classic Czech
    // political-data error.
    categorized: ctx.clubByMandate.has(m.pspId),
    valid:
      ctx.personIds.has(m.personPspId) &&
      ctx.organIds.has(m.termPspId) &&
      (m.regionPspId === null || ctx.organIds.has(m.regionPspId)) &&
      (m.partyListPspId === null || ctx.organIds.has(m.partyListPspId)),
    // Contactability — the difference between a row and a public accountability profile.
    rich: (nonEmpty(m.email) || nonEmpty(m.web) || nonEmpty(m.facebook)) && m.hasPhoto,
  };
}

export function scoreMembership(m: MembershipRow, ctx: ScoringContext): RowFlags {
  return {
    complete: m.personPspId > 0 && m.targetPspId > 0 && m.organPspId !== null && m.fromAt !== null,
    // Resolved to a TYPED organ — an untyped target cannot answer "which club".
    categorized: m.organPspId !== null && nonEmpty(ctx.organTypeById.get(m.organPspId) ?? null),
    valid:
      ctx.personIds.has(m.personPspId) &&
      (m.organPspId === null || ctx.organIds.has(m.organPspId)) &&
      notBefore(m.toAt, m.fromAt),
    // A named office rather than bare membership, or an explicit mandate window.
    rich: nonEmpty(m.functionTypeCz) || m.mandateFrom !== null,
  };
}

export function scoreVoteEvent(v: VoteEventRow): RowFlags {
  const tallied =
    v.yes !== null && v.no !== null && v.abstain !== null && v.notVoting !== null && v.present !== null;
  return {
    complete: v.votedAt !== null && v.sessionNo !== null && v.voteNo !== null && nonEmpty(v.titleLong) && tallied,
    // Both vocabularies resolved (never the `unknown`/`void` fallbacks).
    categorized: v.kind !== "unknown" && v.outcome !== "unknown" && v.outcome !== "void",
    // THE arithmetic check: the publisher's own tallies must reconcile —
    // pro + proti + zdržel + nehlasoval == přihlášeno. A row that fails this is
    // internally inconsistent regardless of how complete it looks.
    valid:
      tallied &&
      (v.yes ?? 0) + (v.no ?? 0) + (v.abstain ?? 0) + (v.notVoting ?? 0) === (v.present ?? -1) &&
      !mangled(v.titleLong, v.titleShort) &&
      v.votedOn !== null,
    // A real agenda item with both a long and a short label: linkable to a bill.
    rich: nonEmpty(v.titleLong) && nonEmpty(v.titleShort) && (v.agendaItem ?? 0) > 0,
  };
}

export function scoreBallot(b: VoteBallotRow, ctx: ScoringContext): RowFlags {
  const knownVote = ctx.voteEventIds.has(b.votePspId);
  return {
    complete: nonEmpty(b.code) && b.choice !== "unknown",
    // Mapped into the documented choice vocabulary.
    categorized: b.choice !== "unknown",
    // Both ends of the edge resolve — a ballot pointing at a missing roll call or
    // a missing mandate is a dangling edge in the graph.
    valid: knownVote && ctx.mandateIds.has(b.mandatePspId),
    // A DISTINGUISHABLE position. `abstain_or_not_voting` (code K) is the merged
    // bucket the Chamber has published since 1995 — the row exists but cannot tell
    // "abstained" from "was present and pressed nothing". Scoring that as low
    // richness is the honest reading; it is a publisher limitation, not a defect
    // in this pipeline, and a verdict should say so rather than call it missing data.
    rich: POSITIONAL_CHOICES.has(b.choice as never) || b.choice === "abstain" || b.choice === "not_voting",
  };
}

export function scoreAbsence(a: AbsenceRow, ctx: ScoringContext): RowFlags {
  const term = ctx.mandateTermById.get(a.mandatePspId);
  const win = term ? ctx.termWindow.get(term) : undefined;
  return {
    complete: a.mandatePspId > 0 && a.termPspId > 0 && nonEmpty(a.day),
    // Attaches to a mandate we actually hold, in the right term.
    categorized: ctx.mandateIds.has(a.mandatePspId),
    valid:
      ctx.mandateIds.has(a.mandatePspId) &&
      ctx.organIds.has(a.termPspId) &&
      (a.fromTime === null || a.toTime === null || a.toTime >= a.fromTime) &&
      (!win || ((win.from === null || a.day >= win.from) && (win.to === null || a.day <= win.to))),
    // A timed window rather than a whole-day excuse: only a timed one can be
    // matched against a roll call's clock time, which is what the publisher's own
    // rule for turning '@' into 'M' requires.
    rich: nonEmpty(a.fromTime) && nonEmpty(a.toTime),
  };
}

/** Dump families published on the psp.cz open-data page. */
const DUMP_FAMILY = /^(poslanci|hl-\d{4}ps|tisky|interp|steno|sd|sbirka|schuze|se_tisk)\.zip$/;

export function scoreRelease(r: SourceReleaseRow): RowFlags {
  const hasArtifact = nonEmpty(r.fileName) || nonEmpty(r.contentSha256);
  return {
    complete: nonEmpty(r.recordKey) && hasArtifact && r.observedAt !== null,
    categorized: r.fileName === null ? nonEmpty(r.contentSha256) : DUMP_FAMILY.test(r.fileName),
    // The charset defect: a mirrored row carrying U+FFFD lost bytes upstream.
    valid:
      !mangled(r.description, r.pageTitle) &&
      (r.fileUrl === null || /^https?:\/\//.test(r.fileUrl)),
    rich: nonEmpty(r.description) && nonEmpty(r.fileUrl),
  };
}

/* ── slice scoring ────────────────────────────────────────────────────────── */

export interface SliceInput {
  slice: string;
  source: string;
  term: string;
  entity: string;
  flags: RowFlags[];
  /** Days since the newest successful ingest run for this slice's source. */
  syncAgeDays: number | null;
  /** Days between the newest row in the slice and the snapshot that carried it. */
  rowLagDays: number | null;
}

/** Score one slice from its per-row flags. Pure. */
export function scoreSlice(input: SliceInput): SliceQualityRow {
  const n = input.flags.length;
  const frac = (pick: (f: RowFlags) => boolean) => (n ? input.flags.filter(pick).length / n : 0);

  const completeness = fracScore(frac((f) => f.complete));
  const freshness = round1(mean([syncAgeScore(input.syncAgeDays), lagScore(input.rowLagDays)]));
  const categorization = fracScore(frac((f) => f.categorized));
  const validity = fracScore(frac((f) => f.valid));
  const richness = fracScore(frac((f) => f.rich));
  const volume = volumeScore(n);
  const composite = round1(mean([completeness, freshness, categorization, validity, richness, volume]));

  return {
    slice: input.slice,
    source: input.source,
    term: input.term,
    entity: input.entity,
    scores: { completeness, freshness, categorization, validity, richness, volume },
    composite,
    rowsTotal: n,
    rowsValid: input.flags.filter((f) => f.valid).length,
    taxonomyVersion: QUALITY_TAXONOMY_VERSION,
    analyzedAt: new Date().toISOString(),
  };
}

/** Days between two ISO instants, or null when either is missing. */
export function daysBetween(later: string | null, earlier: string | null): number | null {
  if (!later || !earlier) return null;
  const a = Date.parse(later);
  const b = Date.parse(earlier);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((a - b) / 86_400_000));
}

/** Newest successful ingest run per source. */
export function latestRunBySource(runs: IngestRunRow[]): Map<string, IngestRunRow> {
  const out = new Map<string, IngestRunRow>();
  for (const r of runs) {
    if (r.status !== "ok") continue;
    const prev = out.get(r.source);
    if (!prev || r.startedAt > prev.startedAt) out.set(r.source, r);
  }
  return out;
}
