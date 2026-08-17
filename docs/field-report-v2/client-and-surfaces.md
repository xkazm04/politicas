# Field Report v2 — politicas — shard client-runtime + product-surfaces

**Headline counts (44 leaves):** `holds` 17 · `holds(self)` 2 · `violates` 0 · `partial` 6 · `n/a-absent` 19 · `n/a-scope` 0 standalone (folded into partials).
Coverage: **scored deep (executed check) 27** · shallow (head + absence grep) 17 · skipped 0.
Enrichment candidates: **7** (all `refines-existing` / one `built-elsewhere`), concentrated in the data-integrity surfaces (provenance, audit, anomaly, partial-failure envelope, session-delta).

One-line verdict: politicas is a mature, unusually deliberate civic-**data** product. Its data-integrity machinery (provenance-to-the-pixel, tamper-evident audit chain, blindness-disclosing anomaly detectors, honest-absence envelopes) **meets or exceeds** the corpus. The client-runtime interaction surface is thin by design (read-only SSR site, no store, no auth, no chat/canvas-editor), so 19 leaves are genuinely `n/a-absent` — a maturity/scope signal, not a failure. **Zero violations.**

---

## 0. Orientation + independence declaration

**Stack.** Next.js 16 (App Router) · React 19 · TypeScript 5 · next-intl · Tailwind 4 · recharts · framer-motion · **PGlite** (in-browser/SSR SQLite-family, `@electric-sql/pglite`) · Sentry (DSN-gated). No Zustand, no Redux, no Tauri/IPC, no Rust. Client state = `localStorage` (3 sites) + component `useState` + one `useSyncExternalStore` clock + one React context (forensic mode). Server reads flow through `features/*/get*Data.ts` loaders wrapped in `react.cache()`.

