// The AUTHORITATIVE PGlite schema. `lib/db/migrations/0001_civic_graph.sql` is a
// reference snapshot of this string for reviewers and the eventual move to hosted
// Postgres; nothing applies it at runtime.
//
// Shared conventions:
//  • `id` is a stable NATURAL key `<publisher>:<table>:<source id>` — re-running
//    an ingest over a refreshed dump updates rows in place instead of duplicating.
//  • provenance quartet on every table: source, source_url, fetched_at, ingest_run_id.
//  • `raw jsonb` keeps the source row verbatim (see types.ts for the one
//    documented exception, vote_ballot).
//  • `*_norm` columns hold ASCII-folded text; index those, never fold at query time.

export const CORE_DDL = `
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

-- ── review audit trail (human-gate write path, Case ① verification console) ──
-- Append-only: the ONLY writer is ReviewRepository.setTieReviewState. Records every
-- human decision on a linked_to tie BEFORE kg_edge.props.review_state is touched, so
-- the audit row for a given decision always predates (or is concurrent with, never
-- after) the state flip it explains. \`id\` is a client-generated UUID (crypto.randomUUID
-- in the writer), not a bigserial, so the writer can log the id before the insert lands.
create table if not exists review_audit (
  id           text primary key,
  src          text not null,
  rel          text not null,
  dst          text not null,
  decision     text not null check (decision in ('confirm', 'reject', 'needs-more')),
  reviewer     text not null,
  note         text,
  decided_at   timestamptz not null default now(),
  prior_state  text
);
create index if not exists review_audit_edge_idx on review_audit(src, rel, dst);
create index if not exists review_audit_decided_idx on review_audit(decided_at desc);

-- ── tamper-evident ledger (ADDITIVE — see lib/db/pglite/ledger.ts) ───────────
-- review_audit becomes a hash chain: every new row stores the previous row's
-- hash and its own hash over the pinned canonical serialization. Rows written
-- before the chain existed keep NULL hashes and sit outside the chain — the
-- chain (and its verification) covers rows from its genesis forward. The
-- ALTERs below upgrade pre-existing data dirs; \`create table if not exists\`
-- alone would leave them without the columns.
alter table review_audit add column if not exists chain_pos bigint;
alter table review_audit add column if not exists prev_hash text;
alter table review_audit add column if not exists row_hash  text;
create unique index if not exists review_audit_chain_pos_uidx
  on review_audit(chain_pos) where chain_pos is not null;

-- ingest runs can be SEALED: a Merkle root over the canonical hashes of every
-- row the run wrote (see LedgerRepository.sealIngestRun). NULL = not sealed.
alter table ingest_run add column if not exists merkle_root       text;
alter table ingest_run add column if not exists merkle_leaf_count integer;
alter table ingest_run add column if not exists merkle_sealed_at  timestamptz;

-- ── bitemporal claims (ADDITIVE — see lib/db/pglite/repositories/kg.ts) ──────
-- Every kg claim carries TWO timelines:
--   • valid_from / valid_to  — WORLD time: when the claimed fact held in reality.
--     Nullable; NULL = unknown/unbounded. Writers do not populate these yet
--     (KgNodeRow/KgEdgeRow carry no world-time fields) — the columns exist so
--     later batches can adopt them without another migration.
--   • recorded_at / superseded_at — RECORD time: when the store learned the
--     version / when a newer version replaced it. On the SERVING tables
--     superseded_at is always NULL (a serving row IS the current version);
--     superseded versions live in kg_node_history / kg_edge_history below.
-- Backfill: \`add column … default now()\` fills pre-existing rows with the
-- migration instant — the honest reading is "recorded since this migration".
alter table kg_node add column if not exists valid_from    timestamptz;
alter table kg_node add column if not exists valid_to      timestamptz;
alter table kg_node add column if not exists recorded_at   timestamptz not null default now();
alter table kg_node add column if not exists superseded_at timestamptz;
alter table kg_edge add column if not exists valid_from    timestamptz;
alter table kg_edge add column if not exists valid_to      timestamptz;
alter table kg_edge add column if not exists recorded_at   timestamptz not null default now();
alter table kg_edge add column if not exists superseded_at timestamptz;

-- Superseded versions, append-only. A history row's record-time span is
-- [recorded_at, superseded_at) — half-open, so at the exact supersede instant
-- the NEW version is visible and the old one is not. No primary key: one claim
-- key legitimately has many versions. The ONLY writers are the supersede paths
-- in repositories/kg.ts and repositories/review.ts; nothing updates or deletes
-- history rows.
create table if not exists kg_node_history (
  id               text not null,
  kind             text not null,
  label            text not null,
  props            jsonb not null default '{}'::jsonb,
  first_seen_pass  integer,
  provenance       jsonb not null default '{}'::jsonb,
  valid_from       timestamptz,
  valid_to         timestamptz,
  recorded_at      timestamptz not null,
  superseded_at    timestamptz not null
);
create index if not exists kg_node_history_id_idx on kg_node_history(id, recorded_at desc);

create table if not exists kg_edge_history (
  src            text not null,
  rel            text not null,
  dst            text not null,
  weight         real,
  props          jsonb not null default '{}'::jsonb,
  provenance     jsonb not null default '{}'::jsonb,
  valid_from     timestamptz,
  valid_to       timestamptz,
  recorded_at    timestamptz not null,
  superseded_at  timestamptz not null
);
create index if not exists kg_edge_history_key_idx on kg_edge_history(src, rel, dst, recorded_at desc);

-- ── derived theme tags on roll calls (Silver-layer sem_classify enrichment) ──
-- DERIVED metadata like slice_quality/kg_node: recomputable from vote titles,
-- never source-of-truth. Stamped with model+method so a rendered tag cites how
-- it was made (the brand rule). See docs/hybrid-benchmark-plan.md.
create table if not exists vote_tag (
  id           text primary key,
  vote_psp_id  integer not null,
  theme        text not null,
  confidence   real,
  model        text not null,
  method       text not null,
  tagged_at    timestamptz not null
);
create index if not exists vote_tag_theme_idx on vote_tag(theme);
create index if not exists vote_tag_vote_idx on vote_tag(vote_psp_id);
`;
