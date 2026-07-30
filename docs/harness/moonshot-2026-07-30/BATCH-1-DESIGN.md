# Batch 1 — Citizen Instruments (design doc)

> 5 features, built in parallel by 5 builder agents, one shared design contract.
> Package narrative: **the reader stops consuming and starts interrogating.** After this batch a
> visitor can re-weight the republic's index with their own values, trace the evidence path between
> any two entities, read the chamber's real discipline record, and take any figure away as a
> print-grade poster or a signed exhibit. Every instrument stays provenance-first: nothing renders
> without a source, every derived number discloses its rule.

## Shared design contract (ALL items)

1. **Follow the house style.** Read `docs/DESIGN.md` and `app/globals.css` (design tokens) before
   writing any UI. Reuse `features/shared/components/*` primitives (SectionHeading, SectionRule,
   SourceNote, AnimatedScore, RankDelta, DataUnavailable) instead of inventing new ones. Match the
   existing typographic voice: instrument-panel, archival, Czech-first.
2. **Czech UI copy** throughout (the app is Czech-first; use the same register as existing pages).
   Numbers go through `lib/format.ts` / `lib/i18n/useFormat.ts` helpers — never raw `toLocaleString`.
3. **Custom lint rules are law**: no hardcoded colors (tokens only), no silent catch, keydown on
   role=button, reduced-motion fallback for every animation, no server imports in client components.
   Run `npx eslint <your files>` before finishing.
