# Moonshots — Data Ingestion

> Group: Data Ingestion · Contexts: 3 · Proposals: 6

## Admin Console

### M1. Deník důkazů — the review console becomes a public evidence wire
- **Tier**: 1
- **Category**: trust-layer
- **Feasibility**: high
- **Time-horizon**: months
- **What it is**: Every decision that passes the human gate (`review_audit` rows, tie verifications, forensic verdict sign-offs) automatically emits a citable, provenance-stamped bulletin into a public, append-only "evidence journal": *what fact was verified, from which source bytes, by which reviewer role, on which date* — published as a page, an RSS/Atom feed, and a JSON API journalists and watchdog NGOs can subscribe to. The admin console stops being a private mirror of the queue and becomes the newsroom back office of a public wire service: the gate itself is the publication event.
- **Why it's a moonshot**: No Czech transparency project publishes its *verification decisions* as a first-class, machine-readable feed; if newsrooms start citing "Politicas evidence bulletin #N" instead of re-deriving facts, the human gate becomes the product — falsifiable by counting external citations/subscribers of the feed.
- **Grounded in**: `features/admin/getAdminData.ts` already assembles exactly the needed stream (`loadReviewHub` — `review_audit` via `store.listReviewAudit`, tie states on `linked_to` edges, forensic verdicts on `bill` nodes); `features/money/reviewActions.ts` is the single choke-point where decisions are written; provenance columns (`source`, `source_url`, `fetched_at`) exist on every row (`lib/ingest/sources/psp.ts` Prov).
- **Path to implementation**:
  1. Extend `reviewActions.ts` so every gate decision also writes a structured `bulletin` row (fact, sources, decision, timestamp) — the data already flows through this one function.
  2. Add a public `/dokazy` route rendering the bulletin ledger in the Konstrukt system, newest first, each entry linking its source URLs.
  3. Serve the same ledger as RSS + JSON (`app/dokazy/feed.xml`, `/api/bulletins`), stamped with the licence-required source citations.
  4. Backfill from existing `review_audit` history so the journal opens non-empty.
  5. Add per-MP and per-case scoped feeds (follow one dossier).
- **Dependencies / risks**:
  - Accusatory-claim discipline: bulletins must render the same gated copy as the public modules, never raw reviewer notes.
  - Feed stability contract (IDs, permalinks) becomes a public API you can't casually refactor.
- **What changes if we ship it**: Politicas shifts from "a site you visit" to "a source you subscribe to," and the human gate becomes externally auditable.

### M2. Loop mission control — machine-readable loop state that can drive, not just watch
- **Tier**: 2
- **Category**: foundational-primitive
- **Feasibility**: medium
- **Time-horizon**: months
- **What it is**: Replace the hand-maintained, shape-drifting ledgers (`ledger.json` × 3 divergent schemas, regex-parsed `frontier.md`, `graph-log.md` pass headings) with one first-class loop-state store in PGlite: cases, batches, units, frontier items and pass log as typed rows the loops *write through* rather than leave behind. The admin console then flips from best-effort archaeology to real mission control: resume a paused loop, assign the next batch, and watch unit-level progress live — with the current markdown vault generated *from* the store as the human-readable artifact, not the source of truth.
- **Why it's a moonshot**: It converts the accountability engine from "three bespoke scripts a human shepherds" into an orchestrable system — the prerequisite for running 10x more cases (all 207 MPs' money trails, every bill's forensics) without 10x operator time.
- **Grounded in**: `features/admin/getAdminData.ts` documents the exact pain (three bespoke `loadMoneyProgress`/`loadEffortProgress`/`loadLawProgress` parsers, "degrade to partial, never crash"); `features/admin/adminTypes.ts` already defines the unified shape (`LoopCaseProgress`) the store should natively hold; the PGlite repository pattern exists in `lib/db/pglite/repositories/`.
- **Path to implementation**:
  1. Define `loop_case` / `loop_batch` / `frontier_item` tables + a repository, mirroring `LoopCaseProgress` — DDL lives beside the existing repos.
  2. Write a one-time importer that parses the three current ledger shapes (reusing the parsers already in `getAdminData.ts`) into the store.
  3. Point `getAdminData.ts` at the store first, files as fallback — the page's null-tolerant contract makes this a safe cutover.
  4. Give the loop scripts (`scripts/data-analysis/*`) a tiny write-through client so future batches land in the store natively.
  5. Add operator actions on `/admin` (open batch, close frontier item) as server actions with the same audit trail the review gate uses.
- **Dependencies / risks**:
  - Loop drivers are partly human/LLM sessions — the write-through client must be trivial to call from a script or it won't be used.
  - The markdown vault is also documentation; keep generating it or lose the narrative record.
- **What changes if we ship it**: The paused case loops become resumable, parallelizable production machinery instead of artisanal one-off campaigns.

## Ingestion Normalization