**Entanglement with the corpus (this is the point of §2 of the kit).** politicas keeps its **own four-state adherence ledger** against the shared knowledge library at `scripts/census/rules.json`, enforced by `scripts/census/check-library-adherence.mjs` and a bespoke `packages/eslint-plugin-civic-transparency`. States: `adopted` (local gate) / `satisfied` (met by a *named, reproducible* mechanism that is often **not** the library's) / `declined` (reasoned) / unreviewed (reported, never failed). Of my 44 shard leaves, **exactly two appear in that ledger** — both `satisfied`:
- `client-state-persistence` → **`holds(self)`** (ledger: version-in-key + validate-on-read + existence-only; it even pushed "version-in-the-key" *upstream* to the library).
- `swallowed-error-telemetry` → **`holds(self)`** (ledger: result-returning codebase; error becomes the return type, not a side effect).

The other **42 leaves are unreviewed by politicas' ledger**, so where I find agreement it is an **independent hold**, not a self-match. The census/eslint infrastructure is corpus-mirroring, but the *code patterns* scored below (pglite singleton, permalink, provenance union, audit chain, schranka delta) carry their own dated architect-decision docs (`docs/architect/decisions/2026-07-26-*.md`) and Czech-language rationale essays — independent engineering that happens to agree with the physics. I mark only the two ledger-tracked leaves `holds(self)`.

**Instruments.** `rg`/grep, node, python present and used. Two ts-rs/DB-probe rules from the kit are moot (no Rust, no server DB I copied — PGlite data dirs are read via loaders only; I never opened `.pglite`). No build/`cargo`/mutating command run. `.claude/worktrees/ci-push/` is a full path-duplicating mirror — I cited only canonical (non-worktree) paths.

---

## 1. Scorecard

### Client-runtime (22)

| leaf | clauses | verdict | notes (file:line) |
|---|---|---|---|
| client-state-persistence | 3 | **holds(self)** | ledger `scripts/census/rules.json` (satisfied); `features/schranka/followCodec.ts:25` version-in-key; `features/graph/GraphPage.tsx:41,55` validate-on-read; `ReferendumPage.tsx:95` existence-only |
| client-rule-mirroring | prose | **holds** | verdicts computed server-side in `lib/analysis/*` and shipped as typed `Claim`s to the client, never recomputed; `features/civicscore/provenance.ts:133` `formulaMatch` detects stored-vs-code divergence (moves the *answer*, and moves the *failure* when it can't) |
| view-state-persistence | prose | **holds** | version-in-key (no migration can be wrong); `features/graph/GraphPage.tsx:41` `isVariant()` guard falls back to `'mapa'`; `features/graph/permalink.ts` URL carries whole view-state + FNV content fingerprint so a stale citation *says so* |
| hmr-safe-singletons | prose | **holds** | `lib/db/pglite/internals.ts:28,42` memoises the **connection handle** on `globalThis` — the *correct* reason to hoist (a live handle, not a mere value); rejected promise cleared from memo (`open-retry.test.ts`, architect decision `2026-07-26-memoised-rejection-open.md`) |
| zustand-domain-slices | prose | **n/a-absent** | no zustand/redux anywhere; the "five domain root stores" clause is Personas local-calibration (n/a-scope). State lives in localStorage + useState + one external-store clock |
| polling-loop | 2 | **holds** | `features/schranka/useToday.ts` — "today as a subscription, not a value read in render": `useSyncExternalStore`, **one** `setInterval` for all subscribers, module-scoped, minute granularity justified in header |
| stale-response-guard | prose | **holds** | `features/graph/useNodeSelection.ts:30-46` request-sequence guard (`req = ++reqRef.current`; drop response if `reqRef.current !== req`); detail loaded **in the event handler, not an effect** (rationale in header) |
| partial-failure-read-envelope | 3 | **holds** | `lib/db/loaderGuard.ts` `reportLoaderFailure()` chokepoint (log+Sentry before the null); `features/shared/components/DataUnavailable.tsx` distinguishes dead-source from empty; `deriveCollisions.ts:234` `orNull(n)=consulted?n:null`; `readReviewAudit.ts:44-57` carries `labelsRead`/`truncated` in the envelope — **enrichment** |
| shared-fetch-cache | prose | **holds** | `react.cache()` request-scoped memo on 9+ loaders (`getLeaderboardData.ts:439,477` documents the identity+scope explicitly); second layer = pglite connection memo. Identity + end-of-life both in code |
| entity-draft-editing | prose | **n/a-absent** | no draft/baseline/diff editing; the only write (`submitReviewDecision`) is a single audited decision, not a form draft |
| debounced-autosave | prose | **n/a-absent** | no autosave (read-only site). `NodeSearch.tsx:40,62` debounces *search input*, a different leaf; timer + in-flight request cleanup acknowledged in header |
| optimistic-update | prose | **n/a-absent** | writes are either local-only (`FollowButton` localStorage, instant, no server) or server-authoritative-then-`revalidatePath` (`reviewActions.ts:100-128`) — neither paints an optimistic row |
| bulk-selection-actions | prose | **n/a-absent** (shallow) | selection sites (`TownPicker`, `WeightPanel`, `LeaderboardTable`) are single-entity pickers / display toggles; no multi-select→bulk-mutate on a read-only product |
| error-message-resolution | prose | **n/a-absent** | no producer error-kind discriminant to resolve on; user-facing failures render curated i18n copy (`t("errors.route.*")`, DataUnavailable), raw `err.message` never shown to users |
| error-surfacing-policy | prose | **holds** | mount/load failures → `DataUnavailable` in place + Sentry, **never a toast** (no toast library in tree); `app/error.tsx` / `app/global-error.tsx` are honest about "no report was sent" (DSN unset) — a near-reference for the "don't interrupt for non-user-caused failure + don't lie in the fallback" physics |
| error-boundary | prose | **holds** | `app/error.tsx` (route, inside layout — nav still available) + `app/global-error.tsx` (own `<html>/<body>`); fallback depends only on `error` + a way out (`unstable_retry`, home); `Sentry.captureException` tagged by boundary; fallback asserts "nothing you see is data" |
| swallowed-error-telemetry | prose | **holds(self)** | ledger (satisfied): result-returning codebase; `reviewActions.ts:126` `{status:'error'}`, `verdict.ts:305` `{ok:false,errors}`. Minor deviation: ~a handful of internal parse-to-null catches drop the error *value* (e.g. `internals.ts:101`, `getAdminData.ts:203`) — see §2 |
| multi-step-flow | prose | **n/a-absent** | no wizard/stepper/multi-step commit anywhere |
| first-use-consent-gate | prose | **n/a-absent** | no consent gate; Sentry is DSN-gated, no product analytics needing consent; schranka is local/no-account |
| first-run-onboarding | prose | **n/a-absent** | public data site, no first-run notion |
| setup-checklist | prose | **n/a-absent** | no user setup; `/admin` LoopMissionControl is ops telemetry, not a live-computed readiness checklist |
| guided-tour-step | prose | **n/a-absent** | no tour registry/anchors |

### Product-surfaces (22)

| leaf | clauses | verdict | notes (file:line) |
|---|---|---|---|
| filtering-and-search | prose | **holds** | in-memory `.filter()` over already-loaded **bounded** arrays (correct per physics); `features/lawwatch/components/BillBrowser.tsx:39-71` computes **cross-filtered** facet counts so badges stay honest. Not URL-synced (minor view-state gap) |
| tables | 1 (+local-cal) | **partial** | the "use one of three shared primitives" clause is Personas local-calibration → n/a-scope. Universal core partially met: ~9 hand-rolled `<table>` + 1 ARIA-grid table (`LeaderboardTable.tsx:309`), each with its own inline column model, honest empty/facet states, deliberate a11y — but no shared sort/virtualization/empty primitive |
| long-list-rendering | prose | **partial** | named caps + reader-facing disclosure is the house idiom (`VoteThemeFilter.tsx:22` `LIST_CAP=80`→`:36`, `MoneyTrailSection.tsx:107` `TOP_SUPPLIERS`); **but** `BillBrowser.tsx:141` and `LeaderboardTable` (~207 rows) render unbounded filtered arrays. No virtualization. Severity low (bounded by data reality) — see §2 |
| expandable-row | prose | **n/a-absent** | no accordion-with-`openId`-keyed-by-identity. What exists is row-local text-clamp (`ExpandableText.tsx:43`, visual-only, text always in DOM — a *deliberate, documented different* pattern) and expansion-as-navigation (`BillBrowser.tsx:167` → dossier page) |
| proportional-bar-list | prose | **holds** | denominator is a **named binding**, never `rows[0]`: `MoneyTrailSection.tsx:110` `maxRowCzk` (`Math.max(1,…)` guard + 2% floor); `RealVoteLedger.tsx:21` `seats`; `HeadToHead.tsx:237` `c.weight` (zero-weight guard) |
| metric-definition | prose | **holds** | metrics single-homed + named with unit/window (`contribution.ts:25-37` weights; `atlas.ts:47-69` cadence/staleness windows; `claim.ts:36-70` `metric`+`unit`); "no sample" representable (`deriveCollisions.ts:234` `orNull`, atlas "nehodnoceno with a reason, never 0"). Federated, not one central registry (physics allows one-home-per-metric) |
| data-provenance-disclosure | prose | **holds** ★ | **showcase.** Typed provenance union carried to the pixel: `claim.ts:33` `ClaimReviewStatus`, `claim.ts:56-69` `derivation` (what computed it), `provenance.ts:29-35` `state:"uniform"\|"mixed"\|"absent"` + `pass:number\|null`; rendered as `<data data-claim-*>` in `CitableNumber.tsx:46-54`; schema.org gating enforced *in the function* (`claim.ts:191-217`), not trusted to callers; addressable receipts `/zdroj/<ref>` (`claimRef.ts:97`). **Enrichment** |
| scoring-and-thresholds | 4 | **partial** | composite `computeContribution` (`contribution.ts:237-283`) with named weights/caps and denominator guards — **but** the six sub-scores are plain `number`, so "unmeasured" folds to `0` by explicit design (`contribution.ts:17,251`). The measured-vs-unmeasured distinction is preserved *one level up* in the provenance sidecar (`state`, `pass:number\|null`), not in the score. Deviation on clause (a) — see §2 |
| chart-component | prose | **holds** | bounded quantities get explicit domains (`ScoreBreakdown.tsx:53` `domain={[0,100]}` fixed ticks); count/currency axes use auto or intentionally-padded `dataMin-2/dataMax+2` (`ChamberChart.tsx:64-78`) — within the physics' `[0,'auto']`-for-magnitude allowance. No auto domain silently misrepresenting a bounded score |
| metric-tile | 3 | **partial** | `StatTile.tsx` types `value:string` and "never formats" — so the **caller converts number→text on the way in** (violates that clause) and there is **no built-in null/neutral affordance** (violates that clause). Deliberately compensated: a `source` citation is **required** on every tile + a `real\|illustrative` variant. Trades null-typing for provenance-typing — see §2 |
| alert-rule-editor | prose | **n/a-absent** | no alerts/rules-with-thresholds product surface |
| audit-trail-view | prose | **holds** ★ | tamper-evident append-only `review_audit` chain: `ChainedAuditRow` (`lib/db/pglite/ledger.ts:88-114`) = reviewer/decidedAt/decision/priorState; `verifyReviewChain` O(n) first-divergence; Merkle-sealed ingest runs; `ReviewAuditCounts{total,chained}` tells **empty from erased**; reader view `readReviewAudit.ts` discloses truncation. **Enrichment** |
| anomaly-marker | prose | **holds** ★ | **two** named versioned detectors: `lib/analysis/tripwires.ts` (`TRIPWIRE_PATTERNS`, `hlidky-v1`) + `deriveCollisions.ts` (`COLLISION_RULE_VERSION`); each candidate carries verbatim justification (`ruleCs`) + links back to cause (`stretyIds`, `tieRef`, `billNodeId`); **blindness disclosed** (`votesAvailable`/`agendaAvailable` → "blind" vs "no finding"); framed candidate-not-finding. **Enrichment** |
| usage-analytics | prose | **n/a-absent** | Sentry error-capture only; no product usage-event vocabulary/consent/rollup |
| dev-only-diagnostics | prose | **n/a-absent** | no NODE_ENV-gated diagnostic panels. Adjacent clean pattern: forensic mode is **URL-gated** (`?rezim=forenzni`, no localStorage → shareable), single CSS-token source, "colors-only toggle is a rejected pattern" (`ForensicProvider.tsx` header) |
| session-delta-digest | prose | **holds** | near-reference: `features/schranka/visitWindow.ts:77` `badgeCount` subtracts a durable `SeenWatermark` only when `seen.day===since` (never recompute for the badge); StrictMode-guarded single stamp (`openVisit:55-63`); digest liveness is itself a delta row (`recomputeFact.ts:81-110`); empty = information (entities with no news still listed). **Enrichment** |
| live-event-console | prose | **n/a-absent** | no live ring-buffer/stream console; `/denik` is a static dated feed |
| dry-run-preview | prose | **n/a-absent** | no user-facing preview-then-apply. Adjacent tooling: census `--check` vs `--update` (`run-census.mjs:84-85`) is a gate/ratchet, not a plan-token preview |
| catalog-browse-and-apply | prose | **n/a-absent** | `data-releases` is browse+download of snapshots; no versioned install-with-stamp (`entry_id,entry_version,installed_at`) surface |
| node-canvas | 3 | **partial** | read-only KG visualization, not an editor. Holds: node type deliberately **narrower** than storage row (`graphTypes.ts` `GraphNode` vs `KgNodeRow`), and "render nothing that doesn't fit" (`GraphStage.tsx` caption режie — off-canvas nodes stay in lists/search). Edit-gesture edge-validation clause n/a-scope (no editing) — see §2 |
| canvas-state-persistence | prose | **partial** | no editable canvas document to hydrate/reconcile, so those clauses are n/a-scope. View-state persistence holds: pan/zoom in a ref (not React state), full view + content fingerprint in the `/graf/p/<ref>` permalink; stale-vs-source reconciled by fingerprint comparison |
| streaming-chat-transcript | prose | **n/a-absent** | no chat/LLM transcript surface |

**Shard totals:** 44 leaves — holds 17 · holds(self) 2 · partial 6 · violates 0 · n/a-absent 19.
**Coverage:** deep/executed 27 · shallow(head+absence) 17 · skipped 0.

---

## 2. Deviations (nothing applied)

No violations. Six partials; the four substantive ones below. None is a bug — each is a *documented trade* worth surfacing.

**D1 — scoring-and-thresholds: the composite score cannot say "unmeasured" (severity: low-med).**
`contribution.ts:194` types all six sub-scores as plain `number`; `contribution.ts:251` coalesces missing inputs to `0`. The physics clause (a) wants `number | null` so "no problem" ≠ "nobody measured."
*Held: reason* — the author documents it (`contribution.ts:17`): early-term interpellations are *legitimately* 0, and the distinction **is** preserved, just relocated to the provenance aggregate (`provenance.ts:29` `state`/`pass:number|null`) and to ratio denominator guards (`contribution.ts:249` `rollCallsHeld>0 ? … : 0`). A caller reading the *score* alone still can't tell 0-because-none from 0-because-unmeasured; only the sidecar can. Fix (if ever): let a sub-score carry `null` and let the weight renormalize, rather than folding to 0 pre-composition.

**D2 — metric-tile: caller formats number→text; no null affordance (severity: low).**
`StatTile.tsx` types `value:string` and "never formats," so the number→text conversion happens at every call site and the tile has no neutral em-dash branch. Two physics clauses deviate.
*Held: reason* — a compensating control the corpus tile lacks: **every tile requires a `source` citation** (brand rule "no number without provenance") plus a `real|illustrative` plane. politicas chose provenance-typing over null-typing. This is an enrichment tension (see §3, E6), not a defect.

**D3 — long-list-rendering: two surfaces render unbounded filtered arrays (severity: low).**
`BillBrowser.tsx:141` (`rows.map` on the full filtered bill list) and `LeaderboardTable` (~207-row chamber) render without a cap or virtualization, against the house idiom of named caps (`VoteThemeFilter.tsx:22`). Bounded by data reality (a chamber is 200 seats), so no live perf risk, but the "bound at the surface, name it at the call site" clause is unmet on these two.

**D4 — swallowed-error-telemetry: a few internal parse catches drop the error value (severity: very low).**
The physics says "bind the error value, *always*, even when you intend to continue." A handful of pure-parse catches convert malformed input to a typed empty without binding: `internals.ts:101` (`catch { return {} }`), `getAdminData.ts:203`, `changeEvents.ts:133`. These are total parse functions returning a typed null the caller handles — the golden path's own escape hatch — so this is a hair, not a hole. The I/O boundary (loaders/DB) routes correctly through `reportLoaderFailure`. Consistent with the ledger's `satisfied` entry.

**D5/D6 — node-canvas & canvas-state-persistence: `partial` is a scope artifact, not a shortfall.** politicas' graph is a *read-only visualization* of a server-owned knowledge graph; the corpus leaves are written for an *editor* whose rows an executor walks. The clauses that apply (narrower-than-storage node type, render-only-what-matters, view-state-in-URL, stale-vs-source reconciliation) all hold; the edit-gesture/hydrate/reconcile-on-write clauses are n/a-scope.

---

## 3. Enrichment

politicas is a civic-data product; its provenance/audit/anomaly machinery is more developed than a generic app's, and in several places more developed than the corpus leaf that names the pattern. All candidates are **read-only observations** — nothing was applied.

| # | candidate | file:line | physics argument | in_corpus | lane |
|---|---|---|---|---|---|
| E1 | **Addressable claim receipts + content-fingerprinted citations** | `lib/claims/claim.ts:56-69` (`derivation`), `features/shared/provenance/claimRef.ts:97`, `features/graph/permalink.ts` | Provenance isn't just a discriminator on the payload — every claim gets a re-derivable URL (`/zdroj/<ref>`) and every citation URL carries an FNV fingerprint of the content at issue-time, so a *stale citation announces itself* instead of silently showing different data. Carries the corpus "in the type to the pixel" one rung further: to a *durable, verifiable address*. | **refines-existing** → `data-provenance-disclosure.md` (also touches `cross-surface-deep-link.md`) | ENRICH |
| E2 | **`formulaMatch`: stored-answer-vs-live-code divergence detection + write-time guard** | `features/civicscore/provenance.ts:71,133`; `lib/analysis/contribution.ts:109-146` (`guardContributionWrite`) | client-rule-mirroring says "move the answer, or move the failure." politicas moves the answer (server-computed score) **and** detects when the stored answer was authored by a different formula than the code now declares (`formulaMatch:false` → honest "stale" label), and refuses at write time to overwrite a newer correction. A named mechanism for the exact failure the corpus leaf only warns about. | **refines-existing** → `client-rule-mirroring.md` | ENRICH |
| E3 | **Tamper-evident audit chain that tells "empty" from "erased"** | `lib/db/pglite/ledger.ts:88-114`; `repositories/ledger.ts:82-87,152-191` | audit-trail-view wants actor/when/action in columns — politicas has that **and** hash-chains rows (`verifyReviewChain` reports first-divergence), Merkle-seals ingest runs, and exposes `ReviewAuditCounts{total,chained}` so a wiped chain can't masquerade as a fresh one. The "empty vs erased" distinction is a physics clause the corpus leaf does not state. | **refines-existing** → `audit-trail-view.md` | ENRICH |
| E4 | **Blindness disclosure as a first-class detector state** | `lib/analysis/tripwires.ts:112-119,246-249`; `deriveCollisions.ts:234-237` | anomaly-marker wants one named detector whose marks carry justification + a way back to cause (politicas has two, versioned, that do). The refinement: a flagged series distinguishes "no anomaly found" from "**I was blind to this input**" (`votesAvailable`/`agendaAvailable`), and `orNull(consulted?n:null)` refuses to publish a 0 it never verified. Absence-of-signal is typed, not assumed. | **refines-existing** → `anomaly-marker.md` (and `scoring-and-thresholds.md` clause a) | ENRICH |
| E5 | **Loader-guard chokepoint + DataUnavailable + orNull triad for silent degradation** | `lib/db/loaderGuard.ts`; `features/shared/components/DataUnavailable.tsx`; `deriveCollisions.ts:234` | partial-failure-read-envelope: politicas names the exact failure mode ("a dead store is indistinguishable from an empty graph"), then counters it with a single reporting chokepoint before every fallback-to-null, a distinct dead-source UI state, and value-level `null` for un-consulted inputs. A clean reference triad for the leaf. | **refines-existing** → `partial-failure-read-envelope.md` | ENRICH |
| E6 | **Provenance-required metric tile (the null-typing alternative)** | `features/shared/components/StatTile.tsx` (required `source`, `real\|illustrative` variant) | metric-tile assumes null-typing as *the* way to represent "unmeasured." politicas demonstrates a second discipline: make **provenance** mandatory on every tile and split the sample/real plane, so an uncited or illustrative figure is visually distinct. A `named-not-built` axis for the corpus leaf: tiles that testify to their source, not just their nullness. | **named-not-built** → `metric-tile.md` | ENRICH |
| E7 | **Session-delta digest as a near-verbatim reference impl** | `features/schranka/visitWindow.ts:44-80`; `recomputeFact.ts:59-110`; `deriveDeltas.ts:95,259-261` | session-delta-digest's three head clauses (durable mark, count-from-the-source, digest-liveness-observable) are met almost verbatim, plus the StrictMode double-stamp guard and count-before-cap. Strong enough to cite as an exemplar. | **built-elsewhere** → `session-delta-digest.md` (candidate reference impl) | ENRICH |

---

## 4. Methodics

**Executed vs shallow.** 27 leaves scored with an executed check (grep with exit-code semantics, source read at cited lines, two parallel Explore sweeps that returned file:line anchors). 17 scored shallow — all `n/a-absent`, each confirmed by an absence grep (e.g. `zustand` → 0 hits, `toast|sonner` → 0 hits, no `onboard|wizard|stepper`), which is a *presence/absence* fact a grep answers cleanly, not a physics judgment I faked.

**Two-implementation disagreement (the load-bearing one).** Silent-catch count for `swallowed-error-telemetry`:
- My heuristic (regex: catch body within a 260-char window lacking `report|console|Sentry|throw|…`) → **27** "silent-ish" sites.
- politicas' ledger, by **reading all of them** → **5**, all of which return/rethrow the error.
- I then opened 4 of my 27 and confirmed the ledger is right: my window missed multi-line `return {ok:false, errors:[e.message]}` envelopes and `reportLoaderFailure` calls past the 260-char cut. **The heuristic answered a different question** (does a keyword appear near the `catch` token) **than the one that matters** (is the error value actually dropped). Same substring-vs-structural failure family the corpus's own `adding-a-ci-gate` and hmr notes warn about. Reported number: **5**, read-verified.

**Self-corrections.** (1) Initially inclined to score `tables` a violation ("no shared primitive") — corrected to `partial` once I recognized that clause is Personas local-calibration (n/a-scope), and the universal a11y/empty-state core is partly met. (2) Initially read `node-canvas`/`canvas-state-persistence` as holds — corrected to `partial` after realizing the graph is a read-only viewer, so the editor-centric clauses are n/a-scope, not held. (3) Nearly marked `expandable-row` `partial` for the text-clamp toggle — corrected to `n/a-absent` because the canonical accordion-with-`openId` pattern genuinely doesn't exist; the text-clamp is a different, deliberately-documented pattern.

**Instrument gaps / honest silences.** No Rust/IPC → ts-rs and IPC-shaped rules moot (n/a). I did not open any `.pglite` data dir (read-only via loaders only), so DB-probe checks on audit/provenance rest on source + the loaders' own tests, not a live row read — flagged rather than faked. `bulk-selection-actions` is my lowest-confidence verdict (shallow): I confirmed the selection *sites* exist but judged them single-pickers/toggles from their names + a read-only product's affordances, not by opening all ten — marked shallow accordingly.

**Independence caveat.** The strongest holds (E1–E7) sit in politicas' *domain core* (civic data integrity), which the corpus's client-runtime/product-surface leaves were **not** authored from (only `client-state-persistence` and `swallowed-error-telemetry` are ledger-tracked, both `holds(self)`). So these are independent corroboration of the physics from a genuinely different product shape — the most valuable kind of hold, and the reason the enrichment lane is worth the orchestrator's attention.
