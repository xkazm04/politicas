# Moonshots — Infrastructure & Observability

> Group: Infrastructure & Observability · Contexts: 4 · Proposals: 8

## Custom ESLint Rules

### M1. The Doctrine Compiler — evidence-citation as a compile-time guarantee
- **Tier**: 1
- **Category**: trust-layer
- **Feasibility**: medium
- **Time-horizon**: months
- **What it is**: Today the brand rule — "every rendered number carries its source" — is a convention enforced by review. Extend the custom rule pack with a `require-source-citation` rule: any feature component that renders a numeric formatter result (`f.dec`, `f.int`, `czech*`, `AnimatedScore`) inside a section without a `SourceNote`/`SourceRef` in the same JSX subtree fails lint. Add sibling rules `no-raw-tofixed` (components never call `.toFixed()`/`toLocaleString` — currently only prose in DESIGN.md §Typography) and `no-unverified-claim-copy` (accusatory verb list gated to files that consume `verified`-status data). The evidence doctrine stops being culture and becomes a build gate — provable, not promised.
- **Why it's a moonshot**: No transparency product in the world can say "our sourcing rule is machine-enforced; an uncited number cannot compile." Falsifiable: after landing, `npm run check` fails on any new uncited figure — count of uncited numbers on the site trends monotonically to zero and stays there.
- **Grounded in**: `eslint-rules/no-hardcoded-colors.cjs` and `eslint-rules/enforce-reduced-motion-fallback.cjs` already do exactly this class of JSX-subtree + scope analysis (Program:exit buffering, outermost-ancestor scoping); `features/shared/components/SourceNote.tsx`; `lib/format.ts` (single formatting chokepoint makes the call sites detectable); `eslint.config.mjs` scoping precedent for declared exceptions.
- **Path to implementation**:
  1. Write `eslint-rules/no-raw-number-display.cjs` flagging `.toFixed()`/`toLocaleString()`/`toLocaleDateString()` in `features/**` — pure port of the existing catch-visitor pattern, doable today.
  2. Add `require-source-citation`: detect formatter call sites in JSX, walk to the nearest `DossierSection`/`SectionHeading` boundary, require a `SourceNote` descendant; support `// citation-ok: <reason>` like `reduced-motion-ok`.
  3. Run in warn mode; burn down the existing violation inventory per module (the impeccable-pass docs show this burn-down workflow already works).
  4. Flip to error; scope declared exceptions (landing hero, admin console) in `eslint.config.mjs`.
  5. Add the accusatory-copy rule fed by a word list co-owned with `lib/analysis/public-copy.ts`.
- **Dependencies / risks**:
  - JSX-subtree heuristics can false-positive on numbers that are genuinely decorative (indexes, "obr. N") — needs the NON_COLOR_ATTRS-style suppression list from day one.
  - Warn-mode burn-down must precede error mode or it blocks all feature work.
- **What changes if we ship it**: "Provenance-first" becomes an auditable property of the codebase itself — the methodology page can truthfully say an uncited number is a build failure.

