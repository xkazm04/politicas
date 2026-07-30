# Moonshots — Data Layer

> Group: Data Layer · Contexts: 5 · Proposals: 10

## Sample Data Fallback

### M1. Parliament-in-a-Box: the sample layer becomes the portable onboarding contract for any parliament
- **Tier**: 1
- **Category**: platform-distribution
- **Feasibility**: medium
- **Time-horizon**: quarters
- **What it is**: Formalize `lib/civic/` — the deterministic, invariant-tested, self-consistent synthetic chamber (200 MPs, pillars, roll calls, money ties, state graph, all pure functions with SSR==CSR guarantees) — into a versioned, published **chamber data contract + synthetic generator**. Any country's watchdog group onboards their parliament by (a) generating a seeded synthetic chamber in their party structure to light up every politicas surface on day one, then (b) writing adapters to the same shape. The mock stops being scaffolding and becomes the franchise kit.
- **Why it's a moonshot**: Falsifiable claim: a third party with no politicas knowledge can render all five modules for a *different* parliament in under a week, because the UI is already proven to run entirely from this contract — that is the current production state.
- **Grounded in**: `lib/civic/data.ts` (typed MP/Pillar/RollCall/MoneyTie shapes), `lib/civic/leaderboard.ts` (pure seeded LCG generation with test-pinned invariants: anchors, party seat counts, composite==score), `lib/civic/stateGraph.ts` (topology-only nodes, i18n-keyed labels — already translation-ready), `lib/civic/votes.ts` (discipline math computed, not hardcoded).
- **Path to implementation**:
  1. Extract the type layer of `data.ts` into a `@politicas/chamber-contract` module inside the repo (types + invariant test suite), with `lib/civic` re-exporting from it — zero behavior change.
  2. Parameterize `leaderboard.ts`'s generator on a `ChamberSpec` (seat counts, party palette, region list, name pools) instead of the hardcoded Czech constants.
  3. Add a second `ChamberSpec` fixture (e.g. a fictional 150-seat chamber) and assert every invariant holds — proving the generator is spec-driven.
  4. Publish the contract + generator as a documented package with a "bring your parliament" guide.
  5. Recruit one pilot (Slovak NRSR is the natural first: similar open-data culture, psp.cz-like dumps).
- **Dependencies / risks**:
  - The contract must track the real-graph loaders' shapes too, or it forks from what the surfaces actually consume as the mock retires.
  - Franchise partners need the ingestion story (separate group) eventually — this ships the front half only.
- **What changes if we ship it**: politicas stops being a Czech app and becomes the reference implementation of a parliamentary-transparency platform.

### M2. The Counterfactual Chamber: reader-driven what-if engine over the deterministic scorer
- **Tier**: 2
- **Category**: trust-layer
- **Feasibility**: high
- **Time-horizon**: weeks
- **What it is**: Because every ranking is a pure function of published pillars and weights (`composite(pillars) == score` is a tested invariant), expose that purity to the reader: a "Přepočítej si to" instrument where anyone re-weights the four pillars, excludes pending-review money ties, or drops a dimension — and watches all 200 ranks re-sort live, deterministically, with a shareable URL encoding their weight vector. Methodology transparency stops being a footnote and becomes a playable proof.
- **Why it's a moonshot**: No accountability site anywhere lets readers falsify the editorial weighting themselves; the 10x claim is that "I re-ran it with my own weights" converts skeptics — the largest non-user segment for scoring products — into sharers.
- **Grounded in**: `lib/civic/data.ts` (PILLARS with published weights summing to 1; landing already recomputes score live from pillars), `lib/civic/leaderboard.ts` (pure generation — re-ranking under new weights is a `sort` away), `lib/analysis/contribution.ts` (the real scorer exposes all six components + saturation constants, so the same instrument ports to real data unchanged).
- **Path to implementation**:
  1. Add a pure `recomposite(rows, weights)` helper beside `leaderboard.ts` with a test that default weights reproduce the pinned ranking exactly.
  2. Build the weight-slider instrument as a client island on `/zebricek`, state in the URL query.
  3. Show delta arrows against the official ranking, with the official weights always one click away (the brand rule: the editorial choice stays disclosed, not replaced).
  4. When CivicScore wires to the real graph, feed the same instrument from `ContributionProfile.components` — the six real dimensions.
