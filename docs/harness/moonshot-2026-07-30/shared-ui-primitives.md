# Moonshots — Shared UI Primitives

> Group: Shared UI Primitives · Contexts: 2 · Proposals: 4

## Archived Art Direction (Rentgen)

### M1. Rentgen resurrected as the Newsroom Evidence Terminal
- **Tier**: 1
- **Category**: platform-distribution
- **Feasibility**: medium
- **Time-horizon**: quarters
- **What it is**: Promote the archived `/rentgen` direction from a static art relic into politicas' second product: a dark, mono, journalist-facing evidence terminal wired to the REAL knowledge graph. Its centerpiece — the "důkazní log — tail -f" panel that today renders five hardcoded `LOG_LINES` — becomes a live stream of actual provenance events (kg writes, IČO-join resolutions, human review-gate verdicts, score recomputations flagged `nezveřejněno do ověření`). Newsrooms get a keyed, embeddable console: the "second monitor a redakce would keep open," exactly as the file's own header comment already imagines it.
- **Why it's a moonshot**: It converts one product into two — a voter-facing poster (Konstrukt) and a press-facing forensic terminal — and is falsifiable: within two quarters of launch, at least three Czech newsrooms (e.g. Hlídač-adjacent outlets, iRozhlas datateam) run the terminal or cite its log lines with permalinks.
- **Grounded in**: `features/labs/rentgen/VariantRentgen.tsx` (MoneyGraph hover-trace + audit-log UI already built), `app/rentgen/page.tsx` (mounted, noindexed), `lib/db/pglite/repositories/provenance.ts` + `repositories/review.ts` (the real event substrate), `lib/analysis/kg-money.ts` and `lib/kg/sourceLinks.ts` (real trails + deep links). The README confirms the real graph (7 045 people, 406k ballots, 2 287 contracts) already exists behind the mock.
- **Path to implementation**:
  1. Replace `MoneyGraph`'s `GRAPH_NODES`/`GRAPH_EDGES` sample import with a real slice from `lib/analysis/kg-money.ts` behind the existing loader-guard pattern (mock fallback stays, labeled).
  2. Replace `LOG_LINES` with the newest N provenance rows from the provenance repository, rendered in the same timestamp/source/flag grammar.
  3. Add an SSE or polling refresh so the log actually tails during ingest runs.
  4. Add per-line permalinks that deep-link into `/penize/kontrola` and `/graf` node views.
  5. De-noindex behind a `?press` key; ship an `<iframe>` embed snippet with the citation footer mandatory.
  6. Pilot with one newsroom; instrument which log-line classes get cited.
- **Dependencies / risks**:
  - Labs is a fixed-art-direction zone (literal hexes allowed, no tokens) — resurrecting it as product means graduating it OUT of `features/labs/` and deciding its token story.
  - Live provenance lines about pending money ties must stay behind the human gate — the log must only ever show gate *status*, never ungated accusations.
  - PGlite single-connection: a live-tailing public surface needs the readiness/loader-guard discipline (`lib/db/readiness.ts`) or a read replica story.
- **What changes if we ship it**: politicas stops being one website and becomes civic infrastructure with a distinct professional distribution channel into every Czech newsroom.

### M2. Forenzní režim — the archived direction becomes a live second lens on every module
- **Tier**: 2
- **Category**: interface-expansion
- **Feasibility**: medium
- **Time-horizon**: months
- **What it is**: Generalize what Rentgen proves — that the same civic data reads completely differently in graphite-terminal grammar than in gallery-poster grammar — into a first-class dual-lens system. A "forenzní režim" toggle re-skins any live module (leaderboard, vote ledger, money graph) into the Rentgen language: dark panel, mono audit-row typography, amber money-trail highlighting, everything framed as log records. The labs folder stops being a graveyard and becomes the standing R&D harness where each future art-direction candidate ships as a selectable lens over real data instead of a throwaway prototype.
- **Why it's a moonshot**: One codebase serves two audiences with opposite reading modes — casual voters (poster) and analysts/investigators (terminal) — a 3–5x widening of who the same surfaces serve, measurable by forensic-mode session depth vs. default.
- **Grounded in**: `features/labs/rentgen/VariantRentgen.tsx` already contains the complete alternate grammar (BG/PANEL/HAIR/AMBER constants, audit-row leaderboard at lines 257–302, terminal source-registry table); `app/globals.css` tokens + `docs/DESIGN.md` §1 give the token mechanism to host a second theme scope; `eslint-rules/no-hardcoded-colors.cjs` already scopes a labs exception that a theme layer would formalize.
- **Path to implementation**:
  1. Extract Rentgen's eight color constants into a `[data-lens="rentgen"]` token scope in `globals.css` (a pure-CSS step, no component changes).
  2. Port ONE live surface — the CivicScore leaderboard table — to consume lens-aware tokens, reusing Rentgen's audit-row layout as its forensic rendering.
  3. Add the lens toggle to the shell (persisted preference), defaulting to Konstrukt.
  4. Extend to VoteTrack's ledger and the money graph (whose hover-lit-edge interaction Rentgen already implements).
  5. Codify the pattern in `docs/DESIGN.md` as the lab-to-lens pipeline for future direction candidates.