### M2. eslint-plugin-civic-transparency — export the discipline as a public artifact
- **Tier**: 2
- **Category**: platform-distribution
- **Feasibility**: high
- **Time-horizon**: weeks
- **What it is**: Package the six rules (plus M1's doctrine rules) as a published, fixture-tested npm plugin — `eslint-plugin-civic-transparency` — with the politicas repo as first consumer. Pair it with a generated `/metodika/enforcement` page: rule metadata (description, messages, what it guarantees) rendered in-app, so the methodology page lists not just how scores are computed but which editorial guarantees are machine-enforced, with links to the rule source. Watchdog NGOs, newsroom dev teams, and other countries' parliament-tracker projects adopt the pack; politicas becomes the reference implementation of "transparency as lint."
- **Why it's a moonshot**: Turns internal tooling into distribution — every adopting civic-tech repo is a backlink and a credibility proof, and no competing tracker can claim the same enforcement story without literally installing your plugin.
- **Grounded in**: All six rules in `eslint-rules/*.cjs` are already dependency-free, documented, and battle-tested (several note "ported from personas" — the porting pattern already exists in reverse); rule `meta.docs.description` fields are ready-made page content; `app/` route conventions make the enforcement page a thin static route.
- **Path to implementation**:
  1. Add RuleTester fixture tests for the six rules under `eslint-rules/__tests__/` (they currently ship untested) — pure current-scaffold work.
  2. Extract to `packages/eslint-plugin-civic-transparency/` with the repo consuming it via workspace path.
  3. Build the `/metodika/enforcement` static page reading rule metadata at build time.
  4. Publish to npm with a README framing the doctrine (token discipline, no-silent-failure, a11y, motion safety, server boundary, citation enforcement).
  5. Pitch to two external civic-tech repos (Hlídač státu ecosystem is the obvious first target).
- **Dependencies / risks**:
  - Maintenance surface: external consumers mean semver discipline for rules that were free to churn.
  - The citation rules (M1) are politicas-shaped; ship the generic five first, doctrine rules as an opt-in preset.
- **What changes if we ship it**: The lint layer stops being invisible infrastructure and becomes both a trust exhibit on the methodology page and an adoption channel into the civic-tech ecosystem.

## Test Utilities & Loader Coverage

### M1. The Reproducibility Certificate — a golden parliament every published number must replay from
- **Tier**: 1
- **Category**: trust-layer
- **Feasibility**: medium
- **Time-horizon**: quarters
- **What it is**: Generalize `leaderboard-loader.test.ts`'s seeded-PGlite pattern into a versioned **golden fixture parliament** — ~12 synthetic MPs with mandates, votes, money ties, bills, and provenance stamps covering every scorer branch — that ALL module loaders (civicscore, money, lawwatch, votetrack, dashboard) must render against, with the expected outputs pinned as human-readable "proof tables." Then publish the harness: a public `docs/reproducibility/` artifact + `npm run certify` that any journalist or academic can run to verify that the exact scorer code producing the site's numbers reproduces the pinned results from the pinned inputs. Politicas stops asking to be trusted and starts being *replayable*.
- **Why it's a moonshot**: "Every number on this site is recomputable by a third party from a published fixture with one command" is a claim no accountability platform currently makes; falsifiable by literally running the command. It converts the test suite — normally pure cost — into the product's strongest trust asset.
- **Grounded in**: `lib/testing/leaderboard-loader.test.ts` already solved the hard parts (isolated `PGLITE_PATH` tmpdir, `KG_READINESS_OFF` gate bypass, cross-boundary loader import via `lib/testing/server-only-stub.ts` alias, WASM-boot timeout handling); `lib/db/pglite/ddl.ts` gives the seedable schema; deterministic scorers in `lib/analysis/` guarantee replay stability.
- **Path to implementation**:
  1. Extract the seed helper from `leaderboard-loader.test.ts` into `lib/testing/goldenParliament.ts` (persons + mandates + votes seeding functions) — direct refactor of existing code.
  2. Add loader tests for `getMoneyData`, `getLawData`, `getVoteThemes`, `getDashboardData` against the golden seed (the cross-boundary import pattern is proven).
  3. Grow the fixture to cover every scorer branch (rebellions, Case-1 conflicts, absentee-manager crossover) and pin proof tables as snapshots.
  4. Add `npm run certify` that seeds, runs all loaders, and emits a markdown proof report.
  5. Publish the fixture + report under `docs/reproducibility/` and link it from the methodology page.
- **Dependencies / risks**:
  - Fixture drift: schema changes must migrate the golden parliament — mitigated by keeping seeds as typed code against `ddl.ts`, not JSON dumps.
  - Parallel-worker WASM contention (already noted in the existing test) grows with 5 loader files — may need a shared worker pool config.
- **What changes if we ship it**: The site's scores gain a standing, independently-runnable proof of reproducibility — the strongest possible answer to "who says your numbers are right?"

### M2. Live-Graph Sentinel — the test layer runs nightly against the real ingested graph
- **Tier**: 2
- **Category**: intelligence-layer
- **Feasibility**: high
- **Time-horizon**: weeks
- **What it is**: A second test tier — `*.sentinel.test.ts` — that points `PGLITE_PATH` at (a copy of) the real `.pglite` store instead of a tmpdir seed and asserts *invariants* rather than exact values: no person without provenance, no verified tie lacking a source URL, no impossible dates surviving to loaders, no fabricated club (the `"—"` guarantee), histogram counts summing to the chamber size, all 207 current MPs resolving to finite component points. Runs nightly/pre-deploy; violations surface as rows in the Admin Console's system-state strip. The suite stops testing only what the code does with clean fixtures and starts continuously auditing what the *data* actually contains.
- **Why it's a moonshot**: Converts ~406k real ballots and 2,287 real contracts from a liability (untested surface) into a continuously-verified corpus — data-integrity regressions are caught the night an ingestion pass introduces them, not when a reader screenshots a broken profile.
- **Grounded in**: The `PGLITE_PATH` env indirection in `lib/db/pglite/internals.ts` (proven by `leaderboard-loader.test.ts` line 15–16) makes retargeting trivial; `lib/db/readiness.ts` already defines cardinality-floor invariants to build on; `features/admin/components/SystemStateStrip.tsx` is the natural surfacing point; the dashboard's `datedFacts.ts` "impossible dates excluded and disclosed" logic names the exact invariant class.
- **Path to implementation**:
  1. Add `lib/testing/sentinel/graph-invariants.sentinel.test.ts` with 5 invariants (provenance presence, club fabrication, finite scores, date sanity, histogram totals) behind a `SENTINEL=1` env gate so `npm run check` stays fast — runnable today against the live dir.
  2. Add an `npm run sentinel` script that snapshots `.pglite` to a tmpdir first (never test against the live handle).
  3. Extend invariants per module as each surface wires to the real graph (the README says this wiring is the next phase — sentinels land *before* each wiring, as its acceptance gate).
  4. Write the last sentinel run's result into an `analysis` repository row so `getAdminData.ts` can render it in the system-state strip.
- **Dependencies / risks**:
  - Sentinel failures are data problems, not code bugs — needs a triage convention so red runs don't get "fixed" by loosening the invariant.
  - Snapshot-copy of a large PGlite dir adds runtime; acceptable for a nightly tier.
- **What changes if we ship it**: Every ingestion pass is followed by an automated audit of the published-facing guarantees, making "human-gated, provenance-stamped" a continuously verified state rather than a point-in-time claim.

## App Bootstrap & Global Styles

### M1. The Specimen Syndication Engine — every figure becomes an embeddable, self-citing artifact
- **Tier**: 1
- **Category**: platform-distribution
- **Feasibility**: medium
- **Time-horizon**: quarters
- **What it is**: Konstrukt already numbers every figure ("obr. N") like a printed atlas. Make that literal: each figure (score card, hemicycle, discipline matrix, money trail) gets a stable `/obr/[id]` route that renders it standalone from the same tokens — as an oEmbed-able iframe, an OG/social image generated server-side with `next/og` `ImageResponse`, and a copy-embed snippet with the citation and methodology link baked in and non-removable. Newsrooms, bloggers, and campaign fact-checkers embed live politicas figures instead of screenshotting them; every embed carries source + cadence + a backlink, and updates when the data does.
- **Why it's a moonshot**: Distribution inverts — instead of readers coming to the site, the site's figures propagate across Czech media with provenance attached; one viral embedded chart reaches more voters than the whole standalone site. Falsifiable via embed-referrer counts.
- **Grounded in**: `app/layout.tsx` already does async `generateMetadata` per route (the OG plumbing pattern); `app/globals.css` is a single-source token sheet that `ImageResponse` JSX can consume via the same hex values `features/landing/palette.ts` already mirrors for recharts; the thin-route convention (`app/` pages only mount features) means figure components are already extractable; `LiveSpecimen.tsx` on the landing proves figures render standalone.
- **Path to implementation**:
  1. Add one `app/obr/[id]/page.tsx` route rendering the CivicScore histogram standalone on `paper` with a mandatory `SourceNote` footer — pure composition of existing components, doable now.
  2. Add `opengraph-image.tsx` via `ImageResponse` for that route, reusing the palette mirror.
  3. Add the oEmbed discovery endpoint + copy-embed UI (mono-font snippet, very Konstrukt).
  4. Register 6–8 flagship figures across modules in a small figure registry (id → component + data loader + citation).
  5. Pitch embeds to two Czech newsrooms before the election cycle.
- **Dependencies / risks**:
  - Embedded figures must never outrun the human gate — the registry must only expose verified/score surfaces, never pending-review money claims.
  - iframe embeds need a CSP/frame-ancestors policy decision.
- **What changes if we ship it**: Politicas becomes infrastructure other publishers build on — its figures, with citations welded on, circulate wherever Czech politics is discussed.

### M2. Poster Mode — the election-season print pipeline built into the stylesheet layer
- **Tier**: 2
- **Category**: interface-expansion
- **Feasibility**: high
- **Time-horizon**: weeks
- **What it is**: Konstrukt is literally a Czech functionalist *poster* language — but the app can't print. Add a first-class print/poster render mode at the bootstrap layer: `@page`/`print:` styles in `globals.css`, plus a `/plakat/[id]` route that renders an MP dossier or the full standings as an A3/A2 poster and a per-MP PDF spis — enormous numerals, visible grid, index numbers, citation footer, QR code back to the live profile. Ahead of elections, NGOs and voters print and distribute physical dossiers; every poster is a sourced, dated artifact of the same data doctrine.
- **Why it's a moonshot**: It takes the product to the one distribution channel Czech municipal election season still runs on — paper — at near-zero marginal cost, because the design language was built for it; a poster on a village notice board reaches voters no web app ever will.
- **Grounded in**: `app/globals.css` is the single style origin so print overrides live in exactly one file; the token palette (`paper`/`ink`/`signal`) is print-safe by design; `docs/DESIGN.md` explicitly describes "poster numerals", "obr. N" captions and the Sutnar lineage; `app/layout.tsx`'s font trio (Archivo Black display, Plex Mono citations) are both print-licensed Google fonts; the profile dossier (`features/profile/`) is already structured as a "spis".
- **Path to implementation**:
  1. Add `@media print` rules to `globals.css` (hide nav/shell, force `paper` background, `ink` text, break rules) — one-file change, doable now.
  2. Add `app/plakat/[id]/page.tsx` composing the existing profile poster header + pillar bars at poster scale with a citation footer and QR.
  3. Verify with headless-Chrome print-to-PDF; document the A-series page setup.
  4. Add a "Vytisknout spis" affordance on profile pages.
  5. Batch script: render all 207 spisy to PDF for NGO distribution packs.
- **Dependencies / risks**:
  - Charts drawn on canvas (hemicycle, graph) need SVG/print fallbacks — start with the type-and-bars surfaces.
  - QR + printed claims raise the stakes on the citation gate; posters must render only verified facts.
- **What changes if we ship it**: The transparency data leaves the browser — printable, distributable MP dossiers turn the site into a physical campaign-season artifact.

## i18n & Number Formatting

### M1. The Jurisdiction Kernel — from Czech-first app to a deployable parliament-transparency platform
- **Tier**: 1
- **Category**: civic-network-effects
- **Feasibility**: low
- **Time-horizon**: quarters
- **What it is**: The i18n layer is already the cleanest seam in the codebase: a 2-locale config, deterministic no-Intl formatters, and a cookie-resolved request pipeline. Widen that seam from *locale* to *jurisdiction*: a `Jurisdiction` config (locale + chamber shape + number/date/currency conventions + source-adapter set + copy register) that the whole platform resolves through, exactly as it resolves `Locale` today. First proof: a Slovak deployment (NR SR has near-identical open data, same ČSN-style formatting, mutually intelligible market) running the same five modules on the same graph schema. Politicas stops being a Czech site and becomes the reference engine any country's watchdog community can stand up.
- **Why it's a moonshot**: One codebase serving N parliaments is a 10x-users claim with a concrete first step — and every added jurisdiction compounds the methodology's credibility (the scorer that survived two parliaments is harder to dismiss as politically tuned). Falsifiable: a second-country instance renders real data without forking `features/`.
- **Grounded in**: `lib/i18n/config.ts` (the `Locale` union + `isLocale` guard is the exact pattern to generalize), `lib/i18n/request.ts` (per-request resolution point), `lib/format.ts` (formatters already take `locale` as a parameter — no global state to untangle), and the adapter architecture in `lib/ingest/sources/` (per-source modules are already pluggable).
- **Path to implementation**:
  1. Introduce `lib/i18n/jurisdiction.ts` with a `Jurisdiction` record (chamber size, currency, formatter set, adapter list) and make `formattersFor` accept it — currently a pure-refactor step, CS-only, zero behavior change.
  2. Thread jurisdiction (defaulted to CZ) through the request resolution alongside locale.
  3. Parameterize the hardcoded chamber constants (207 MPs, PSP terms) out of loaders into the jurisdiction record.
  4. Write one NR SR source adapter as the existence proof.
  5. Stand up a `sk` instance behind a flag; recruit a Slovak watchdog partner to own data verification.
- **Dependencies / risks**:
  - Chamber-shape assumptions leak far beyond i18n (hemicycle geometry, club logic) — the audit in step 3 is the real cost.
  - Human-gated verification requires a per-country reviewer community; without a partner org, a second jurisdiction is dead data.
  - Genuinely quarters-scale; do not start before the CZ surfaces are wired to the real graph.
- **What changes if we ship it**: The product's ceiling moves from "Czech election resource" to "the open engine for parliamentary accountability," with each deployment strengthening every other's credibility.

### M2. Numbers That Testify — provenance-bound formatting emitting a machine-readable claim corpus
- **Tier**: 2
- **Category**: data-as-moat
- **Feasibility**: high
- **Time-horizon**: months
- **What it is**: Every figure already routes through one chokepoint (`lib/format.ts` / `useFormat`). Exploit that: add a `f.cite(value, sourceRef)` entry point returning not a string but a small element — the formatted number wrapped with schema.org `Claim`/`Observation` microdata (value, unit, dataset, cadence, retrieval date, methodology URL) and a hover affordance showing the citation. The whole site becomes a crawlable corpus of sourced factual claims: search engines, fact-checking pipelines (ClaimReview consumers), and LLM crawlers ingest politicas numbers *with their provenance attached*, so the citation travels wherever the number is quoted.
- **Why it's a moonshot**: It weaponizes the formatting chokepoint into structured-data distribution — politicas becomes the machine-readable source of record for Czech parliamentary facts, the layer every AI answer and fact-check about an MP resolves against. Falsifiable via rich-result/crawler pickup of the emitted structured data.
- **Grounded in**: `lib/format.ts` (single formatting origin, `Formatters` bundle trivially extends), `lib/i18n/useFormat.ts` (the client binding point), `features/shared/components/SourceNote.tsx` (the citation vocabulary already exists in the UI), and the provenance repository (`lib/db/pglite/repositories/provenance.ts`) that already stamps every fact with its source.
- **Path to implementation**:
  1. Add `formatCited`/`f.cite` to `lib/format.ts` + `useFormat.ts` returning a `<data value>` element with `itemProp` microdata — implementable today alongside the string formatters, fully backwards-compatible.
  2. Define the `SourceRef` shape by lifting what `SourceNote` already renders (dataset + cadence) and joining it to provenance rows.
  3. Migrate one module (CivicScore leaderboard) to `f.cite`; validate with Google's structured-data tester.
  4. Add a site-level JSON-LD `Dataset` catalog route describing the five modules' data.
  5. Migrate remaining modules; make `f.cite` the doctrine-preferred formatter (and the target the Custom-ESLint citation rule checks for).
- **Dependencies / risks**:
  - Microdata must never wrap pending-review facts — the `SourceRef` join has to respect the human gate.
  - schema.org vocabulary for statistical claims is loose; pick a minimal stable subset to avoid churn.
- **What changes if we ship it**: Politicas numbers become self-describing wherever machines read them — the provenance doctrine extends past the site's edge into search results, fact-check tooling, and AI answers.
