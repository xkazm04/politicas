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
