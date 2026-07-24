// DB-row → typed-row mappers + the column-name arrays their upserts bind against.
// Pure functions over PGlite result rows; one pair (COLS + map) per table.

import type {
  AbsenceRow,
  KgEdgeRow,
  KgNodeRow,
  MandateRow,
  MembershipRow,
  OrganRow,
  PersonRow,
  SourceReleaseRow,
  VoteBallotRow,
  VoteEventRow,
} from "../types";
import { bool, isoDate, isoTs, json, num, numOrNull, str, strOrNull } from "./internals";

export const PERSON_COLS = [
  "id", "psp_id", "title_before", "first_name", "last_name", "title_after", "name_full",
  "name_norm", "birth_date", "birth_date_unknown", "gender", "died_at", "changed_at",
  "source", "source_url", "fetched_at", "ingest_run_id", "raw",
];
export const ORGAN_COLS = [
  "id", "psp_id", "parent_psp_id", "organ_type_id", "organ_type_cz", "abbrev", "name_cz",
  "name_en", "name_norm", "valid_from", "valid_to",
  "source", "source_url", "fetched_at", "ingest_run_id", "raw",
];
export const MANDATE_COLS = [
  "id", "psp_id", "person_psp_id", "term_psp_id", "term_code", "region_psp_id",
  "party_list_psp_id", "web", "email", "phone", "psp_phone", "facebook", "has_photo",
  "source", "source_url", "fetched_at", "ingest_run_id", "raw",
];
export const MEMBERSHIP_COLS = [
  "id", "person_psp_id", "kind", "target_psp_id", "organ_psp_id", "function_name_cz",
  "function_type_cz", "from_at", "to_at", "mandate_from", "mandate_to",
  "source", "source_url", "fetched_at", "ingest_run_id", "raw",
];
export const VOTE_EVENT_COLS = [
  "id", "psp_id", "term_psp_id", "term_code", "session_no", "vote_no", "agenda_item",
  "voted_at", "voted_on", "yes", "no", "abstain", "not_voting", "present", "quorum",
  "kind", "outcome", "title_long", "title_short", "title_norm", "voided",
  "source", "source_url", "fetched_at", "ingest_run_id", "raw",
];
export const BALLOT_COLS = [
  "id", "vote_psp_id", "mandate_psp_id", "code", "choice",
  "source", "source_url", "fetched_at", "ingest_run_id",
];
export const ABSENCE_COLS = [
  "id", "term_psp_id", "mandate_psp_id", "day", "from_time", "to_time", "whole_day",
  "source", "source_url", "fetched_at", "ingest_run_id", "raw",
];
export const RELEASE_COLS = [
  "id", "pumper_app", "pumper_dataset", "record_key", "file_name", "file_url", "description",
  "page_title", "content_sha256", "observed_chars", "observed_at",
  "source", "source_url", "fetched_at", "ingest_run_id", "raw",
];
export const KG_NODE_COLS = ["id", "kind", "label", "props", "first_seen_pass", "provenance"];
export const KG_EDGE_COLS = ["src", "rel", "dst", "weight", "props", "provenance"];
export const VOTE_TAG_COLS = ["id", "vote_psp_id", "theme", "confidence", "model", "method", "tagged_at"];

