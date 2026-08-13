// Row types for the civic entity graph. These are the persistence-boundary
// shapes: what a Store hands back, independent of driver.
//
// Every entity row carries the same four provenance columns —
//   source        which adapter wrote it (psp-poslanci | psp-hlasovani | pumper-psp-opendata)
//   sourceUrl     the exact URL the bytes came from
//   fetchedAt     when those bytes were fetched (ISO-8601)
//   raw           the source payload the typed columns were derived from
// — plus a stable natural key in `id` of the form `<publisher>:<table>:<natural id>`.
// The brand rule ("every rendered number cites its source") is only enforceable
// if provenance travels with the row, so it is not optional.

export interface Provenance {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  ingestRunId: number | null;
}

export interface PersonRow extends Provenance {
  id: string;
  pspId: number;
  titleBefore: string | null;
  firstName: string | null;
  lastName: string | null;
  titleAfter: string | null;
  nameFull: string;
  nameNorm: string;
  birthDate: string | null;
  birthDateUnknown: boolean;
  gender: string | null;
  diedAt: string | null;
  changedAt: string | null;
  raw: Record<string, unknown>;
}

export interface OrganRow extends Provenance {
  id: string;
  pspId: number;
  parentPspId: number | null;
  organTypeId: number | null;
  organTypeCz: string | null;
  abbrev: string | null;
  nameCz: string | null;
  nameEn: string | null;
  nameNorm: string;
  validFrom: string | null;
  validTo: string | null;
  raw: Record<string, unknown>;
}

export interface MandateRow extends Provenance {
  id: string;
  pspId: number;
  personPspId: number;
  termPspId: number;
  termCode: string;
  regionPspId: number | null;
  partyListPspId: number | null;
  web: string | null;
  email: string | null;
  phone: string | null;
  pspPhone: string | null;
  facebook: string | null;
  hasPhoto: boolean;
  raw: Record<string, unknown>;
}

export interface MembershipRow extends Provenance {
  id: string;
  personPspId: number;
  kind: "member" | "function";
  targetPspId: number;
  organPspId: number | null;
  functionNameCz: string | null;
  functionTypeCz: string | null;
  fromAt: string | null;
  toAt: string | null;
  mandateFrom: string | null;
  mandateTo: string | null;
  raw: Record<string, unknown>;
}

export interface VoteEventRow extends Provenance {
  id: string;
  pspId: number;
  termPspId: number;
  termCode: string;
  sessionNo: number | null;
  voteNo: number | null;
  agendaItem: number | null;
  votedAt: string | null;
  votedOn: string | null;
  yes: number | null;
  no: number | null;
  abstain: number | null;
  notVoting: number | null;
  present: number | null;
  quorum: number | null;
  kind: string;
  outcome: string;
  titleLong: string | null;
  titleShort: string | null;
  titleNorm: string;
  voided: boolean;
  raw: Record<string, unknown>;
}

/**
 * One MP's ballot in one roll call. `raw` is deliberately ABSENT on this table:
 * the source UNL row is exactly (id_poslanec, id_hlasovani, vysledek) and all
 * three are stored as typed columns, so a JSONB copy would duplicate 100% of the
 * payload across the largest table in the corpus for zero recoverable
 * information. Provenance still travels via source/sourceUrl/fetchedAt/runId.
 */
export interface VoteBallotRow extends Provenance {
  id: string;
  votePspId: number;
  mandatePspId: number;
  code: string;
  choice: string;
}

export interface AbsenceRow extends Provenance {
  id: string;
  termPspId: number;
  mandatePspId: number;
  day: string;
  fromTime: string | null;
  toTime: string | null;
  wholeDay: boolean;
  raw: Record<string, unknown>;
}

/**
 * A release/manifest observation mirrored out of Pumper. This is the ONLY table
 * fed by the scraping backbone rather than by a direct bulk download, and it is
 * what makes "is our psp.cz snapshot stale?" answerable from the corpus itself.
 */
export interface SourceReleaseRow extends Provenance {
  id: string;
  pumperApp: string;
  pumperDataset: string;
  recordKey: string;
  fileName: string | null;
  fileUrl: string | null;
  description: string | null;
  pageTitle: string | null;
  contentSha256: string | null;
  observedChars: number | null;
  observedAt: string | null;
  raw: Record<string, unknown>;
}

export interface IngestRunRow {
  id: number;
  source: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "ok" | "failed";
  sourceUrl: string | null;
  sourceLastModified: string | null;
  rowsWritten: number;
  note: string | null;
}

