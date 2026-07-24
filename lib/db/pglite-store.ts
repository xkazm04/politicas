// Server-only. PGlite (embedded Postgres, WASM) implementation of `Store`.
//
// WHY POSTGRES SEMANTICS: politicas is an entity GRAPH. The queries that carry
// the product are recursive walks (person → club → co-voters → contracts), JSONB
// reads over heterogeneous open-data payloads kept verbatim for audit, and
// window functions over 400k roll-call ballots. SQLite would need all three
// re-implemented in application code. PGlite gives real Postgres in-process with
// zero infra, and the escape hatch to hosted Postgres is a second driver file.
//
// CAVEATS THIS FILE HANDLES:
//  1. SINGLE CONNECTION per data dir — the instance is memoised on globalThis
//     and the promise is assigned before any await, so two concurrent openers
//     cannot race. Analysis scripts read a COPY of the directory.
//  2. NO `unaccent` EXTENSION — Czech diacritics are folded in application code
//     at ingest into `*_norm` columns that carry plain btree indexes. See
//     lib/ingest/normalize.ts.
if (typeof window !== "undefined") {
  throw new Error("@/lib/db/pglite-store must not be imported on the client.");
}

import { pglitePath } from "./config";
import type { Store, ListOptions } from "./store";
import type {
  AbsenceRow,
  IngestRunRow,
  KgEdgeRow,
  KgNodeRow,
  MandateRow,
  MembershipRow,
  OrganRow,
  PersonRow,
  SliceQualityRow,
  SourceReleaseRow,
  VoteBallotRow,
  VoteEventRow,
} from "./types";

/**
 * CORE_DDL is the AUTHORITATIVE schema. `lib/db/migrations/0001_civic_graph.sql`
 * is a reference snapshot of this string for reviewers and for the eventual move
 * to hosted Postgres; nothing applies it at runtime.
 *
 * Shared conventions:
 *  • `id` is a stable NATURAL key `<publisher>:<table>:<source id>` — re-running
 *    an ingest over a refreshed dump updates rows in place instead of duplicating.
 *  • provenance quartet on every table: source, source_url, fetched_at, ingest_run_id.
 *  • `raw jsonb` keeps the source row verbatim (see types.ts for the one
 *    documented exception, vote_ballot).
 *  • `*_norm` columns hold ASCII-folded text; index those, never fold at query time.
 */