- **Dependencies / risks**:
  - Must render as "your simulation," never as an alternative official score — copy discipline required (reuse the `public-copy` gate mindset).
- **What changes if we ship it**: the methodology page becomes an instrument, and every argument about "unfair weighting" turns into a link to a reader's own re-run.

## Scoring & Verdict Copy

### M1. The Open Scoring Standard: reproducible-build discipline for political scores
- **Tier**: 1
- **Category**: foundational-primitive
- **Feasibility**: medium
- **Time-horizon**: months
- **What it is**: Elevate `computeContribution` from an internal library to a **versioned, independently re-runnable scoring standard**: a pinned scorer version + the psp.cz dump checksums + a signed manifest published next to every score, so any journalist, party, or rival can re-derive all 207 numbers bit-for-bit from public data. Scores ship like software releases — `contribution-index v1.4, inputs sha256:…, reproduce: npx politicas-score` — and a disagreement becomes a diff, not a dispute.
- **Why it's a moonshot**: Falsifiable 10x claim: when an MP's office disputes their score, the response is a one-command reproduction — no other MP-ranking in Europe can survive that challenge, and surviving it publicly is what makes a score citable by mainstream press before an election.
- **Grounded in**: `lib/analysis/contribution.ts` (pure, exported weights/saturations, six exposed components, documented corrections with measured impact — the 2026-07-29 distinct-organ fix note is already changelog-grade), `lib/analysis/contribution-trend.ts` (honesty contract: never authors numbers), `lib/analysis/quality.ts`, provenance quartet in `lib/db/pglite/ddl.ts` (input checksums already conceptually present via `source_url`/`fetched_at`).
- **Path to implementation**:
  1. Add `SCORER_VERSION` to `contribution.ts` and stamp it into the stored analysis props alongside the score (one-line writer change in the ingest scripts).
  2. Emit a per-run manifest (scorer version, dump URLs, dump hashes, row counts) from the contribution-ingest script into the store's provenance tables.
  3. Publish a `docs/methodology/contribution-vX.md` changelog generated from the constants + the correction notes already living in code comments.
  4. Package a standalone `reproduce` CLI: download dumps → run scorer → diff against published manifests.
  5. Render the manifest hash + version on `/poslanec` next to the score (SourceNote already carries citations).
- **Dependencies / risks**:
  - psp.cz dumps mutate in place — the manifest must archive the dump hash at ingest time or reproduction drifts through no fault of the scorer.
  - Version discipline: any constant change must bump the version or the standard is theater.
- **What changes if we ship it**: politicas' scores become the first politically-load-bearing numbers in Czech media that are cheaper to verify than to doubt.