4. **Provenance discipline**: any new rendered figure or claim must carry a SourceNote (or an
   explicit disclosed-rule note, like stateSlice's "seeds picked by ascending pspId" pattern).
   If real data for something is missing, do NOT fake it — render the deterministic foundation and
   disclose the gap with DataUnavailable + a note.
5. **No new npm dependencies.** No schema-destructive DDL changes. Graceful null-loader fallback
   (the lib/civic sample layer) must keep working.
6. **Accessibility**: keyboard operable, focus-visible, aria labels on interactive instruments,
   `prefers-reduced-motion` respected (lint enforces it).
7. **Discoverability**: a feature nobody finds is a failed feature. Each item names its entry
   points below — wire them all, with an explanatory one-liner in the UI so a first-time user
   understands what the instrument does.
8. **Stay in your lane** (file surfaces below are exclusive; read anything, write only yours).
   Do NOT run git. Do NOT edit `app/layout.tsx`, `features/shell/*`, or another item's surface.
   New files inside your surface are fine.
9. Definition of done: `npx tsc --noEmit` clean, `npx eslint` clean on your files, existing tests
   untouched and passing, **new vitest coverage for every new pure derivation** (match the
   colocated `*.test.ts` style), and a ≤150-word report of what you built + any disclosed gaps.

## Items

### 1A. Otevřený index — the reader re-weights the republic
- **Source proposal**: `mp-profiles-rankings.md` § CivicScore Leaderboard M1. Read it fully.
- **Essence**: reader-adjustable weights over the six published score components; the whole
  leaderboard re-ranks live; the weight-set is URL-encoded (shareable lens); a "výchozí metodika"
  reset restores published weights; disclosed-rule note explains what the reader is doing.
- **Surface (exclusive)**: `features/civicscore/**`, `app/zebricek/**`.
- **UX bar**: weight sliders styled as instrument faders consistent with tokens; live re-rank
  animated (with reduced-motion fallback); the histogram and per-row breakdown bars re-derive from
  reader weights; a clear visual state distinguishing "official methodology" vs "your lens" (the
  reader must never mistake their lens for the published index).
- **Tests**: pure re-weighting/re-ranking derivation + URL codec round-trip.

### 1B. Trail Engine — spoj dva body
- **Source proposal**: `knowledge-graph-explorer.md` § M2. Read it fully.
- **Essence**: pick any two entities in the graph; a server action computes the shortest evidence
  path(s) over kg edges; the path renders through the existing lens/stage machinery as a lit trail
  with a step-by-step evidence ledger (each hop = a sourced fact row); ranking rule disclosed.
- **Surface (exclusive)**: `features/graph/**`, `app/graf/**`. (Read `lib/analysis/kg*.ts`,
  `lib/kg/*` — do not modify them.)
- **UX bar**: two-slot picker integrated with existing NodeSearch; the found trail dims the rest
  of the canvas and lights hops in sequence (reduced-motion: static highlight); empty result gets
  an honest "žádná doložená cesta" state; hop ledger rows link to provenance like NodeInspector does.
- **Tests**: BFS/shortest-path derivation over a fixture graph, determinism + tie-breaking rule.

### 1C. Seismograf sněmovny — real discipline over the full ledger
- **Source proposal**: `voting-legislation.md` § VoteTrack M2. Read it fully.
- **Essence**: discipline/rebellion/cohesion computed from the real ingested vote ledger (retire
  mock ROLL_CALLS wherever real data exists), per-vote permalink anchors, and a chamber
  "seismogram" strip — cohesion over time with rebellion spikes.
- **Surface (exclusive)**: `features/votetrack/**`, `app/hlasovani/**`.
- **UX bar**: the seismogram is the hero — a horizontal time strip in the house aesthetic (tokens,
  no chart-library gloss) with hover/focus detail; per-vote anchors (`#h-<id>`) scroll+highlight;
  if part of the ledger is mock-only, compute from what is real and disclose coverage explicitly.
- **Tests**: cohesion/rebellion derivations on fixture ballots; anchor id derivation.

### 1D. Poster Mode — the election-season print pipeline
- **Source proposal**: `infrastructure-observability.md` § App Bootstrap M2. Read it fully.
- **Essence**: any key view (leaderboard, dossier, seismograf) exports as an A4/A3 print-grade
  poster: print stylesheet layer + a poster frame (title, QR-less citation footer with source URL
  + retrieved-at date + methodology line), triggered from a small "Tisk / plakát" affordance.
- **Surface (exclusive)**: `app/globals.css` (append a clearly-marked print layer), new files under
  `features/shared/poster/**` only, plus its own demo route `app/plakat/[view]/page.tsx` if useful.
  Do NOT edit other features' components — provide a `PosterFrame` + `usePosterMode` others adopt
  in later batches; wire ONE reference integration via the demo route rendering the leaderboard
  loader's data (import loaders read-only).
- **UX bar**: print output must look deliberately designed (margins, rules, archival footer), not
  like a browser print; on-screen preview matches print; Czech footer copy citing methodology.
- **Tests**: pure poster-metadata derivation (citation line builder).

### 1E. Evidence cards — every dashboard slice as a citable exhibit
- **Source proposal**: `mp-profiles-rankings.md` § Velin Dashboard M2. Read it fully.
- **Essence**: any graph slice / fact row on the Velin dashboard exports as a self-contained
  "exhibit" card: stable content-hash id, the rendered slice, its dated facts, and a citation
  footer (source links + hash + retrieved date). Card view lives at `app/dashboard/exponat/[id]`
  (server-rendered, deterministic re-derivation from the hash-addressed params — no DB writes).
- **Surface (exclusive)**: `features/dashboard/**`, `app/dashboard/**`.
- **UX bar**: an unobtrusive "Exponát" affordance on slice/fact panels; the exhibit page is
  gallery-grade — the card is the entire page, museum-label typography, hash + provenance footer;
  copy-link affordance with confirmation.
- **Tests**: content-hash determinism (same slice → same id), params codec round-trip.

## Cross-feature coherence

- 1A/1C/1E all disclose their rule with the same visual pattern — reuse the stateSlice disclosure
  style (bordered note + SourceNote), don't invent three new ones.
- 1D's PosterFrame is the designated export primitive: 1A and 1C should NOT build their own print
  paths (they get poster support in a later batch via PosterFrame adoption).
- Naming: reader-facing Czech feature names are `Otevřený index`, `Spoj dva body`, `Seismograf`,
  `Plakát`, `Exponát` — use them consistently in UI copy.

## Orchestration

Builders work in parallel in the same tree on exclusive surfaces, no git. The orchestrator
reviews each result against this doc, commits per item (`vibeman(moonshot-b1): <item>`), then runs
the batch gates: `npm run typecheck`, `npm run lint`, `npm run test` (must stay ≥630 passing),
`npx next build`.
