# Batch 5 — Legislation & Alignment (design doc)

> 5 features, one parallel wave (surfaces disjoint).
> Package narrative: **the statute book gets authorship, the voter gets alignment, the record
> gets reflexes.** Who wrote every paragraph of Czech law; how your positions align with 406k
> real ballots instead of party promises; ingestion becomes a source of change events; the graph
> watches itself and proposes review candidates; and your region's MPs become a ballot card you
> can hold.

## Shared design contract

**The full chain binds: BATCH-1 § Shared design contract (9 points) + BATCH-2 additions 10–12 +
BATCH-3 additions 13–15 + BATCH-4 additions 16–17 (accusatory-claim discipline; 18 applies only
to 4A).** Read them all.

Batch-5 additions:

19. **The tree has moved again.** Since Batch 4: Kolizní radar lives in features/lawwatch
    (deriveRadar, radarFeedCodecs, `#r-` anchors), BudgetMirror is real-data (features/budget,
    monitor adapter), Vote-Collision Engine in features/money/collisions (derive-per-request,
    bod_schuze vote→print linkage — REUSE its voteAgenda approach where you need vote↔bill
    joins), Evidence Packets in features/money/packet.ts. Doctrine lint rules active.
21. **Derive-per-request beats writes.** 5C (change events) may add an additive table + repo;
    5D (tripwires) writes NOTHING — candidates re-derive on read (4C precedent). Nobody else
    touches lib/db/pglite this batch except 5C's scoped additions.
22. **PosterFrame adoption starts now.** 5E's ballot card is the designated first adopter of
    features/shared/poster (PosterFrame + usePosterMode) outside its demo. If PosterFrame's
    single-sheet model doesn't fit, extend it additively in features/shared/poster (5E may touch
    that dir this batch — no one else will).

## Items

### 5A. Paměť zákona — per-paragraph authorship of the statute book
- **Source proposal**: `voting-legislation.md` § LawWatch M1. Read fully.
- **Surface (exclusive)**: `features/lawwatch/**`, `app/zakony/**` (post-4B state — integrate
  with the radar, don't disturb it).
- **Essence**: statute-centric dossiers: for each amended statute, the paragraph-level trail of
  who changed what when — built from the existing bills→statute amends edges, §-diff payloads,
  and sponsor links. A statute page (`/zakony/predpis/[ref]`) with a § index; each § shows its
  amendment history (bill, sponsors, date, vote link via the bod_schuze approach if cheap);
  authorship coverage disclosed (how many §§ have attributable history vs. not).
- **UX bar**: reads like a critical edition of the law — § column, amendment marginalia,
  sponsor attributions as sourced fact rows; LawWatch voice.
- **Tests**: §-trail derivation (grouping, ordering, multi-amendment §§), coverage stats,
  ref codec for statute pages.

### 5B. Volební kompas naruby — alignment over 406k real ballots
- **Source proposal**: `voting-legislation.md` § VoteTrack M1. Read fully.
- **Surface (exclusive)**: `features/votetrack/**`, `app/hlasovani/**`, NEW `app/kompas/**`.
- **Essence**: the inverted voting compass: the reader takes positions on a curated set of REAL
  divisive roll-calls (selected by a disclosed rule from the ledger — e.g. high-participation,
  low-cohesion votes across themes; reuse features/votetrack/record/derive.ts), and gets
  per-MP and per-club alignment computed from actual ballots. Results are URL-encoded
  (shareable, no accounts), with per-vote links into `#h-` anchors.
- **UX bar**: election-season shareable but house-styled: question cards (the actual vote,
  what YES meant — from real vote metadata, no editorializing), an alignment board with the
  Otevřený-index "your lens vs official" visual discipline. The selection rule printed.
- **Tests**: alignment scoring (agreement/abstain/absent handling — document the rule),
  URL codec round-trip, selection-rule derivation determinism.

### 5C. Civic seismograph — ingestion becomes change events
- **Source proposal**: `data-ingestion.md` § Source Adapters M2. Read fully.
- **Surface (exclusive)**: `lib/ingest/**`, `lib/db/pglite/ddl.ts` + NEW
  `lib/db/pglite/repositories/changes.ts` (additive only), `features/denik/**` (integration).
- **Essence**: a snapshot-diff layer for adapters: given two ingests of the same source, derive
  typed change events (mandate change, new contract, role change, new tie candidate…) into an
  additive `change_event` table (recorded_at, entity refs, event type, evidence pointer).
  Backfill what's derivable today (the bitemporal history tables from 3C + review_audit).
  Deník republiky consumes them: real record-time entries appear in `/denik` alongside the
  registry-dated ones, visually distinguished ("zaznamenáno" vs "účinné"), and the per-entity
  `?entita=` watch now covers them.
- **Tests**: diff derivation over fixture snapshots (add/remove/change), event codec, deník
  merge ordering, idempotent re-derivation.

### 5D. Tripwires — the graph watches itself
- **Source proposal**: `data-layer.md` § Knowledge Graph Domain Model M1. Read fully.
- **Surface (exclusive)**: `lib/analysis/**` (new tripwires module), `features/admin/**`,
  `app/admin/**`.
- **Essence**: declarative tripwire patterns over the kg — e.g. "new tie whose role-period
  overlaps a money-relevant vote window", "contract to a company tied to a sitting MP",
  "registry role change during a relevant committee assignment" — evaluated on read (NO writes,
  4C precedent), producing review candidates ranked by evidence completeness, surfaced as a
  queue section in the Admin console review hub with links into the verification console and
  /penize/strety. Each pattern's rule text is printed with its results.
- **Tests**: each pattern over fixture graphs (fires/doesn't-fire boundaries), ranking
  determinism, zero-candidate honesty.

### 5E. Můj kraj — the constituency ballot card
- **Source proposal**: `mp-profiles-rankings.md` § CivicScore Leaderboard M2. Read fully.
- **Surface (exclusive)**: `features/civicscore/**`, `app/zebricek/**`, NEW `app/kraj/**`,
  plus `features/shared/poster/**` (additive extension only if PosterFrame needs it — you are
  its first real adopter).
- **Essence**: pick your kraj → a ballot card of its MPs: scores (official + your Otevřený-index
  lens if active in the URL), pillar bars, workhorse badges, mandate info; printable via
  PosterFrame ("Tisk kandidátky"); shareable per-kraj permalink `/kraj/[kraj]`.
- **UX bar**: the card is something a voter pins to a fridge — dense, honest, beautiful;
  kraj picker follows the TownPicker interaction precedent (read-only; don't import from
  features/budget — pattern-match).
- **Tests**: kraj grouping/derivation from mandates, lens passthrough, citation-line reuse.

## Cross-feature coherence

- 5B and 5E both extend the "your lens vs official" visual language from 1A — same distinction
  colors/notes, no third variant.
- 5C's change events are the record-time source 3A was designed to consume — the deník
  integration must not change the existing diary rule, only add the "zaznamenáno" stream.
- 5D candidates and 4C strety are cousins: same "vyžaduje lidské ověření" framing, same calm
  voice; 5D links to strety where a tripwire and a collision candidate coincide.
- Anchor namespace check: `#p-<§>` (paměť §§), existing `#h-` `#z-` `#d-` `#r-` `#s-` stay.

## Orchestration

Single wave, 5 parallel builders, exclusive surfaces, no git. Orchestrator reviews, commits per
item (`vibeman(moonshot-b5)`), then batch gates: typecheck, lint (0 errors, warnings ≤30), full
vitest (≥980), `next build`.
