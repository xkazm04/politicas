# Batch 3 — The Daily Record (design doc)

> 5 features, 5 parallel builders, one shared design contract.
> Package narrative: **the state gets a diary.** After this batch the republic has a daily,
> provenance-stamped record of what changed (subscribable like Deník důkazů), every graph lens is
> a citable permalink, claims carry time (valid-time + record-time) in the data model, the dataset
> itself ships as versioned public releases, and an MP's file stretches across their whole career.

## Shared design contract

**BATCH-1-DESIGN.md § "Shared design contract" (all 9 points) + BATCH-2-DESIGN.md additions
10–12 (backward compatibility, full-suite run with the PGlite-flake re-run rule, additive-only
DDL, colocated Czech copy) all bind you.** Read both sections first.

Batch-3 additions:

13. **The tree has moved.** Batches 1–2 landed: Trail Engine lives in `features/graph`
    (trailPath.ts, TrailFinder), Exponát in `features/dashboard` (exhibit.ts, ExhibitPage),
    the hash-chain ledger in `lib/db/pglite` (ledger.ts, repositories/ledger.ts), Deník důkazů
    in `features/dukazy` (deriveFeed, feedCodecs — reusable RSS/JSON codecs), the Provenance
    Capsule in `features/shared/provenance` (claimRef codec), claims in `lib/claims`, and two
    doctrine lint rules that WILL flag your rendered figures — satisfy them properly
    (SourceNote / disclosed-rule), don't reach for escape hatches.
14. **Reuse the Batch-1/2 primitives instead of re-inventing**: RSS/JSON → import from
    `features/dukazy/feedCodecs.ts` (read-only); claim refs → follow `features/shared/provenance/
    claimRef.ts` patterns; claim metadata → `lib/claims`; content-hash ids → follow
    `features/dashboard/exhibit.ts` precedent (FNV-1a canonical JSON).
15. **Investigate before you promise.** 3A (pass-over-pass diffs) and 3E (multi-term history)
    depend on data that may only partially exist. Verify what the store actually holds FIRST;
    build the deterministic structure over what is real; disclose gaps honestly (Batch-1
    Seismograf precedent: it verified 402,800 real ballots before retiring the mock).

## Items

### 3A. Deník republiky — the daily provenance-stamped record of the state
- **Source proposals** (MERGED item — read BOTH): `mp-profiles-rankings.md` § Velin Dashboard M1
  AND `landing-navigation.md` § Landing Page M2.
- **Essence**: a chronological daily record at `/denik`: for each day, the dated facts / graph
  events that entered the record (grouped: contracts, committee routing, registry roles, review
  decisions), each entry sourced and anchor-linked (`#d-<date>`), with RSS + JSON feeds (reuse
  feedCodecs) and a "sledovat entitu" affordance (per-entity filtered view via query param —
  no accounts, URL is the subscription). Investigate pass-over-pass diffing (vault heads/passes);
  if only the current pass exists, derive the diary from dated facts' real dates and disclose the
  rule. Landing gets a compact "Dnešní zápis" teaser linking to /denik.
- **Surface (exclusive)**: new `features/denik/**` + `app/denik/**`; `features/landing/**` (teaser
  only); may READ features/dashboard + features/dukazy freely.
- **UX bar**: newspaper-of-record aesthetic — a dated masthead per day, austere entry rows in
  the FactRow voice; the teaser on the landing must feel like today's front-page rubric.
- **Tests**: day-grouping/ordering derivation, entity-filter derivation, feed codec round-trip.

### 3B. Evidence Permalinks — every graph lens becomes a citation
- **Source proposal**: `knowledge-graph-explorer.md` § M1. Read it fully.
- **Essence**: the current graph state (variant, lens, selected node, or computed trail) is
  serializable to a content-hashed permalink `/graf/p/[ref]` that server-renders the same view
  deterministically, plus: an OG image for the link card (use `next/og` ImageResponse — built-in,
  not a new dep), a JSON-LD provenance bundle, and a copy-citation affordance in the graph UI
  (works for Trail Engine results too — a computed trail becomes citable).