### M1. `czech-civic-data` — the shared standard library for Czech civic tech
- **Tier**: 1
- **Category**: civic-network-effects
- **Feasibility**: high
- **Time-horizon**: quarters
- **What it is**: Extract the normalization layer — the escape-correct UNL parser, windows-1250 fatal decoder, dependency-free ZIP reader, Czech ascii-fold table, and the documented psp.cz vote/outcome vocabularies (including the post-1995 "K merges abstain/not-voting" footgun) — into an open-source, versioned package + conformance fixture suite that any Czech transparency project (Hlídač státu, demagog.cz, academics, newsroom data desks) builds on. Politicas becomes the reference implementation of "how to read Czech parliamentary data correctly."
- **Why it's a moonshot**: Every Czech civic-data project today re-implements (and re-breaks) UNL escapes, cp1250, and the vote-code semantics; owning the canonical parser makes politicas the upstream of an ecosystem — falsifiable by external adoption (dependents, PRs, citations in other projects' code).
- **Grounded in**: `lib/ingest/unl.ts` (escape-aware split, fatal cp1250 decode, validated date parsers), `lib/ingest/zip.ts` (zip-bomb-capped, loud-fail reader), `lib/ingest/normalize.ts` (fold table, `voteChoice`/`voteOutcome`/`voteKind` vocabularies, 1900-01-01 birth sentinel) — all three are already pure, dependency-free, and documented against the publisher's own schema pages.
- **Path to implementation**:
  1. Move the three files into `packages/czech-civic-data/` inside the repo (workspace package), with politicas importing it — zero behavior change, provable via `npm run check`.
  2. Port the existing colocated tests + add golden fixtures cut from real dumps (a pipe-escaped title, a K-code term, the birth sentinel).
  3. Write the README as a data doctrine document: the vote-code table, the "missing beats wrong" rules, the licence citation requirement.
  4. Publish to npm under an open licence; wire a CI conformance run against a live psp.cz dump nightly.
  5. Invite the first external adopter (Hlídač státu's parser is a known counterpart) and accept vocabulary PRs.
- **Dependencies / risks**:
  - Public API freeze: once published, the vocabularies become contracts; version discipline needed.
  - Maintenance duty is real — mitigated by the code already being small, pure, and fixture-tested.
- **What changes if we ship it**: Politicas stops being one app and becomes infrastructure other watchdogs stand on — the strongest possible moat and credibility signal.

### M2. Byte-level provenance — click any number, see the source line
- **Tier**: 2
- **Category**: trust-layer
- **Feasibility**: medium
- **Time-horizon**: months
- **What it is**: Extend the normalization pipeline so every ingested row carries a *reproducibility receipt*: the sha256 of the source dump, the member file name, the physical line number, and the raw line text — persisted next to the existing `raw` column. The UI's SourceNote then upgrades from "source: psp.cz" to a expandable proof: the literal windows-1250 UNL line the number came from, plus the archive hash anyone can re-download and verify. "Every rendered number carries its source" becomes "every rendered number carries a cryptographic, independently checkable derivation."
- **Why it's a moonshot**: No accountability site lets a skeptical reader (or a sued-party's lawyer) verify a claim down to the publisher's own bytes in one click; it converts trust from reputation into reproducibility — falsifiable by an external party successfully re-deriving any displayed figure.
- **Grounded in**: `lib/ingest/unl.ts` `parseUnl` already iterates physical lines (line index is free); `lib/ingest/sources/psp.ts` already builds a per-row `raw` object and Prov (`source`, `sourceUrl`, `fetchedAt`) — the receipt is three more fields through the same funnel; `lib/ingest/zip.ts` returns named members, hashable at read time.
- **Path to implementation**:
  1. Make `parseUnl` optionally yield `{row, lineNo, rawLine}`; thread a `dumpSha256` through `Prov` (computed once per zip in the adapter).
  2. Add the receipt fields to the row types (`lib/db/types.ts`) and DDL; populate on the next full re-upsert (snapshot ingest makes backfill automatic).
  3. Expose the receipt in the graph/domain reads (`lib/analysis/kg.ts` source-link path) alongside the existing `sourceLinks`.
  4. Upgrade `features/shared/components/SourceNote.tsx` with an expandable "Ověřit" panel showing member · line · raw text · archive hash + re-download URL.
  5. Publish a tiny `verify.ts` script (download dump → hash → extract line → compare) as the public reproduction recipe.
- **Dependencies / risks**:
  - Storage growth from raw-line duplication (bounded: ballots are the big table — store receipts per vote event, not per ballot, if needed).
  - Snapshot republication means line numbers drift daily; the receipt must pin the *hashed archive*, not "latest."
- **What changes if we ship it**: Politicas' provenance claim becomes mechanically checkable by anyone, which is the difference between "we cite sources" and "you don't have to trust us."

## Source Adapters