const CORE_DDL = `
create table if not exists ingest_run (
  id                   bigserial primary key,
  source               text not null,
  started_at           timestamptz not null default now(),
  finished_at          timestamptz,
  status               text not null default 'running',
  source_url           text,
  source_last_modified text,
  rows_written         integer not null default 0,
  note                 text
);
create index if not exists ingest_run_source_idx on ingest_run(source, started_at desc);

-- ── person registry (psp.cz osoby.unl) ──────────────────────────────────────
create table if not exists person (
  id                 text primary key,
  psp_id             integer not null unique,
  title_before       text,
  first_name         text,
  last_name          text,
  title_after        text,
  name_full          text not null,
  name_norm          text not null,
  birth_date         date,
  birth_date_unknown boolean not null default false,
  gender             text,
  died_at            date,
  changed_at         date,
  source             text not null,
  source_url         text not null,
  fetched_at         timestamptz not null,
  ingest_run_id      bigint,
  raw                jsonb not null default '{}'::jsonb
);
create index if not exists person_name_norm_idx on person(name_norm);

-- ── organ registry: chamber, parliamentary club, committee, region, party list ─
create table if not exists organ (
  id             text primary key,
  psp_id         integer not null unique,
  parent_psp_id  integer,
  organ_type_id  integer,
  organ_type_cz  text,
  abbrev         text,
  name_cz        text,
  name_en        text,
  name_norm      text not null,
  valid_from     date,
  valid_to       date,
  source         text not null,
  source_url     text not null,
  fetched_at     timestamptz not null,
  ingest_run_id  bigint,
  raw            jsonb not null default '{}'::jsonb
);
create index if not exists organ_parent_idx on organ(parent_psp_id);
create index if not exists organ_name_norm_idx on organ(name_norm);

-- ── mandate: one MP's seat in one electoral term ────────────────────────────
create table if not exists mandate (
  id                  text primary key,
  psp_id              integer not null unique,
  person_psp_id       integer not null,
  term_psp_id         integer not null,
  term_code           text not null,
  region_psp_id       integer,
  party_list_psp_id   integer,
  web                 text,
  email               text,
  phone               text,
  psp_phone           text,
  facebook            text,
  has_photo           boolean not null default false,
  source              text not null,
  source_url          text not null,
  fetched_at          timestamptz not null,
  ingest_run_id       bigint,
  raw                 jsonb not null default '{}'::jsonb
);
create index if not exists mandate_term_idx on mandate(term_code);
create index if not exists mandate_person_idx on mandate(person_psp_id);

-- ── membership: person ↔ organ (or ↔ function in an organ), time-bounded ────
create table if not exists membership (
  id                text primary key,
  person_psp_id     integer not null,
  kind              text not null,
  target_psp_id     integer not null,
  organ_psp_id      integer,
  function_name_cz  text,
  function_type_cz  text,
  from_at           timestamptz,
  to_at             timestamptz,
  mandate_from      date,
  mandate_to        date,
  source            text not null,
  source_url        text not null,
  fetched_at        timestamptz not null,
  ingest_run_id     bigint,
  raw               jsonb not null default '{}'::jsonb
);
create index if not exists membership_person_idx on membership(person_psp_id);
create index if not exists membership_organ_idx on membership(organ_psp_id);

-- ── roll call ───────────────────────────────────────────────────────────────
create table if not exists vote_event (
  id            text primary key,
  psp_id        integer not null unique,
  term_psp_id   integer not null,
  term_code     text not null,
  session_no    integer,
  vote_no       integer,
  agenda_item   integer,
  voted_at      timestamptz,
  voted_on      date,
  yes           integer,
  no            integer,
  abstain       integer,
  not_voting    integer,
  present       integer,
  quorum        integer,
  kind          text not null,
  outcome       text not null,
  title_long    text,
  title_short   text,
  title_norm    text not null,
  voided        boolean not null default false,
  source        text not null,
  source_url    text not null,
  fetched_at    timestamptz not null,
  ingest_run_id bigint,
  raw           jsonb not null default '{}'::jsonb
);
create index if not exists vote_event_term_idx on vote_event(term_code, voted_on);
create index if not exists vote_event_title_norm_idx on vote_event(title_norm);

-- ── ballot: one MP × one roll call (the corpus hot table) ───────────────────
create table if not exists vote_ballot (
  id              text primary key,
  vote_psp_id     integer not null,
  mandate_psp_id  integer not null,
  code            text not null,
  choice          text not null,
  source          text not null,
  source_url      text not null,
  fetched_at      timestamptz not null,
  ingest_run_id   bigint
);
create index if not exists vote_ballot_vote_idx on vote_ballot(vote_psp_id);
create index if not exists vote_ballot_mandate_idx on vote_ballot(mandate_psp_id);

-- ── excused absence (omluvy) ────────────────────────────────────────────────
create table if not exists absence (
  id              text primary key,
  term_psp_id     integer not null,
  mandate_psp_id  integer not null,
  day             date not null,
  from_time       text,
  to_time         text,
  whole_day       boolean not null default false,
  source          text not null,
  source_url      text not null,
  fetched_at      timestamptz not null,
  ingest_run_id   bigint,
  raw             jsonb not null default '{}'::jsonb
);
create index if not exists absence_mandate_idx on absence(mandate_psp_id, day);

-- ── source release manifest, mirrored from the Pumper scraping backbone ─────
create table if not exists source_release (
  id              text primary key,
  pumper_app      text not null,
  pumper_dataset  text not null,
  record_key      text not null,
  file_name       text,
  file_url        text,
  description     text,
  page_title      text,
  content_sha256  text,
  observed_chars  integer,
  observed_at     timestamptz,
  source          text not null,
  source_url      text not null,
  fetched_at      timestamptz not null,
  ingest_run_id   bigint,
  raw             jsonb not null default '{}'::jsonb
);

-- ── deterministic quality snapshot per analysis slice ───────────────────────
create table if not exists slice_quality (
  slice            text primary key,
  source           text not null,
  term             text not null,
  entity           text not null,
  completeness     numeric not null,
  freshness        numeric not null,
  categorization   numeric not null,
  validity         numeric not null,
  richness         numeric not null,
  volume           numeric not null,
  composite        numeric not null,
  rows_total       integer not null,
  rows_valid       integer not null,
  taxonomy_version text not null,
  analyzed_at      timestamptz not null
);

-- ── derived knowledge graph (tier 2 of the self-expanding KG loop, §3) ───────
-- Typed nodes + typed, weighted, provenanced edges. DERIVED metadata like
-- slice_quality: recomputable from raw ballots/memberships, never source-of-truth.
create table if not exists kg_node (
  id               text primary key,
  kind             text not null,
  label            text not null,
  props            jsonb not null default '{}'::jsonb,
  first_seen_pass  integer,
  provenance       jsonb not null default '{}'::jsonb
);
create index if not exists kg_node_kind_idx on kg_node(kind);

create table if not exists kg_edge (
  src         text not null,
  rel         text not null,
  dst         text not null,
  weight      real,
  props       jsonb not null default '{}'::jsonb,
  provenance  jsonb not null default '{}'::jsonb,
  primary key (src, rel, dst)
);
create index if not exists kg_edge_src_idx on kg_edge(src);
create index if not exists kg_edge_dst_idx on kg_edge(dst);
create index if not exists kg_edge_rel_idx on kg_edge(rel);
`;