- **Dependencies / risks**:
  - Two maintained skins can silently drift — the lens must be tokens + a small set of lens-aware primitives, never forked components.
  - The Konstrukt-won decision (DESIGN.md, 2026-07-22) must not be relitigated: Rentgen stays an opt-in lens, not a competing default.
- **What changes if we ship it**: the runner-up art direction stops costing maintenance as an archive and starts earning as the analyst mode of the whole product.

## Shared Display Primitives

### M1. SourceNote → the Provenance Capsule: every citation becomes a verifiable receipt
- **Tier**: 1
- **Category**: trust-layer
- **Feasibility**: high
- **Time-horizon**: months
- **What it is**: Upgrade `SourceNote` — already the canonical, brand-rule-bearing citation primitive imported everywhere — from static text into an interactive provenance capsule. Clicking any citation opens a receipt: the exact kg node/edge behind the number, source dataset + retrieval date, review-gate status (verified / pending_review), and a deep link to the upstream registry (ARES, Registr smluv, psp.cz). Each receipt gets a stable permalink and machine-readable markup (schema.org `ClaimReview`), making every rendered number on politicas independently checkable by a reader, a journalist, or a fact-check crawler.
- **Why it's a moonshot**: It makes "evidence-cited" a verb instead of an adjective — the falsifiable claim: any number on any of the five modules can be traced to its primary source in ≤2 clicks, and receipt permalinks start appearing in third-party fact-checks within a quarter.
- **Grounded in**: `features/shared/components/SourceNote.tsx` (single canonical citation shape, "nesázet ručně, importovat odsud" — one chokepoint upgrades the whole app), `lib/kg/sourceLinks.ts` (source deep-link helpers already exist), `lib/db/pglite/repositories/provenance.ts` (provenance stamps already stored per fact), `lib/analysis/kg.ts` (node/edge context assembly for the receipt body).
- **Path to implementation**:
  1. Add an optional `provenanceRef` prop to `SourceNote` (node/edge id or fact id); when present, render the existing note as a button — zero visual change for legacy call sites.
  2. Build the receipt panel: kg context + provenance row + review status + `sourceLinks` deep link, in Konstrukt grammar (SectionRule, mono meta).
  3. Give receipts stable routes (`/zdroj/[factId]`) so they are linkable and crawlable.
  4. Thread `provenanceRef` through the highest-traffic call sites first: profile money ties, leaderboard scores, LawWatch verdicts.
  5. Emit `ClaimReview`/`Dataset` JSON-LD on receipt routes; document the citation contract in `docs/DESIGN.md` §3.
- **Dependencies / risks**:
  - Only works where surfaces are wired to the real graph — the mock `lib/civic` fallback must render capsules disabled with the existing "ilustrativní" labeling, never fake receipts.
  - Receipt routes must respect the human gate: pending facts show gate status, not content, to non-reviewers.
- **What changes if we ship it**: politicas becomes the only Czech political site where every number is a door, not a claim — the trust architecture itself becomes the product's moat.

### M2. Skóre s pamětí — AnimatedScore and RankDelta become time-scrubbing instruments
- **Tier**: 2
- **Category**: intelligence-layer
- **Feasibility**: medium
- **Time-horizon**: months
- **What it is**: Extend the animated-number primitive family into a temporal instrument: an `asOf` axis on `AnimatedScore` plus a shared scrub control, so any score readout anywhere in the app can replay its history — drag a timeline and watch an MP's contribution index, rank and pillar bars re-animate through the term, with `RankDelta` recomputed against the scrubbed baseline instead of a fixed snapshot. The flagship payoff is an election-season "replay the term" mode on profiles and the leaderboard: four years of accountability compressed into a ten-second, evidence-backed animation.
- **Why it's a moonshot**: Static scores answer "who is good now"; scrubbing answers "who changed, when, and around which vote" — a step-change from lookup tool to narrative instrument, measurable by scrub engagement and by press embeds of replay clips.
- **Grounded in**: `features/shared/components/AnimatedScore.tsx` (already animates between values with NaN-guarding — the scrubber just feeds it a value stream), `features/shared/components/RankDelta.tsx` (delta rendering with the missing-snapshot guard already written), `lib/analysis/contribution-trend.ts` (trend history derivation exists), `lib/db/pglite/repositories/analysis.ts` (persisted analysis outputs to snapshot per period).
- **Path to implementation**:
  1. Add an optional controlled mode to `AnimatedScore` (`value` driven by an external timeline hook) — non-breaking, current call sites untouched.
  2. Persist periodic score snapshots via the analysis repository (monthly grain first), backfilled from `contribution-trend`.
  3. Build a shared `useTimeScrub` hook + a Konstrukt-styled scrub rail primitive in `features/shared/`.
  4. Wire it into ONE surface — the MP profile header (score + pillars + rank) — as the proving ground.
  5. Extend to the leaderboard (whole table re-ranks as you scrub) and the Souboj head-to-head.
- **Dependencies / risks**:
  - Honest history requires real snapshots — replaying interpolated fakes would violate the brand rule, so the scrubber must be gated on genuinely stored periods and say so via `SourceNote`.
  - Whole-leaderboard re-rank on scrub needs precomputed per-period rankings, not client recomputation over 207 MPs.
  - Reduced-motion users need a stepped (non-animated) rendering path, per the existing lint rule.
- **What changes if we ship it**: every number in the app gains a time dimension, turning politicas from a scoreboard into a replayable record of the parliamentary term.