export function mapPerson(r: Record<string, unknown>): PersonRow {
  return {
    id: str(r.id),
    pspId: num(r.psp_id),
    titleBefore: strOrNull(r.title_before),
    firstName: strOrNull(r.first_name),
    lastName: strOrNull(r.last_name),
    titleAfter: strOrNull(r.title_after),
    nameFull: str(r.name_full),
    nameNorm: str(r.name_norm),
    birthDate: isoDate(r.birth_date),
    birthDateUnknown: bool(r.birth_date_unknown),
    gender: strOrNull(r.gender),
    diedAt: isoDate(r.died_at),
    changedAt: isoDate(r.changed_at),
    source: str(r.source),
    sourceUrl: str(r.source_url),
    fetchedAt: isoTs(r.fetched_at) ?? "",
    ingestRunId: numOrNull(r.ingest_run_id),
    raw: json(r.raw),
  };
}
export function mapOrgan(r: Record<string, unknown>): OrganRow {
  return {
    id: str(r.id),
    pspId: num(r.psp_id),
    parentPspId: numOrNull(r.parent_psp_id),
    organTypeId: numOrNull(r.organ_type_id),
    organTypeCz: strOrNull(r.organ_type_cz),
    abbrev: strOrNull(r.abbrev),
    nameCz: strOrNull(r.name_cz),
    nameEn: strOrNull(r.name_en),
    nameNorm: str(r.name_norm),
    validFrom: isoDate(r.valid_from),
    validTo: isoDate(r.valid_to),
    source: str(r.source),
    sourceUrl: str(r.source_url),
    fetchedAt: isoTs(r.fetched_at) ?? "",
    ingestRunId: numOrNull(r.ingest_run_id),
    raw: json(r.raw),
  };
}
export function mapMandate(r: Record<string, unknown>): MandateRow {
  return {
    id: str(r.id),
    pspId: num(r.psp_id),
    personPspId: num(r.person_psp_id),
    termPspId: num(r.term_psp_id),
    termCode: str(r.term_code),
    regionPspId: numOrNull(r.region_psp_id),
    partyListPspId: numOrNull(r.party_list_psp_id),
    web: strOrNull(r.web),
    email: strOrNull(r.email),
    phone: strOrNull(r.phone),
    pspPhone: strOrNull(r.psp_phone),
    facebook: strOrNull(r.facebook),
    hasPhoto: bool(r.has_photo),
    source: str(r.source),
    sourceUrl: str(r.source_url),
    fetchedAt: isoTs(r.fetched_at) ?? "",
    ingestRunId: numOrNull(r.ingest_run_id),
    raw: json(r.raw),
  };
}
export function mapMembership(r: Record<string, unknown>): MembershipRow {
  return {
    id: str(r.id),
    personPspId: num(r.person_psp_id),
    kind: str(r.kind) === "function" ? "function" : "member",
    targetPspId: num(r.target_psp_id),
    organPspId: numOrNull(r.organ_psp_id),
    functionNameCz: strOrNull(r.function_name_cz),
    functionTypeCz: strOrNull(r.function_type_cz),
    fromAt: isoTs(r.from_at),
    toAt: isoTs(r.to_at),
    mandateFrom: isoDate(r.mandate_from),
    mandateTo: isoDate(r.mandate_to),
    source: str(r.source),
    sourceUrl: str(r.source_url),
    fetchedAt: isoTs(r.fetched_at) ?? "",
    ingestRunId: numOrNull(r.ingest_run_id),
    raw: json(r.raw),
  };
}
export function mapVoteEvent(r: Record<string, unknown>): VoteEventRow {
  return {
    id: str(r.id),
    pspId: num(r.psp_id),
    termPspId: num(r.term_psp_id),
    termCode: str(r.term_code),
    sessionNo: numOrNull(r.session_no),
    voteNo: numOrNull(r.vote_no),
    agendaItem: numOrNull(r.agenda_item),
    votedAt: isoTs(r.voted_at),
    votedOn: isoDate(r.voted_on),
    yes: numOrNull(r.yes),
    no: numOrNull(r.no),
    abstain: numOrNull(r.abstain),
    notVoting: numOrNull(r.not_voting),
    present: numOrNull(r.present),
    quorum: numOrNull(r.quorum),
    kind: str(r.kind),
    outcome: str(r.outcome),
    titleLong: strOrNull(r.title_long),
    titleShort: strOrNull(r.title_short),
    titleNorm: str(r.title_norm),
    voided: bool(r.voided),
    source: str(r.source),
    sourceUrl: str(r.source_url),
    fetchedAt: isoTs(r.fetched_at) ?? "",
    ingestRunId: numOrNull(r.ingest_run_id),
    raw: json(r.raw),
  };
}
export function mapBallot(r: Record<string, unknown>): VoteBallotRow {
  return {
    id: str(r.id),
    votePspId: num(r.vote_psp_id),
    mandatePspId: num(r.mandate_psp_id),
    code: str(r.code),
    choice: str(r.choice),
    source: str(r.source),
    sourceUrl: str(r.source_url),
    fetchedAt: isoTs(r.fetched_at) ?? "",
    ingestRunId: numOrNull(r.ingest_run_id),
  };
}
export function mapAbsence(r: Record<string, unknown>): AbsenceRow {
  return {
    id: str(r.id),
    termPspId: num(r.term_psp_id),
    mandatePspId: num(r.mandate_psp_id),
    day: isoDate(r.day) ?? "",
    fromTime: strOrNull(r.from_time),
    toTime: strOrNull(r.to_time),
    wholeDay: bool(r.whole_day),
    source: str(r.source),
    sourceUrl: str(r.source_url),
    fetchedAt: isoTs(r.fetched_at) ?? "",
    ingestRunId: numOrNull(r.ingest_run_id),
    raw: json(r.raw),
  };
}
export function mapRelease(r: Record<string, unknown>): SourceReleaseRow {
  return {
    id: str(r.id),
    pumperApp: str(r.pumper_app),
    pumperDataset: str(r.pumper_dataset),
    recordKey: str(r.record_key),
    fileName: strOrNull(r.file_name),
    fileUrl: strOrNull(r.file_url),
    description: strOrNull(r.description),
    pageTitle: strOrNull(r.page_title),
    contentSha256: strOrNull(r.content_sha256),
    observedChars: numOrNull(r.observed_chars),
    observedAt: isoTs(r.observed_at),
    source: str(r.source),
    sourceUrl: str(r.source_url),
    fetchedAt: isoTs(r.fetched_at) ?? "",
    ingestRunId: numOrNull(r.ingest_run_id),
    raw: json(r.raw),
  };
}
export function mapKgNode(r: Record<string, unknown>): KgNodeRow {
  return {
    id: str(r.id),
    kind: str(r.kind),
    label: str(r.label),
    props: json(r.props),
    firstSeenPass: num(r.first_seen_pass),
    provenance: json(r.provenance),
  };
}
export function mapKgEdge(r: Record<string, unknown>): KgEdgeRow {
  return {
    src: str(r.src),
    rel: str(r.rel),
    dst: str(r.dst),
    weight: numOrNull(r.weight),
    props: json(r.props),
    provenance: json(r.provenance),
  };
}