interface PgResult<T> {
  rows: T[];
}
interface Pglite {
  waitReady: Promise<void>;
  exec(sql: string): Promise<unknown>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PgResult<T>>;
  close(): Promise<void>;
}

const PGLITE_KEY = "__politicas_pglite__" as const;
type GlobalWithPglite = typeof globalThis & { [PGLITE_KEY]?: Promise<Pglite> };

async function open(): Promise<Pglite> {
  const g = globalThis as GlobalWithPglite;
  // Synchronous check-then-assign (no await before the store) so concurrent
  // first callers cannot both create an instance over the same data dir.
  if (!g[PGLITE_KEY]) {
    g[PGLITE_KEY] = (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const pg = new PGlite(pglitePath()) as unknown as Pglite;
      await pg.waitReady;
      await pg.exec(CORE_DDL);
      return pg;
    })();
  }
  return g[PGLITE_KEY]!;
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined ? null : typeof v === "string" ? v : String(v);
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const num = (v: unknown): number => numOrNull(v) ?? 0;
const bool = (v: unknown): boolean => v === true || v === "t" || v === "true" || v === 1;
/** Dates come back as JS Date (or string) — normalize to a bare ISO date/instant. */
const isoDate = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
};
const isoTs = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
};
const json = (v: unknown): Record<string, unknown> => {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      const parsed: unknown = JSON.parse(v);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
};

/**
 * Chunked multi-row upsert.
 *
 * CHUNK SIZE IS DELIBERATELY SMALL (≤500 rows / ≤30k bind params per statement).
 * Postgres' hard limit is 65535 params, but PGlite (the WASM build) does NOT
 * safely handle statements near that ceiling once the process has already
 * written a lot: feeding the 406k-ballot table in ~6600-row INSERTs left the
 * engine returning INCONSISTENT results afterwards — `select count(*)` reported
 * the right number while an ordered `select … limit` from the same table
 * returned zero rows, and a later small UPDATE to ingest_run silently failed to
 * persist to the data directory. Reproduced deterministically (2026-07-23) and
 * fixed by capping statement width; at ≤500 rows the same ingest is fully
 * durable and consistent. See docs/data-analysis/onboarding.md.
 *
 * Rows are de-duplicated on `id` first (last occurrence wins). This is NOT
 * defensive padding: Postgres rejects an `ON CONFLICT DO UPDATE` statement that
 * would touch the same row twice ("cannot affect row a second time"), and the
 * psp.cz snapshots genuinely contain exact duplicate rows (55 in the PSP10
 * `omluvy` table alone — the publisher's export has no unique constraint). The
 * duplicate count is surfaced by the adapters so it can be SCORED rather than
 * quietly swallowed here.
 */
