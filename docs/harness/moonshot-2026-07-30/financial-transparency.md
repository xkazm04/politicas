# Moonshots — Financial Transparency

> Group: Financial Transparency · Contexts: 3 · Proposals: 6

## BudgetMirror

### M1. Every Town's Mirror — all 6,254 municipalities on live MONITOR data
- **Tier**: 1
- **Category**: data-as-moat
- **Feasibility**: high
- **Time-horizon**: months
- **What it is**: BudgetMirror stops being a 10-town mock and becomes the national municipal-finance mirror: every Czech municipality (6,254 obcí) gets its own permalink (`/rozpocty/[ico]`), fed by the Ministry of Finance MONITOR open-data cube (FIN 2-12 M statements, published quarterly, keyed by IČO). The peer group is computed, not curated — population band × region × town-type — so "vs peer median" is a real statistical statement for every town in the country, and the debt/capex/saldo trio plus trend chart render exactly as today.
- **Why it's a moonshot**: It takes the module from ~10 hand-typed sample rows to ~6,254 live entities — a >600x coverage jump — and makes politicas the only Czech surface where any citizen can type their town and get a sourced, methodology-disclosed budget verdict. Falsifiable: ship = every valid municipal IČO resolves to a rendered mirror with a real peer median.
- **Grounded in**: `features/budget/BudgetMirrorPage.tsx` (MetricDuo, PEER_MEDIAN/METRIC_MAX and PEER_TREND are already derived from data, not hardcoded — the whole render is data-shape-agnostic over `Town[]`); `lib/civic/data.ts` (TOWNS/BUDGET_YEARS contract); the adapter pattern in `lib/ingest/sources/*.ts` and the repository pattern in `lib/db/pglite/repositories/`; graceful-null loader convention in `lib/db/loaderGuard.ts`.
- **Path to implementation**:
  1. Extract the `Town` shape into a loader boundary: add `features/budget/getBudgetData.ts` that returns the current TOWNS mock behind the same null-degrading loader convention every other module uses — the page stops importing `lib/civic/data` directly.
  2. Write `lib/ingest/sources/monitor.ts` — pull FIN 2-12 M + population from MONITOR's open API/CSV dumps for one region as a proof slice, normalized through `lib/ingest/normalize.ts`.
  3. Add a `municipality` node kind + budget-year rows to the PGlite schema (new repository, DDL migration in `lib/db/pglite/ddl.ts`), provenance-stamped like every other ingest.
  4. Implement the peer-group engine (population decile × kraj) as a pure, fixture-tested function in `lib/analysis/` — the disclosed methodology text on the page comes from this same module.
  5. Ingest all municipalities; add `app/rozpocty/[ico]/page.tsx` with generateStaticParams for the top-N towns and on-demand render for the tail.
  6. Wire town search into the existing town-picker chips (chips become "recent + searched").
- **Dependencies / risks**:
  - MONITOR data formats shift between years (rozpočtová skladba revisions) — the normalizer must pin a consolidation mapping and disclose it.
  - 6,254 × 6 years of rows is a real ingest volume for embedded PGlite — needs the same read-cap discipline as `KG_READ_CAP`.
- **What changes if we ship it**: BudgetMirror becomes the module with the largest addressable audience in the app — every Czech voter has a town, only 200 have an MP they follow.