/**
 * A derived knowledge-graph node (tier 2 of the self-expanding KG loop — see
 * docs/knowledge-graph-loop.md §3). Like `slice_quality`, this is DERIVED
 * metadata: never a source-of-truth for a raw entity, always recomputable, and
 * never clobbered by a corpus re-sync. `id` is a urn — a raw one (`psp:person:6790`,
 * `psp:organ:174`) or a derived one (`bloc:eu-sceptics`, `theme:defense`).
 */
export interface KgNodeRow {
  id: string;
  /** person | party | organ | bloc | theme | company | contract (extensible). */
  kind: string;
  label: string;
  /** Derived attributes (rebellion_rate, cohesion, committee_count, …). */
  props: Record<string, unknown>;
  /** Which pass created the node — the loop's self-awareness surface. */
  firstSeenPass: number;
  /** How it was derived: {pass, method:"deterministic"|"verdict", ref, computedAt}. */
  provenance: Record<string, unknown>;
}

/**
 * A derived, provenanced, recomputable edge between two `kg_node`s. Composite
 * primary key (src, rel, dst) — an upsert on the same triple replaces the weight
 * in place rather than duplicating the relationship.
 */
export interface KgEdgeRow {
  src: string;
  /** co_votes_with | rebels_against | belongs_to | about | influential_in | linked_to | supplies. */
  rel: string;
  dst: string;
  /** agreement rate, rebellion rate, centrality, amount… (nullable for pure links). */
  weight: number | null;
  props: Record<string, unknown>;
  /** {pass, method:"deterministic"|"verdict", ref, computedAt} — required, never unbacked. */
  provenance: Record<string, unknown>;
}

/**
 * One append-only audit row for a human review decision on a `linked_to` tie
 * (Case ① FollowTheMoney verification console). Written by
 * `ReviewRepository.setTieReviewState` BEFORE the corresponding `kg_edge.props`
 * update — `priorState` is always the edge's `review_state` immediately before
 * this decision, so the trail can reconstruct every flip.
 */
export interface ReviewAuditRow {
  id: string;
  src: string;
  rel: string;
  dst: string;
  decision: "confirm" | "reject" | "needs-more";
  reviewer: string;
  note: string | null;
  decidedAt: string;
  /** `review_state` the edge carried immediately before this decision (null if unset). */
  priorState: string | null;
  /**
   * The row's place in the tamper-evident append-only chain, and the two hashes
   * that bind it there (`lib/db/pglite/ledger.ts`: `verifyAuditChain` walks
   * chainPos ascending, checking prevHash linkage and recomputing rowHash).
   *
   * OPTIONAL BY DESIGN (2026-08-13): the columns exist since the chain was
   * added and the SELECT already returned them, but rows written before it
   * carry NULL in all three — a required field would force every reader to
   * invent a position for them. A surface that publishes these must therefore
   * be able to say „this row is not chained" rather than print a zero.
   * Additive: every existing consumer (/admin, /zdroj, /denik, the review
   * console) keeps compiling and rendering unchanged.
   */
  chainPos?: number | null;
  prevHash?: string | null;
  rowHash?: string | null;
}

/** The six universal criteria, scored 1–5, plus their mean. */
export interface SliceQualityRow {
  slice: string;
  source: string;
  term: string;
  entity: string;
  scores: {
    completeness: number;
    freshness: number;
    categorization: number;
    validity: number;
    richness: number;
    volume: number;
  };
  composite: number;
  rowsTotal: number;
  rowsValid: number;
  taxonomyVersion: string;
  analyzedAt: string;
}

/**
 * A derived THEME tag on one roll call (the Silver-layer output of the hybrid
 * `sem_filter`/`sem_classify` enrichment — see docs/hybrid-benchmark-plan.md).
 * DERIVED, recomputable metadata like slice_quality / kg_node: never a
 * source-of-truth for the vote itself, always re-materialisable, and stamped with
 * the model + method that produced it so a rendered tag can cite how it was made.
 */
export interface VoteTagRow {
  id: string; // `vote_tag:<votePspId>`
  votePspId: number;
  /** Canonical theme slug from the fixed taxonomy (e.g. `budget-finance`). */
  theme: string;
  /** The classifier's self-reported confidence, 0–1 (nullable). */
  confidence: number | null;
  /** Which model produced it, e.g. `haiku` — the benchmarked cheap classifier. */
  model: string;
  /** How it was derived, e.g. `sem_classify`. */
  method: string;
  taggedAt: string;
}