async function upsertMany<T extends { id: string }>(
  pg: Pglite,
  table: string,
  columns: string[],
  rows: T[],
  toValues: (row: T) => unknown[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const byId = new Map<string, T>();
  for (const r of rows) byId.set(r.id, r);
  const deduped = [...byId.values()];
  const perRow = columns.length;
  const chunkSize = Math.max(1, Math.min(500, Math.floor(30000 / perRow)));
  const updates = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  let written = 0;
  for (let i = 0; i < deduped.length; i += chunkSize) {
    const chunk = deduped.slice(i, i + chunkSize);
    const params: unknown[] = [];
    const tuples = chunk.map((row) => {
      const vals = toValues(row);
      const placeholders = vals.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      return `(${placeholders.join(",")})`;
    });
    await pg.query(
      `insert into ${table} (${columns.join(",")}) values ${tuples.join(",")}
       on conflict (id) do update set ${updates}`,
      params,
    );
    written += chunk.length;
  }
  return written;
}

const limitOf = (opts?: ListOptions) => Math.max(1, Math.min(2_000_000, opts?.limit ?? 1_000_000));

/* ── driver ──────────────────────────────────────────────────────────────── */

const PERSON_COLS = [
  "id", "psp_id", "title_before", "first_name", "last_name", "title_after", "name_full",
  "name_norm", "birth_date", "birth_date_unknown", "gender", "died_at", "changed_at",
  "source", "source_url", "fetched_at", "ingest_run_id", "raw",
];
const ORGAN_COLS = [
  "id", "psp_id", "parent_psp_id", "organ_type_id", "organ_type_cz", "abbrev", "name_cz",
  "name_en", "name_norm", "valid_from", "valid_to",
  "source", "source_url", "fetched_at", "ingest_run_id", "raw",
];
const MANDATE_COLS = [
  "id", "psp_id", "person_psp_id", "term_psp_id", "term_code", "region_psp_id",
  "party_list_psp_id", "web", "email", "phone", "psp_phone", "facebook", "has_photo",
  "source", "source_url", "fetched_at", "ingest_run_id", "raw",
];
const MEMBERSHIP_COLS = [
  "id", "person_psp_id", "kind", "target_psp_id", "organ_psp_id", "function_name_cz",
  "function_type_cz", "from_at", "to_at", "mandate_from", "mandate_to",
  "source", "source_url", "fetched_at", "ingest_run_id", "raw",
];
const VOTE_EVENT_COLS = [
  "id", "psp_id", "term_psp_id", "term_code", "session_no", "vote_no", "agenda_item",
  "voted_at", "voted_on", "yes", "no", "abstain", "not_voting", "present", "quorum",
  "kind", "outcome", "title_long", "title_short", "title_norm", "voided",
  "source", "source_url", "fetched_at", "ingest_run_id", "raw",
];
const BALLOT_COLS = [
  "id", "vote_psp_id", "mandate_psp_id", "code", "choice",
  "source", "source_url", "fetched_at", "ingest_run_id",
];
const ABSENCE_COLS = [
  "id", "term_psp_id", "mandate_psp_id", "day", "from_time", "to_time", "whole_day",
  "source", "source_url", "fetched_at", "ingest_run_id", "raw",
];
const RELEASE_COLS = [
  "id", "pumper_app", "pumper_dataset", "record_key", "file_name", "file_url", "description",
  "page_title", "content_sha256", "observed_chars", "observed_at",
  "source", "source_url", "fetched_at", "ingest_run_id", "raw",
];
const KG_NODE_COLS = ["id", "kind", "label", "props", "first_seen_pass", "provenance"];
const KG_EDGE_COLS = ["src", "rel", "dst", "weight", "props", "provenance"];

function mapPerson(r: Record<string, unknown>): PersonRow {
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
function mapOrgan(r: Record<string, unknown>): OrganRow {
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
function mapMandate(r: Record<string, unknown>): MandateRow {
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
function mapMembership(r: Record<string, unknown>): MembershipRow {
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
function mapVoteEvent(r: Record<string, unknown>): VoteEventRow {
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
function mapBallot(r: Record<string, unknown>): VoteBallotRow {
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
function mapAbsence(r: Record<string, unknown>): AbsenceRow {
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
function mapRelease(r: Record<string, unknown>): SourceReleaseRow {
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

function mapKgNode(r: Record<string, unknown>): KgNodeRow {
  return {
    id: str(r.id),
    kind: str(r.kind),
    label: str(r.label),
    props: json(r.props),
    firstSeenPass: num(r.first_seen_pass),
    provenance: json(r.provenance),
  };
}
function mapKgEdge(r: Record<string, unknown>): KgEdgeRow {
  return {
    src: str(r.src),
    rel: str(r.rel),
    dst: str(r.dst),
    weight: numOrNull(r.weight),
    props: json(r.props),
    provenance: json(r.provenance),
  };
}

export async function getPgliteStore(): Promise<Store> {
  const pg = await open();

  const termJoinBallots = (termCode?: string) =>
    termCode
      ? {
          sql: ` join vote_event ve on ve.psp_id = vote_ballot.vote_psp_id and ve.term_code = $1`,
          params: [termCode] as unknown[],
        }
      : { sql: "", params: [] as unknown[] };

  return {
    async close() {
      const g = globalThis as GlobalWithPglite;
      delete g[PGLITE_KEY];
      await pg.close();
    },

    /* ── graph ───────────────────────────────────────────────────────────── */
    upsertPersons: (rows) =>
      upsertMany(pg, "person", PERSON_COLS, rows, (r: PersonRow) => [
        r.id, r.pspId, r.titleBefore, r.firstName, r.lastName, r.titleAfter, r.nameFull,
        r.nameNorm, r.birthDate, r.birthDateUnknown, r.gender, r.diedAt, r.changedAt,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId, JSON.stringify(r.raw),
      ]),
    upsertOrgans: (rows) =>
      upsertMany(pg, "organ", ORGAN_COLS, rows, (r: OrganRow) => [
        r.id, r.pspId, r.parentPspId, r.organTypeId, r.organTypeCz, r.abbrev, r.nameCz,
        r.nameEn, r.nameNorm, r.validFrom, r.validTo,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId, JSON.stringify(r.raw),
      ]),
    upsertMandates: (rows) =>
      upsertMany(pg, "mandate", MANDATE_COLS, rows, (r: MandateRow) => [
        r.id, r.pspId, r.personPspId, r.termPspId, r.termCode, r.regionPspId,
        r.partyListPspId, r.web, r.email, r.phone, r.pspPhone, r.facebook, r.hasPhoto,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId, JSON.stringify(r.raw),
      ]),
    upsertMemberships: (rows) =>
      upsertMany(pg, "membership", MEMBERSHIP_COLS, rows, (r: MembershipRow) => [
        r.id, r.personPspId, r.kind, r.targetPspId, r.organPspId, r.functionNameCz,
        r.functionTypeCz, r.fromAt, r.toAt, r.mandateFrom, r.mandateTo,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId, JSON.stringify(r.raw),
      ]),

    async listPersons(opts) {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from person order by psp_id limit ${limitOf(opts)}`,
      );
      return rows.map(mapPerson);
    },
    async listOrgans(opts) {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from organ order by psp_id limit ${limitOf(opts)}`,
      );
      return rows.map(mapOrgan);
    },
    async listMandates(opts) {
      const where = opts?.termCode ? `where term_code = $1` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from mandate ${where} order by psp_id limit ${limitOf(opts)}`,
        opts?.termCode ? [opts.termCode] : [],
      );
      return rows.map(mapMandate);
    },
    async listMemberships(opts) {
      // Term scoping for memberships goes through the organ tree: an organ
      // either IS the term chamber or has it as parent.
      const where = opts?.termCode
        ? `where m.organ_psp_id in (
             select o.psp_id from organ o
             where o.abbrev = $1 or o.parent_psp_id = (select psp_id from organ where abbrev = $1)
           )`
        : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select m.* from membership m ${where} order by m.id limit ${limitOf(opts)}`,
        opts?.termCode ? [opts.termCode] : [],
      );
      return rows.map(mapMembership);
    },

    async clubByMandate(termCode) {
      const { rows } = await pg.query<Record<string, unknown>>(
        `with term as (select psp_id from organ where abbrev = $1),
              club as (
                select o.psp_id, o.abbrev
                from organ o, term t
                where o.parent_psp_id = t.psp_id and o.organ_type_cz = 'Klub'
              )
         select mn.psp_id as mandate_psp_id, club.abbrev
           from mandate mn
           join term t on mn.term_psp_id = t.psp_id
           join membership ms on ms.person_psp_id = mn.person_psp_id and ms.kind = 'member'
           join club on club.psp_id = ms.organ_psp_id`,
        [termCode],
      );
      const out = new Map<number, string>();
      for (const r of rows) out.set(num(r.mandate_psp_id), str(r.abbrev));
      return out;
    },

    /* ── votes ───────────────────────────────────────────────────────────── */
    upsertVoteEvents: (rows) =>
      upsertMany(pg, "vote_event", VOTE_EVENT_COLS, rows, (r: VoteEventRow) => [
        r.id, r.pspId, r.termPspId, r.termCode, r.sessionNo, r.voteNo, r.agendaItem,
        r.votedAt, r.votedOn, r.yes, r.no, r.abstain, r.notVoting, r.present, r.quorum,
        r.kind, r.outcome, r.titleLong, r.titleShort, r.titleNorm, r.voided,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId, JSON.stringify(r.raw),
      ]),
    upsertVoteBallots: (rows) =>
      upsertMany(pg, "vote_ballot", BALLOT_COLS, rows, (r: VoteBallotRow) => [
        r.id, r.votePspId, r.mandatePspId, r.code, r.choice,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId,
      ]),
    upsertAbsences: (rows) =>
      upsertMany(pg, "absence", ABSENCE_COLS, rows, (r: AbsenceRow) => [
        r.id, r.termPspId, r.mandatePspId, r.day, r.fromTime, r.toTime, r.wholeDay,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId, JSON.stringify(r.raw),
      ]),

    async listVoteEvents(opts) {
      const where = opts?.termCode ? `where term_code = $1` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from vote_event ${where} order by psp_id limit ${limitOf(opts)}`,
        opts?.termCode ? [opts.termCode] : [],
      );
      return rows.map(mapVoteEvent);
    },
    async listVoteBallots(opts) {
      const j = termJoinBallots(opts?.termCode);
      const { rows } = await pg.query<Record<string, unknown>>(
        `select vote_ballot.* from vote_ballot${j.sql}
          order by vote_ballot.vote_psp_id, vote_ballot.mandate_psp_id
          limit ${limitOf(opts)}`,
        j.params,
      );
      return rows.map(mapBallot);
    },
    async listAbsences(opts) {
      const where = opts?.termCode
        ? `where term_psp_id = (select psp_id from organ where abbrev = $1)`
        : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from absence ${where} order by id limit ${limitOf(opts)}`,
        opts?.termCode ? [opts.termCode] : [],
      );
      return rows.map(mapAbsence);
    },
    async countVoteBallots(termCode) {
      const j = termJoinBallots(termCode);
      const { rows } = await pg.query<{ n: string | number }>(
        `select count(*)::int as n from vote_ballot${j.sql}`,
        j.params,
      );
      return num(rows[0]?.n);
    },
    async ballotTallies(termCode) {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select b.mandate_psp_id, b.choice, count(*)::int as n
           from vote_ballot b
           join vote_event ve on ve.psp_id = b.vote_psp_id
          where ve.term_code = $1
          group by b.mandate_psp_id, b.choice`,
        [termCode],
      );
      const out = new Map<number, Record<string, number>>();
      for (const r of rows) {
        const id = num(r.mandate_psp_id);
        const bucket = out.get(id) ?? {};
        bucket[str(r.choice)] = num(r.n);
        out.set(id, bucket);
      }
      return out;
    },

    /* ── provenance ──────────────────────────────────────────────────────── */
    async startIngestRun(input) {
      const { rows } = await pg.query<{ id: number }>(
        `insert into ingest_run (source, source_url, source_last_modified, note)
         values ($1,$2,$3,$4) returning id`,
        [input.source, input.sourceUrl, input.sourceLastModified, input.note ?? null],
      );
      return num(rows[0]?.id);
    },
    async finishIngestRun(id, status, rowsWritten, note) {
      await pg.query(
        `update ingest_run
            set status = $2, rows_written = $3, finished_at = now(),
                note = coalesce($4, note)
          where id = $1`,
        [id, status, rowsWritten, note ?? null],
      );
    },
    async listIngestRuns(limit = 200) {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from ingest_run order by started_at desc limit ${Math.max(1, Math.min(1000, limit))}`,
      );
      return rows.map((r) => ({
        id: num(r.id),
        source: str(r.source),
        startedAt: isoTs(r.started_at) ?? "",
        finishedAt: isoTs(r.finished_at),
        status: (str(r.status) as IngestRunRow["status"]) || "running",
        sourceUrl: strOrNull(r.source_url),
        sourceLastModified: strOrNull(r.source_last_modified),
        rowsWritten: num(r.rows_written),
        note: strOrNull(r.note),
      }));
    },
    upsertSourceReleases: (rows) =>
      upsertMany(pg, "source_release", RELEASE_COLS, rows, (r: SourceReleaseRow) => [
        r.id, r.pumperApp, r.pumperDataset, r.recordKey, r.fileName, r.fileUrl, r.description,
        r.pageTitle, r.contentSha256, r.observedChars, r.observedAt,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId, JSON.stringify(r.raw),
      ]),
    async listSourceReleases() {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from source_release order by id`,
      );
      return rows.map(mapRelease);
    },

    /* ── analysis ────────────────────────────────────────────────────────── */
    async upsertSliceQuality(row) {
      await pg.query(
        `insert into slice_quality
           (slice, source, term, entity, completeness, freshness, categorization,
            validity, richness, volume, composite, rows_total, rows_valid,
            taxonomy_version, analyzed_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         on conflict (slice) do update set
           source = excluded.source, term = excluded.term, entity = excluded.entity,
           completeness = excluded.completeness, freshness = excluded.freshness,
           categorization = excluded.categorization, validity = excluded.validity,
           richness = excluded.richness, volume = excluded.volume,
           composite = excluded.composite, rows_total = excluded.rows_total,
           rows_valid = excluded.rows_valid, taxonomy_version = excluded.taxonomy_version,
           analyzed_at = excluded.analyzed_at`,
        [
          row.slice, row.source, row.term, row.entity,
          row.scores.completeness, row.scores.freshness, row.scores.categorization,
          row.scores.validity, row.scores.richness, row.scores.volume,
          row.composite, row.rowsTotal, row.rowsValid, row.taxonomyVersion, row.analyzedAt,
        ],
      );
    },
    async listSliceQuality() {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from slice_quality order by composite asc, slice asc`,
      );
      return rows.map((r): SliceQualityRow => ({
        slice: str(r.slice),
        source: str(r.source),
        term: str(r.term),
        entity: str(r.entity),
        scores: {
          completeness: num(r.completeness),
          freshness: num(r.freshness),
          categorization: num(r.categorization),
          validity: num(r.validity),
          richness: num(r.richness),
          volume: num(r.volume),
        },
        composite: num(r.composite),
        rowsTotal: num(r.rows_total),
        rowsValid: num(r.rows_valid),
        taxonomyVersion: str(r.taxonomy_version),
        analyzedAt: isoTs(r.analyzed_at) ?? "",
      }));
    },
    async clearAllAnalysis() {
      await pg.query(`delete from slice_quality`);
    },

    /* ── knowledge graph ─────────────────────────────────────────────────── */
    upsertKgNodes: (rows) =>
      upsertMany(pg, "kg_node", KG_NODE_COLS, rows, (r: KgNodeRow) => [
        r.id, r.kind, r.label, JSON.stringify(r.props), r.firstSeenPass, JSON.stringify(r.provenance),
      ]),

    // kg_edge has a COMPOSITE primary key (src, rel, dst), so it can't use the
    // id-keyed upsertMany. Same chunk-width + dedupe discipline, keyed on the triple.
    async upsertKgEdges(rows) {
      if (rows.length === 0) return 0;
      const byKey = new Map<string, KgEdgeRow>();
      for (const r of rows) byKey.set(`${r.src} ${r.rel} ${r.dst}`, r);
      const deduped = [...byKey.values()];
      const chunkSize = Math.max(1, Math.min(500, Math.floor(30000 / KG_EDGE_COLS.length)));
      const updates = ["weight", "props", "provenance"].map((c) => `${c} = excluded.${c}`).join(", ");
      let written = 0;
      for (let i = 0; i < deduped.length; i += chunkSize) {
        const chunk = deduped.slice(i, i + chunkSize);
        const params: unknown[] = [];
        const tuples = chunk.map((r) => {
          const vals = [r.src, r.rel, r.dst, r.weight, JSON.stringify(r.props), JSON.stringify(r.provenance)];
          const placeholders = vals.map((v) => {
            params.push(v);
            return `$${params.length}`;
          });
          return `(${placeholders.join(",")})`;
        });
        await pg.query(
          `insert into kg_edge (${KG_EDGE_COLS.join(",")}) values ${tuples.join(",")}
           on conflict (src, rel, dst) do update set ${updates}`,
          params,
        );
        written += chunk.length;
      }
      return written;
    },

    async listKgNodes(opts) {
      const lim = Math.max(1, Math.min(2_000_000, opts?.limit ?? 1_000_000));
      const where = opts?.kind ? `where kind = $1` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from kg_node ${where} order by id limit ${lim}`,
        opts?.kind ? [opts.kind] : [],
      );
      return rows.map(mapKgNode);
    },
    async listKgEdges(opts) {
      const lim = Math.max(1, Math.min(2_000_000, opts?.limit ?? 1_000_000));
      const where = opts?.rel ? `where rel = $1` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from kg_edge ${where} order by src, rel, dst limit ${lim}`,
        opts?.rel ? [opts.rel] : [],
      );
      return rows.map(mapKgEdge);
    },
    async countKgNodes() {
      const { rows } = await pg.query<{ n: string | number }>(`select count(*)::int as n from kg_node`);
      return num(rows[0]?.n);
    },
    async countKgEdges() {
      const { rows } = await pg.query<{ n: string | number }>(`select count(*)::int as n from kg_edge`);
      return num(rows[0]?.n);
    },
    async countKgEdgesByRel() {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select rel, count(*)::int as n from kg_edge group by rel order by rel`,
      );
      const out: Record<string, number> = {};
      for (const r of rows) out[str(r.rel)] = num(r.n);
      return out;
    },
    async clearKg() {
      await pg.query(`delete from kg_edge`);
      await pg.query(`delete from kg_node`);
    },
  };
}