### M2. Municipal Money Trail — join town budgets to the FollowTheMoney contract graph by IČO
- **Tier**: 2
- **Category**: intelligence-layer
- **Feasibility**: medium
- **Time-horizon**: months
- **What it is**: Every town in BudgetMirror is also a contracting authority in Registr smluv, keyed by the same IČO the money graph already joins on. This moonshot cross-references the two: a town's mirror gains a "kam tečou výdaje" panel — its largest suppliers, resolved against the existing `kg:company:*` nodes — and when one of those suppliers already carries a `linked_to` tie to an MP (or to a mayor's own firm, once executive roles land), that intersection surfaces as a provenance-stamped, `pending_review` lead. Stewardship stops being a footnote ("sytí dimenzi Správcovství… zatím se nepropisuje") and becomes a computed edge: municipality → contract → company → politician.
- **Why it's a moonshot**: It's the first cross-module inference the graph was built for — budget data and money-tie data answering a question neither can alone ("does this town's spending reach a politically tied firm?"), at 3–5x the investigative value of either module in isolation.
- **Grounded in**: `features/money/moneyLoader.ts` (`contractsByCompany`, `tiedCompanyIds` — the attribution discipline to reuse verbatim); the strict IČO-join resolver doctrine in `README.md` §① (drops rather than guesses); `features/budget/BudgetMirrorPage.tsx` stewardship note; `lib/db/pglite/repositories/kg.ts` edge machinery; the human-gate write path `features/money/reviewActions.ts`.
- **Path to implementation**:
  1. Add `contracting_authority_ico` to the contract-node props in the existing money ingest (`scripts/data-analysis/kg-money-ingest.ts` already reads Registr smluv rows that carry it — persist instead of dropping).
  2. Add municipality nodes (from M1's ingest or a minimal IČO+name seed) and `procures` edges municipality→contract, provenance-stamped.
  3. Pure fixture-tested deriver in `lib/analysis/`: per-town supplier aggregate + intersection with `tiedCompanyIds`; every intersection row is written `pending_review`, never auto-published.
  4. Render the supplier panel in BudgetMirror behind the same `data ? real : mock` toggle FollowTheMoneyPage uses.
  5. Route intersection leads into the `/penize/kontrola` queue as a new tie class so the existing console gates them.
- **Dependencies / risks**:
  - Contracting-authority IČO in Registr smluv is sometimes the town's subsidiary (technické služby) — the resolver must drop unresolved authorities, matching the existing drop-don't-guess rule.
  - Steward-vs-attributable discipline must extend to towns, or the panel repeats the exact overcounting bug batch-012 fixed.
- **What changes if we ship it**: BudgetMirror and FollowTheMoney become one investigation surface — a town page can hand a journalist a lead, not just a chart.

## Money Case Files & Human Review

### M1. The Verification Network — from one token to an accredited reviewer web
- **Tier**: 1
- **Category**: civic-network-effects
- **Feasibility**: medium
- **Time-horizon**: quarters
- **What it is**: The `/penize/kontrola` console today is a single-operator gate (one shared `REVIEWER_TOKEN`) in front of 211 pending ties — the human gate is the product's integrity core and its scaling bottleneck. This moonshot turns it into a verification network: named, accredited reviewers (journalists, watchdog NGOs like Hlídač státu / Transparency International), per-reviewer credentials, two-reviewer concordance required before any owner-operator tie flips to `verified`, and a public, append-only verification ledger page showing who verified what, when, with what note. Disagreements surface as their own honest state instead of being resolved silently.
- **Why it's a moonshot**: Review throughput scales with the civic community instead of one operator — 211 pending ties is weeks for one person and days for ten — and the public concordance ledger makes politicas' trust model *legible*, which no Czech transparency site currently offers. Falsifiable: ≥3 external reviewers actively clearing queue within a quarter of launch.
- **Grounded in**: `features/money/reviewActions.ts` (the auth model is explicitly documented as "simplest correct choice for this batch" — the seam is designed for replacement); `lib/db/pglite/repositories/review.ts` + `review_audit` (per-decision audit rows already exist); `features/money/reviewTypes.ts` (`resolveReviewOrder` tiers already sequence a real review session); `features/money/components/VerificationConsole.tsx`.
- **Path to implementation**:
  1. Replace the single env token with a reviewer table (name, role, credential hash, scope) in the review repository — `checkSharedToken` becomes `checkReviewer`, same constant-time discipline, same fail-closed rule.
  2. Extend `setTieReviewState` to record decisions per-reviewer and compute concordance state (`verified` requires 2 concurring confirms for owner-operator/manager classes; steward class keeps single-review).
  3. Add a "disagreement" state to `ReviewState` and render it honestly in the console and the ledger.
  4. Ship `/penize/kontrola/ledger` — the public read-only audit trail (reviewer name, decision, timestamp, note), fed straight from `review_audit`.
  5. Onboard 2–3 external reviewers on an invite basis; publish the accreditation criteria as methodology, like `TrailMethod` does for the trail.
- **Dependencies / risks**:
  - Reviewer identity + legal exposure: named reviewers on accusatory-adjacent content need clear terms; mitigated by the platform's existing "dated facts, never accusations" doctrine.
  - Concordance deadlock on a 2-reviewer pool — needs an escalation rule (editor-of-record) defined up front.
- **What changes if we ship it**: The human gate stops being a bottleneck and becomes the product's most defensible asset — a public, multi-party chain of custody for every published tie.

### M2. Evidence Packet Compiler — graph-assembled dossiers with a citation gate
- **Tier**: 2
- **Category**: foundational-primitive
- **Feasibility**: high
- **Time-horizon**: months
- **What it is**: Today a kauza is hand-written JSON dropped into `docs/data-analysis/case-money/payloads/` — the loader explicitly does "the LEAST possible transformation" and the corpus broke at n=3 by construction before discovery was added. This moonshot builds the compiler that makes n=50 kauz feasible: pick a tie in the console → the system assembles a draft evidence packet *entirely from graph facts* (role periods, contract lines with dates and amounts, registry deep-links, near-threshold clusters, the MP's votes in the period) into the exact `LeadDossier` shape; the reviewer then writes only the two prose columns (`whatSourcesSustain` / `whatSourcesDoNotSustain`), and a citation gate refuses to save any claim whose `sourceUrl` isn't among the packet's registry links — the anti-fabrication doctrine, applied to humans too. Published packets carry a content hash so any copy circulating in a newsroom is verifiable against the original.
- **Why it's a moonshot**: It collapses dossier production from days of manual sourcing to an afternoon of judgment writing — a 5–10x throughput jump on the platform's most sensitive, highest-value content, with *stronger* (machine-checked) sourcing than the hand-built originals.
- **Grounded in**: `features/money/getLeadDossiers.ts` (`isDossier` defines the target shape; discovery already handles arbitrary corpus size); `features/money/reviewTypes.ts::buildRegistryLinks`; `features/dashboard/datedFacts.ts` (the dated-fact assembly pattern to generalize); `features/money/moneyLoader.ts::loadMpMoneySlice` (already fetches per-MP ties + contract lines + periods on the index path); `features/money/KauzyPage.tsx` (renders any number of dossiers already).
- **Path to implementation**:
  1. Write a pure `compileEvidencePacket(pspId, ico)` in `lib/analysis/` that emits a claims-array skeleton from `loadMpMoneySlice` + registry links — fixture-tested against one existing hand-built dossier to prove shape fidelity.
  2. Add a "sestavit spis" action in the VerificationConsole that writes the draft packet (marked `draft: true`, invisible to `getLeadDossiers`).
  3. Build the annotation form (two prose columns + per-claim citation picker restricted to packet sources) behind the reviewer gate.
  4. Citation gate: publish is refused unless every claim's citation resolves to a packet source — mirror of the e-Sbírka anti-fabrication check.
  5. Stamp a SHA-256 of the canonical payload into the dossier and render it on `/penize/kauzy`.
- **Dependencies / risks**:
  - Prose quality still depends on the reviewer — the compiler must never auto-draft the sustain/not-sustain columns (that would cross the LLM-verdict line the README forbids).
  - Draft/published lifecycle needs care so `isDossier` never surfaces a draft.
- **What changes if we ship it**: Kauzy scale from 2 artisanal files to a production pipeline with machine-enforced sourcing — the platform can carry an election cycle's worth of leads.

## FollowTheMoney Graph

### M1. Vote-Collision Engine — "hlasoval o penězích své firmy," computed
- **Tier**: 1
- **Category**: intelligence-layer
- **Feasibility**: medium
- **Time-horizon**: quarters
- **What it is**: The graph holds all three ingredients of the ultimate conflict-of-interest question and never joins them: money ties (MP→company→contracts, with role validity periods), 406k ballots, and the bill→law graph with sponsors/amends edges. The Vote-Collision Engine computes, deterministically, every case where an MP cast a vote — during a validated role period — on a bill whose subject matter intersects their tied company's sector or contracting statute (via vote themes and the e-Sbírka-anchored law graph). Each collision is a dated, provenance-stamped fact written `pending_review`, rendered on the money graph as a pulsing third edge type (tie × vote), and it feeds the existing kauza and review pipelines rather than publishing itself.
- **Why it's a moonshot**: This is the question every journalist actually asks of a money graph, answered systematically across all 207 MPs × 406k ballots instead of one anecdote at a time — the product moves from "here are the ties" to "here is when the tie and the vote touched," which no Czech (arguably no European) public tool does with disclosed methodology.
- **Grounded in**: `features/money/moneyLoader.ts` (`roleValidFrom`/`roleValidTo`/`temporalStatus` already parsed onto every tie); `features/votetrack/getVoteThemes.ts` + `themeTypes.ts` (thematic classification of votes exists); `lib/analysis/law-verdict.ts` + `lib/ingest/sources/psp-legislation.ts` (bill→statute graph with the e-Sbírka anti-fabrication registry); LawWatch "Case-1 conflict flags" prove a first collision heuristic already ships; `features/money/MoneyGraph.tsx` hover-lit edge rendering to extend.
- **Path to implementation**:
  1. Fixture-tested pure function in `lib/analysis/`: intersect one MP's tie role-periods with their ballot dates — pure temporal overlap first, no sector matching yet (doable today entirely on existing rows).
  2. Add a sector mapping company→NACE (already in ARES data the ingest touches) and statute→theme, both as disclosed lookup tables, not inference.
  3. Batch script `scripts/data-analysis/kg-collision-ingest.ts` writes `collision` edges `pending_review` with full provenance (ballot id, bill id, tie edge, overlap window).
  4. Surface collisions in the review console as a new tier-0 class; nothing renders publicly until human-gated.
  5. Render verified collisions on `MoneyGraph` as the third edge type and as dated facts on `/penize/[pspId]`.
- **Dependencies / risks**:
  - Sector-to-bill matching is the credibility cliff — start with the narrow, defensible core (MP voted on a bill that amends the statute governing their company's actual contracts) and disclose the matching rule verbatim.
  - Collision ≠ wrongdoing; copy must carry the same "lead, never verdict" framing, enforced by the human gate.
- **What changes if we ship it**: FollowTheMoney becomes the reason politicas is cited in election-year reporting — the graph starts producing findings, not just displaying them.

### M2. The Trail Protocol — embeddable verified-fact cards and a country-adapter kit
- **Tier**: 2
- **Category**: platform-distribution
- **Feasibility**: high
- **Time-horizon**: months
- **What it is**: Every verified tie becomes a distributable artifact: a signed JSON fact (tie, class, amounts, role period, registry links, verification ledger entry) served from a public read-only endpoint, plus a server-rendered embeddable card (`/embed/tie/[pspId]/[ico]` — iframe/OG-image) that any newsroom can drop into an article; the card renders the fact with its citations and links back to the full trail. The `TrailMethod` four-step methodology ships alongside as the protocol spec, and the ingestion layer's adapter pattern is documented as a country-adapter kit: any polity with a company register, a contracts register, and roll-call data can stand up its own instance by writing adapters, not an app.
- **Why it's a moonshot**: Distribution stops being politicas' website and becomes every article that embeds a card — each embed is a backlink and a trust impression, and the adapter kit turns a Czech app into a category (falsifiable: ≥1 external newsroom embed and ≥1 non-Czech adapter attempt within two quarters).
- **Grounded in**: `features/money/components/TrailMethod.tsx` (the methodology is already productized as four disclosed steps); `features/money/getMoneyData.ts` + `moneyTypes.ts` (`MoneyTie` is already a clean serializable projection); `loadMpMoneySlice` (index-path read is cheap enough for per-embed rendering); `lib/ingest/sources/` (adapters are already per-source modules with a shared normalize layer — the kit is documentation plus one interface extraction); verification provenance in `lib/db/pglite/repositories/review.ts`.
- **Path to implementation**:
  1. Add `app/api/facts/tie/[pspId]/[ico]/route.ts` serving the verified-only `MoneyTie` projection with registry links and last-review metadata — verified ties only, pending never leaves the house.
  2. Server-rendered embed route + OG image (Next's ImageResponse) for the card; noindex on pending, canonical link to `/penize/[pspId]`.
  3. Sign the JSON payload (content hash + timestamp) so embedded facts are tamper-evident.
  4. Extract the implicit adapter interface from `lib/ingest/sources/*.ts` into a documented `SourceAdapter` type; write the country-adapter guide against it.
  5. Pitch two Czech newsrooms the embed during an active news cycle; instrument referrals.
- **Dependencies / risks**:
  - An embedded card outlives its verification state — cards must re-render live from the API, never cache a since-rejected tie.
  - API abuse/scraping is fine (it's open data) but needs the same read-cap discipline as internal loaders.
- **What changes if we ship it**: The trail leaves the site — politicas becomes infrastructure other people's journalism runs on, in Czechia first and as a template beyond it.
