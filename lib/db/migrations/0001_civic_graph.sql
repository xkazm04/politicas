-- politicas civic entity graph — reference schema snapshot.
--
-- THIS FILE IS A SNAPSHOT, NOT APPLIED AT RUNTIME. The authoritative schema is
-- CORE_DDL in lib/db/pglite-store.ts, which PGlite executes at open(). This
-- snapshot exists for reviewers and for the eventual move to a hosted Postgres
-- (where it becomes migration 0001). Regenerate from CORE_DDL if the DDL changes:
-- npx tsx scripts/gen-migration.ts
--
-- Provenance columns (source, source_url, fetched_at, ingest_run_id) + a raw
-- jsonb payload travel on every entity table; ids are natural keys
-- <publisher>:<table>:<source id>. *_norm columns hold ASCII-folded Czech text
-- (PGlite ships no unaccent extension) and carry their own btree index.
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