- **Surface (exclusive)**: `features/graph/**`, `app/graf/**` (current post-Batch-1 state — read
  trailPath/TrailFinder first and integrate, don't fork).
- **UX bar**: the permalink page is the graph view + a citation rail (ref hash, retrieved date,
  sources, "citovat" copy block); OG image in house style (dark, tokens, glyph + title).
- **Tests**: state codec round-trip (variant/lens/selection/trail), hash determinism, invalid-ref
  → 404 discipline.

### 3C. Bitemporal Graph — every claim gets a history
- **Source proposal**: `data-layer.md` § PGlite Repositories M2. Read it fully.
- **Essence**: additive bitemporality for kg claims: `valid_from/valid_to` (world time) and
  `recorded_at/superseded_at` (record time) columns with backfill defaults; writes supersede
  instead of overwrite (additive UPDATE discipline documented); an `asOf(date)` read API on the
  kg repository returning the graph as it was known at a moment; wired beneath the existing
  read paths so current-time reads are unchanged. NO UI this batch — the API is the deliverable
  (time-slider surfaces adopt it in later batches).
- **Surface (exclusive)**: `lib/db/pglite/**` (post-Batch-2 state — the hash-chain ledger lives
  here; coexist, don't touch its serialization).
- **Tests**: supersede-not-overwrite semantics, asOf reads at boundary instants, backfill
  defaults, current-read equivalence (asOf(now) === existing read), ledger tests still green.
- **CRITICAL**: existing repository behavior byte-identical for current-time reads; all existing
  tests pass untouched.

### 3D. Data Releases — the dataset ships like software
- **Source proposal**: `data-layer.md` § PGlite Store & Runtime M2. Read it fully.
- **Essence**: readiness floors become a public, versioned release train: a release manifest
  derivation (semver-ish `YYYY.MM.DD` + content summary: table counts, vault heads, Merkle roots
  via LedgerRepository read-only, readiness verdicts), a public `/data` page listing releases
  with an austere changelog, and downloadable JSON snapshot(s) of the public graph slice
  (server route streaming from repositories read-only; size-disclosed).
- **Surface (exclusive)**: `lib/db/*.ts` root files (store.ts, readiness.ts, config.ts, narrow.ts
  — NOT `lib/db/pglite/**`, that's 3C's), new `features/data-releases/**` + `app/data/**`.
- **UX bar**: reads like a release page for a serious open-data project — version, date, counts,
  integrity roots, download with size; SourceNote/methodology per figure (the doctrine rule is
  watching).
- **Tests**: manifest derivation determinism from fixture stats, changelog ordering, snapshot
  shape.

### 3E. Kariérní spis — the MP file across parliamentary terms
- **Source proposal**: `mp-profiles-rankings.md` § MP Profile Dossier M2. Read it fully.
- **Essence**: the dossier gains a career spine: a term timeline (volební období) with per-term
  presence — mandate dates, roles, activity summary where data exists. FIRST verify what
  historical data the store/adapters actually hold (psp.ts, volby.ts may carry prior-term
  organ/mandate rows). Build the timeline over real data; terms without ingested data render as
  explicit disclosed gaps ("období zatím mimo záznam — zdroj: psp.cz"), never fabricated.
- **Surface (exclusive)**: `features/profile/**`, `app/poslanec/**`.
- **UX bar**: the career spine reads like a service record — vertical term ribbon in the dossier
  header area, current term emphasized, gaps honest; prev/next MP navigation keeps working.
- **Tests**: term derivation from fixture mandate rows (ordering, open-ended current term,
  gap detection).

## Cross-feature coherence

- Anchors: `#d-<date>` (denik days) joins `#h-<vote>` / `#z-<decision>`; keep the convention table
  in your heads consistent.
- 3B's permalink refs and 3A's day anchors are citations — both should surface the same
  "citovat" copy-block pattern (follow 1E Exponát's copy-link affordance).
- 3D's manifest consumes 3C's world only via existing read APIs + LedgerRepository — if 3C's
  asOf lands mid-flight, do NOT depend on it this batch.
- 3A and 3E both render dated records — reuse the FactRow visual voice (read-only import or
  pattern-match; don't fork a third dated-row style).

## Orchestration

Same loop: parallel builders, exclusive surfaces, no git; orchestrator reviews, commits per item
(`vibeman(moonshot-b3): <item>`), gates: typecheck, lint (0 errors; doctrine warnings must not
grow — new code satisfies the rule), full vitest (≥785), `npx next build`.