### M2. The Civic Claim Gate as a product: fabrication-proofing for every Czech newsroom
- **Tier**: 1
- **Category**: trust-layer
- **Feasibility**: medium
- **Time-horizon**: quarters
- **What it is**: The project has quietly built the hardest part of LLM-assisted journalism: a deterministic gate that rejects hallucinated statutes (every `č. N/RRRR Sb.` checked against the 24,774-law e-Sbírka registry), uncited accusations, drifted schemas, and internal jargon leaking into reader copy. Extract this stack (`law-verdict` citation gate + `public-copy` jargon gate + `language-gate`) into a standalone **claim-gate service**: paste or POST any Czech civic-legal text and get back a pass/fail with the exact fabricated citation or uncited accusation flagged. Newsrooms, NGOs, and other transparency projects run their LLM output through it before publishing.
- **Why it's a moonshot**: The falsifiable claim: a gate that catches 100% of fabricated Sbírka citations (it is a registry lookup, not a heuristic) is the difference between "LLMs can't be used for legal-adjacent journalism" and "they can" — for an entire language market, not one app.
- **Grounded in**: `lib/analysis/law-verdict.ts` (the four-rule gate + JSON schema, already dependency-light), `lib/analysis/public-copy.ts` (measured leak history — 436 field-instances caught — proving the gate's necessity and its dual persist/render-time enforcement pattern), `lib/analysis/verdict.ts` (the drift-rejecting schema discipline), the e-Sbírka registry ingest referenced in `README.md`.
- **Path to implementation**:
  1. Factor the statute-existence check in `law-verdict.ts` to accept an injected law-registry lookup interface (it already takes graph-known laws; make the e-Sbírka set a first-class injectable).
  2. Add a thin internal route (`/api/gate`) exposing `validate(text | verdict)` → structured violations, dogfooded by the existing forensics scripts.
  3. Write the gate's public spec: what it guarantees (citation existence, citation presence) and what it never claims (truth of the argument).
  4. Open the endpoint read-only with rate limits; publish the violation taxonomy.
  5. Partner with one newsroom (Hlídač státu is the natural ally — already a data source) to pilot it in their workflow.
- **Dependencies / risks**:
  - Scope honesty: the gate verifies citations exist, not that they support the claim — the product copy must never oversell this or the trust layer damages trust.
  - e-Sbírka registry freshness becomes an SLO once external users depend on it.
- **What changes if we ship it**: politicas becomes infrastructure other watchdogs stand on, and its anti-fabrication doctrine becomes the market norm rather than a house rule.

## Knowledge Graph Domain Model

### M1. Tripwires: the graph stops being a record and starts being a watchman
- **Tier**: 1
- **Category**: intelligence-layer
- **Feasibility**: medium
- **Time-horizon**: months
- **What it is**: Deterministic standing queries over the knowledge graph that fire when the *next ingest* changes the answer: a new Registr-smluv contract lands at a company with a `linked_to` edge to a sitting MP; a `rapporteur` assignment appears on a bill amending a law that an MP-linked company's sector depends on; a rebellion rate crosses its threshold on a money-tied MP. Each tripwire emits a dated, provenance-stamped lead into the review queue and — once human-gated — into subscribable public feeds (per-MP RSS, per-registry webhooks). Journalists subscribe to the *crossover* no human has time to watch: 73 MPs × 196 companies × every new contract, checked on every refresh.
- **Why it's a moonshot**: The falsifiable 10x: today a journalist finds an MP-company-contract trail by manual cross-register research measured in days; a tripwire surfaces it in the first ingest after publication — the platform moves from answering questions to asking them first.
- **Grounded in**: `lib/analysis/kg-money.ts` (the IČO join + human gate — tripwire output reuses `pending_review` verbatim), `lib/analysis/kg.ts` (rebellion/co-voting thresholds as named constants — the alert conditions already exist as pure functions), `lib/analysis/kg-verdict.ts` (`rapporteur`, `owns_stake`, `concerns` edge rels — the cross-case vocabulary is already in the schema), `lib/kg/sourceLinks.ts` (every alert links to its registry page by stored identifier).
- **Path to implementation**:
  1. Add a pure `lib/analysis/tripwires.ts`: `(graphBefore, graphAfter) → Lead[]`, fixture-tested like `kg.ts`, starting with one rule — "new `supplies` edge into a company with any `linked_to` edge".
  2. Wire it into the money-ingest script as a diff pass over the edges it just wrote (it already knows what changed).
  3. Persist leads as `pending_review` kg facts routed into the existing verification console queue.
  4. Render gated leads as a dated feed on `/penize/kauzy`; add per-MP RSS.
  5. Grow the rule set: rapporteur-conflict, rebellion-spike, ownership-chain (`owns_stake`) changes.
- **Dependencies / risks**:
  - Ingest cadence bounds alert latency — the value scales with refresh frequency (needs a scheduled ingest, currently manual scripts).
  - Alert fatigue: rules must stay few and high-precision or the review queue drowns.
- **What changes if we ship it**: politicas becomes the thing that *notices* — the first system a Czech journalist checks in the morning.

### M2. The Open-Data Quality Atlas: federate the context catalog beyond one corpus
- **Tier**: 3
- **Category**: data-as-moat
- **Feasibility**: high
- **Time-horizon**: months
- **What it is**: `context-model.ts` already encodes something nobody else has: machine-readable institutional memory about Czech open data — per-source known-issues ("birth 1900-01-01 is a sentinel", "club ≠ party_list", "far-future placeholder dates"), deterministic slice stats, lineage to upstreams, and a proven content-transparent catalog transport (`ContextProvider`, byte-identical A/B). Turn this into a published **quality atlas of Czech public data**: every source politicas ingests gets a public page — coverage, freshness, known traps, deterministic quality scores — served from the same `SliceContext` shape, and the catalog accepts contributed corpora from other civic-tech projects.
- **Why it's a moonshot**: Every Czech civic-tech project independently rediscovers the same data traps; the falsifiable claim is that publishing the trap list + live quality stats makes politicas the mandatory first stop before anyone touches psp.cz/ARES/Registr smluv — the moat is accumulated institutional memory, which compounds and cannot be scraped.
- **Grounded in**: `lib/analysis/context-model.ts` (`SOURCE_DOCS` known-issues corpus, `SliceStats`, URN/lineage builders), `lib/analysis/context-provider.ts` (two interchangeable delivery arms, parity-tested — a public read arm is a third trivial consumer), `scripts/data-analysis/lite-serve.ts` (a live OpenAPI catalog already confirmed over HTTP).
- **Path to implementation**:
  1. Add a `/data` route that renders `SOURCE_DOCS` + latest `SliceStats` per source through `DirectContextProvider` — pure read, no new data.
  2. Add per-source freshness badges from the stored slice `freshness` fields.
  3. Publish the catalog read-only over the existing Lite OpenAPI surface.
  4. Define a contribution format so external projects can submit known-issues entries (reviewed like everything else).
- **Dependencies / risks**:
  - Known-issues claims are assertions about third-party publishers — each needs its provenance line kept current (the field already exists).
- **What changes if we ship it**: politicas' data layer becomes a public good other projects cite, link, and depend on — distribution earned through generosity.

## PGlite Repositories

### M1. The Tamper-Evident Ledger: hash-chain the audit trail and publish the roots
- **Tier**: 1
- **Category**: trust-layer
- **Feasibility**: high
- **Time-horizon**: weeks
- **What it is**: The review path is already audit-first (`review_audit` row written before the edge flips) and every table carries the provenance quartet. One structural upgrade makes the whole thing **tamper-evident**: each `review_audit` row includes the hash of the previous row (a hash chain), ingest runs commit a Merkle root over their written rows, and the heads are published — on the site, and periodically anchored somewhere external (a signed git tag, a tweet, a newspaper's notary column). Then "politicas quietly edited a verdict after the fact" becomes cryptographically checkable by anyone, forever. For a product whose only asset is trust, this is the vault door.
- **Why it's a moonshot**: The falsifiable claim: no accusation of retroactive manipulation can survive a published chain — and being the only political-accountability site that can *prove* its review history is intact is a categorical, not incremental, trust position (court-grade, FOIA-grade, election-dispute-grade).
- **Grounded in**: `lib/db/pglite/repositories/review.ts` (audit-first transaction — the chain slots into the existing insert), `lib/db/pglite/repositories/provenance.ts` (`ingest_run` as the natural Merkle-commit unit), `lib/db/pglite/ddl.ts` (provenance quartet on every table; `raw jsonb` keeps the leaves), `lib/db/pglite/internals.ts` (single writer path — all writes already funnel through few chokepoints).
- **Path to implementation**:
  1. Add `prev_hash` + `row_hash` columns to `review_audit`; compute `row_hash = sha256(prev_hash ‖ canonical-json(row))` inside the existing transaction in `review.ts`.
  2. Add a pure `verifyChain(rows)` function + test with a deliberately mutated fixture.
  3. On `finishIngestRun`, compute and store a Merkle root over the run's written row hashes.
  4. Expose current heads in the admin console's vault-heads panel (the panel name suggests this was foreseen) and on a public `/integrita` page.
  5. Anchor heads externally on a schedule (signed tag in the public repo is the zero-infra start).
- **Dependencies / risks**:
  - Canonical JSON serialization must be pinned (key order, number formatting) or verification breaks across runtimes.
  - A chain is only as convincing as its external anchors' cadence.
- **What changes if we ship it**: the human gate stops being a promise and becomes a proof.

### M2. The Bitemporal Graph: every claim gets a history, every surface gets a time slider
- **Tier**: 2
- **Category**: foundational-primitive
- **Feasibility**: medium
- **Time-horizon**: months
- **What it is**: Today `upsertKgNodes`/`upsertKgEdges` overwrite in place — re-running an ingest updates rows, and yesterday's graph is gone. Make `kg_node`/`kg_edge` bitemporal: keep the current tables as the serving view, but append every superseded version to `kg_node_history`/`kg_edge_history` with `recorded_at` spans. Then politicas can answer the questions accountability actually turns on: *when* did this tie appear, what did the graph say the week before the vote, how did an MP's score move as corrections landed — and every profile gets an honest "as of" slider instead of an eternal present.
- **Why it's a moonshot**: Political accountability is inherently temporal ("what was known when") and no Czech transparency source can replay its own past; the falsifiable claim is that election-eve journalism will cite politicas' *history* — "this tie was pending review for 4 months" — which no snapshot product can produce.
- **Grounded in**: `lib/db/pglite/ddl.ts` (natural keys + upsert-in-place discipline — the exact place history is currently lost, and the exact hook to capture it), `lib/db/pglite/repositories/kg.ts` (`upsertKgEdges` already dedupes on the (src,rel,dst) triple inside one transaction — a `insert into … history select … where changed` is one statement away), `KgNodeRow.firstSeenPass` (temporal intent already in the schema), `lib/db/pglite/mappers.ts`.
- **Path to implementation**:
  1. Add history tables to `ddl.ts` mirroring `kg_node`/`kg_edge` + `recorded_from`/`recorded_to`.
  2. In the upsert transactions in `kg.ts`, insert the superseded row into history *when its content hash differs* — no writer call-site changes.
  3. Add `getKgAsOf(ts)` reads to the repository (serving tables union history filtered by span).
  4. Backfill nothing; history accrues from the next ingest (honest: "recorded since 2026-08").
  5. Surface first on the money case files: "review timeline" per tie, joining `review_audit` (already timestamped) with edge history.
- **Dependencies / risks**:
  - Storage growth on the 150k+ `supplies` edges — the changed-content-hash guard is load-bearing, not optional.
  - `raw jsonb` duplication in history should be elided (store deltas or null the raw).
- **What changes if we ship it**: the graph becomes a record of *knowledge over time*, which is what journalism, courts, and post-election audits actually need.

## PGlite Store & Runtime

### M1. The Uncensorable Instrument: ship the whole graph into the reader's browser
- **Tier**: 1
- **Category**: interface-expansion
- **Feasibility**: medium
- **Time-horizon**: quarters
- **What it is**: PGlite is WASM Postgres — the store already runs the full civic graph in-process with zero infra. Flip where that process lives: publish the `.pglite` data directory as a signed, versioned snapshot, and add a client driver so the *reader's browser* downloads the graph once (IndexedDB-persisted) and runs every query locally. politicas becomes a static site + a database file: offline-capable, CDN-distributable, mirrorable by anyone, and impossible to take down by pressuring one server — the property that matters most for an accountability product in an election year. The Store facade means feature loaders don't change; only the driver behind `getStore()` does.
- **Why it's a moonshot**: The falsifiable claim: a transparency site whose entire evidence base can be mirrored from a torrent and *queried* offline is categorically harder to suppress or DDoS than any server-rendered rival — and "download the database, verify it yourself" is the logical endpoint of provenance-first.
- **Grounded in**: `lib/db/pglite-store.ts` (PGlite IS the browser tech — the server-only guard at the top is policy, not physics), `lib/db/store.ts` + `lib/db/config.ts` (the driver indirection was explicitly built so a new backend is "a new file, not a rewrite"; a `pglite-browser` driver is that file), `lib/db/readiness.ts` (floors gate which snapshots are publishable), the ~few-hundred-MB graph scale (7k people, 406k ballots — within IndexedDB budgets after pruning `raw`).
- **Path to implementation**:
  1. Add a snapshot script: copy `.pglite`, strip `raw jsonb` and non-serving tables, tar + sha256 + sign — measure the size (this alone is a shippable "download the data" feature).
  2. Add `DbDriver = "pglite" | "pglite-browser"` in `config.ts`; implement the browser driver against PGlite's IdbFs, loading the published snapshot.
  3. Pick one read-heavy surface (Graph Playground) as the pilot client-side consumer through the same repository interfaces.
  4. Add snapshot-version pinning + integrity check on load (sha verified in the client).
  5. Expand surface-by-surface; keep SSR as the no-JS fallback.
- **Dependencies / risks**:
  - Snapshot size after pruning is the go/no-go gate — measure in step 1 before committing.
  - Review console and ingest stay server-side (single-writer discipline per `config.ts`); this is a read-replica architecture, and the copy must say so.
- **What changes if we ship it**: every reader holds the evidence, and taking politicas offline stops being possible.

### M2. Data Releases: readiness floors become a public, versioned release train
- **Tier**: 2
- **Category**: data-as-moat
- **Feasibility**: high
- **Time-horizon**: weeks
- **What it is**: The runtime already knows what "good data" means — `CARDINALITY_FLOORS` gate serving, `storeReady` degrades loudly, `ingest_run` records every write with status and row counts. Promote that private discipline into a **public release train**: nightly (or per-ingest) the store cuts a *data release* — `civic-graph 2026.07.30` with a manifest (row counts per kind vs floors, ingest-run lineage, source freshness, diff vs previous release) — published on a status page and as downloadable artifacts. Floors become release gates: a release that fails a floor is marked degraded and never becomes `latest`. Researchers, NGOs, and the browser driver (M1) all consume pinned releases instead of a mutable now.
- **Why it's a moonshot**: The falsifiable claim: treating the graph as versioned releases rather than a live database is what turns one app's data layer into infrastructure — the difference between "politicas said" and "per civic-graph release 2026.07.30, reproducible by anyone," and it multiplies every downstream moonshot (browser snapshots, tripwires, the atlas) by giving them a stable artifact to pin.
- **Grounded in**: `lib/db/readiness.ts` (floors + the documented "raise floors alongside major ingests" practice — already a release-gate mindset), `lib/db/loaderGuard.ts` (degradation observability — the status page is its public face), `lib/db/pglite/repositories/provenance.ts` (`ingest_run` + `source_release` rows are the manifest's raw material, already stored), `lib/db/config.ts` (the copy-the-datadir pattern for scripts is the snapshot mechanism).
- **Path to implementation**:
  1. Write a release-cut script: run `storeReady` across all floor kinds, collect ingest-run + per-kind counts, emit `release-manifest.json` — no new tables needed.
  2. Add a public `/stav-dat` page rendering the latest manifest: per-kind counts vs floors, source freshness, last ingest status.
  3. Store manifests in the repo (or object storage) with a `latest` pointer that only advances on green.
  4. Attach the pruned snapshot artifact (shared work with M1 step 1) to each green release.
  5. Add a release diff section to the manifest (rows added/changed per kind) — the changelog journalists will actually read.
- **Dependencies / risks**:
  - Needs a scheduled ingest to be a *train* rather than occasional tags; manual cadence still works but undersells it.
- **What changes if we ship it**: the data layer gets a public heartbeat, and every external consumer — including politicas' own future clients — builds against versioned, floor-certified releases.