### M1. Parliament-agnostic adapter kit — the ingestion engine goes multi-country
- **Tier**: 1
- **Category**: platform-distribution
- **Feasibility**: medium
- **Time-horizon**: quarters
- **What it is**: Factor the eight adapters' shared shape — declared source manifest (URL, licence text, encoding, cadence, refresh semantics), pure parse functions over fetched bytes, natural-key + duplicate accounting, provenance stamping — into an explicit Adapter Contract, then prove portability by shipping a second chamber: the Czech Senát first, the Slovak NRSR (near-identical Informix-style exports) as the international proof. The end state is a kit where "add a parliament" means writing parsers against the contract, and every downstream module (VoteTrack, CivicScore, discipline boards) lights up automatically for the new chamber.
- **Why it's a moonshot**: It changes what politicas *is* — from a Czech app into a deployable accountability engine for any parliament with open roll-call data; falsifiable by a second chamber reaching feature parity without touching `features/`.
- **Grounded in**: The contract already exists implicitly and consistently: every adapter separates pure normalize functions from IO (`lib/ingest/sources/psp.ts` `normalizePoslanci`/`normalizeHlasovani`, `psp-activity.ts`'s "aggregation logic is pure over parsed UNL rows"), carries `SOURCE_*` constants + licence docs (`PSP_SOURCE_DOCS`), counts duplicates for validity scoring, and stamps Prov; `termCode`/`term_code` scoping (`lib/ingest/normalize.ts`) is already the multi-chamber seam.
- **Path to implementation**:
  1. Write the contract as a TypeScript interface + doc (`lib/ingest/adapter.ts`): manifest, fetch plan, pure normalize, duplicate report, Prov — and retrofit `psp.ts` to implement it (pure refactor, gate-checked).
  2. Generalize `termCode`/chamber assumptions in the row types to `(chamber, term)` scoping.
  3. Ship the Senát adapter (senat.cz publishes comparable open data) as the in-country second implementation.
  4. Run the existing scorers (`lib/analysis/contribution.ts`) over the new chamber; document which of the 6 dimensions transfer.
  5. Publish the kit + a "port your parliament" guide; NRSR as the first external port.
- **Dependencies / risks**:
  - Vote-code vocabularies differ per parliament — the contract must force explicit per-source vocabularies, never reuse of the psp.cz one.
  - Scoring methodology is chamber-specific; portability claims must stay at the ingestion layer, not the CivicScore layer, until validated.
- **What changes if we ship it**: The addressable audience jumps from one country's voters to every parliament with open data, with Czech politicas as the flagship deployment.

### M2. From daily snapshots to a civic seismograph — diff-derived change events and public alerts
- **Tier**: 2
- **Category**: intelligence-layer
- **Feasibility**: high
- **Time-horizon**: months
- **What it is**: The psp.cz dumps are versionless full snapshots, but Pumper already fingerprints the release page and extracts its file manifest into `source_release`. Close the loop: on every detected upstream change, re-ingest and *diff the normalized rows against the graph*, emitting typed, dated change events — new roll call, changed membership, new bill, new company tie — into a `graph_event` stream. That stream powers a public "Seismograf" feed and per-MP/per-bill subscriptions ("watch this MP" → email/RSS when a new rebellion, tie, or sponsored bill lands), turning a static reference site into an alerting instrument.
- **Why it's a moonshot**: It inverts the usage model — instead of users polling politicas, politicas notifies the country when parliament moves; retention shifts from occasional visits to standing subscriptions (falsifiable via subscription counts and event latency vs. upstream publication).
- **Grounded in**: `lib/ingest/sources/pumper.ts` (`watch/pages` sha256 fingerprints + `extractor/extracted` manifest → `source_release` — the change *trigger* already exists); deterministic natural keys on every row (`psp:hlasovani:<id>`, `psp:zarazeni:...` in `lib/ingest/sources/psp.ts`) make snapshot diffing exact; `features/dashboard/datedFacts.ts` already renders a chronological fact ledger the event stream would feed natively.
- **Path to implementation**:
  1. Add a `graph_event` table + repository (kind, entity id, occurred/detected timestamps, Prov) beside the existing PGlite repos.
  2. In the ingest scripts, compute the upsert delta (new/changed natural keys per table — a set difference over ids already in memory) and write events for the delta.
  3. Wire Pumper's `source_release` change detection as the scheduler: fingerprint changed → run ingest → events emitted.
  4. Feed `datedFacts.ts`/the dashboard feed from `graph_event` (replacing derivation with the real stream), plus a public `/seismograf` ledger + RSS.
  5. Add scoped subscriptions (per MP, per bill, per party) as feed variants; email later.
- **Dependencies / risks**:
  - First-run flood: the initial diff is "everything" — needs an epoch marker so event zero is silent.
  - Event *occurred-at* vs *detected-at* must both be shown, or a late-detected old vote reads as breaking news (the datedFacts discipline already models this).
- **What changes if we ship it**: Politicas gains a heartbeat — journalists and voters get told, within a day, every time the data about their representative changes.
