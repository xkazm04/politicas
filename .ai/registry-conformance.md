# Registry conformance — software-engineering

contributor: mkdol-dev-box · audited: 2026-08-24 · bundle: `ai-registry/knowledge/software-engineering`

Fourteen subjects selected against this repo's real surfaces: an embedded
single-writer Postgres (PGlite) behind a repository layer, a large offline
`scripts/` analysis pipeline, an eight-rule in-repo ESLint plugin carrying the
"every rendered number cites its source" doctrine, a composite local gate plus
CI, a Czech-first cs/en catalog, a whole-graph canvas, and one large ranking
table. Subjects with no surface here (fleet orchestration, IPC, packaging,
rate limiting, p2p, voice) are not padded in as n/a rows.

Every technique file was read before its row was written. A `deviation` is a
finding, not a shame.

**107 technique rows: 48 followed · 27 partial · 15 deviation · 17 n/a.**

| subject | technique | status | evidence |
|---|---|---|---|
| embedded-db | single-writer-holder-discipline | followed | `scripts/db/backup.ts:74-119` holds the connection, CHECKPOINTs, strips `postmaster.pid` from the copy, prunes by its own prefix; 0 store-opening script entrypoints lack an explicit `process.exit` (swept 2026-08-24) |
| embedded-db | connection-pooling | n/a | `lib/db/pglite/internals.ts:41-57` — PGlite is single-connection by construction; one memoized handle, no pool to size |
| embedded-db | db-self-instrumentation | deviation | no query-timing ring, per-table counters or lock-wait tracking in `lib/db/`; regressions are caught by one-off manual measurement written into comments (`lib/db/store.ts:42-111`) |
| embedded-db | extension-lifecycle | n/a | no `create extension` anywhere; `scripts/gen-migration.ts:27` records that PGlite ships no `unaccent`, so diacritics are folded at ingest instead |
| embedded-db | journal-and-durability-modes | partial | backup treats the store as a file-set and checkpoints first (`scripts/db/backup.ts:74-102`), but no sync-level is asserted at boot and no crash-consistency test exists |
| embedded-db | quiet-window-maintenance | deviation | CHECKPOINT runs only inside a manual `npm run db:backup`; no activity gate, and WAL growth between backups is unmanaged (acknowledged at `scripts/db/backup.ts:17-22`) |
| embedded-db | storage-accounting-and-pruning | deviation | `kg_node_history`, `kg_edge_history`, `change_event`, `review_audit`, `lens_submission` (`lib/db/pglite/ddl.ts:307-380`) are append-only with no retention policy and no per-table accounting report |
| data-access | layering-rules | followed | no `.query(`/`pg.exec`/`PGlite` call site outside `lib/db/`; `lib/db/pglite-store.ts:15-17` throws if imported client-side |
| data-access | query-construction | followed | `lib/db/pglite/internals.ts:150-163` generates placeholders and binds values; every write in `repositories/kg.ts` is parameterized |
| data-access | row-mapping | followed | `lib/db/pglite/mappers.ts:18-22,61-82` one COLS+map pair per table; `mappers.ts:125-138` warns-once-and-coerces an unrecognized `membership.kind` instead of passing it through |
| data-access | transactions-and-units-of-work | followed | `lib/db/pglite/repositories/review.ts:55-150` wraps read → audit-insert → update in one `pg.transaction` with the lost-update race written out beside it |
| data-access | batching-and-n-plus-one | followed | `lib/db/pglite/repositories/kg.ts:161-168` `nodesByIds` batches via `= any($1::text[])`; `lib/db/store.ts:42-111` documents three whole-relation N+1 defects already fixed |
| data-access | repo-testing | partial | `repositories/votes.test.ts:6-9` uses a real PGlite in an isolated temp dir, but seeds with raw interpolated SQL rather than the repo's own writer; `truncationGuards.test.ts:29-37` stubs the connection entirely for six listers |
| data-access | cross-driver-invariant-parity | n/a | `lib/db/config.ts:14` — one driver (`"pglite"`); `lib/civic/` is a labelled fallback corpus, not a second `Store` implementation |
| migrations | schema-drift-detection | followed | `scripts/gen-migration.ts` + `npm run db:snapshot -- --check` is a CI step; `lib/db/pglite/ddl.ts:1-4` makes `CORE_DDL` the sole authority, so the two-authority problem cannot arise |
| migrations | error-propagation | followed | `lib/db/pglite/internals.ts:41-57` propagates the rejection and clears the memo; `open-retry.test.ts:22-34` is the regression test for it |
| migrations | idempotent-steps | partial | `ddl.ts` guards everything with `if not exists`, but there is no run-once ledger — the whole `CORE_DDL` reapplies at every boot (`internals.ts:48`), so every guard is load-bearing forever |
| migrations | transactional-ddl | partial | the whole multi-statement `CORE_DDL` goes in one `pg.exec` (`internals.ts:48`), which is probably atomic, but no per-step boundary and no crash-mid-DDL test proves it |
| migrations | data-migrations | partial | `ddl.ts:296-305` fuses shape change and backfill into one `alter table … add column … default now()` — deliberate and documented at this volume, but no batched/watermarked path exists |
| migrations | pre-migration-snapshots | deviation | `scripts/db/backup.ts` is on-demand only; nothing snapshots before DDL is applied, and nothing knows DDL is pending (see idempotent-steps) |
| quality-gates | gate-liveness | followed | `scripts/census/run-census.mjs:36-56` gives "looked at nothing" its own fatal exit, distinct from "found nothing"; `scripts/census/self-test.mjs` seeds every failure mode through the real runner (23/23) |
| quality-gates | ratchet-design | followed | census baselines are committed in `scripts/census/rules.json` and fail on rise **and** on unexplained drop; `custom/no-raw-number-display` graduated to plain `error` at a measured zero this session, per the technique's endgame |
| quality-gates | false-positive-economics | followed | `scripts/census/rules.json:$comment` records two gates that measured 0 true positives and were converted to `satisfied` rather than shipped; `eslint.config.mjs` ladders the provenance pair by measured zone |
| quality-gates | hook-hygiene | followed | `lefthook.yml` is the single hook system, installed by `prepare`, never mutates (no `--fix`), scoped to `{staged_files}`, non-interactive, bypassable |
| quality-gates | blocking-by-input-determinism | followed | `.github/workflows/ci.yml:63` runs `npm audit --audit-level=high` explicitly non-blocking with a dated reason — the one input-shaped check; every other step is deterministic given the commit and blocks |
| quality-gates | unmeasurable-criteria | followed | `library:check` prints 36 unreviewed principles as "a report, not a failure" and fails only when an adopted rule cites a principle that does not exist |
| quality-gates | severity-by-construction | partial | traced: no `--max-warnings` anywhere, so `custom/require-source-citation`'s 11 `features/**` warnings can never refuse — honest advice, not enforcement. Display channel restored 2026-08-24 (lefthook `--quiet` removed after fault injection); the remaining gap is no ratchet on that count |
| quality-gates | gate-laddering | deviation | `npm run check` runs `census:test` + `library:check`, which `.github/workflows/ci.yml` does not — a check that runs only locally is a courtesy, not a gate |
| quality-gates | policy-projection | partial | CLAUDE.md/AGENTS.md described `npm run check` as three steps for a six-step script and "six custom ESLint rules" for eight; corrected 2026-08-24, but they remain hand-maintained copies with no derivation from `package.json` |
| quality-gates | chokepoint-tag-registry | partial | `lib/format.ts` is the declared display-number chokepoint and `custom/no-raw-number-display` statically proves nothing escapes it; there is no registry enumerating the repo's other chokepoints (`app/globals.css` tokens, `getStore()`) |
| codebase-scanning | rule-precision-discipline | followed | `scripts/census/rules.json:$comment` — "writing a gate from a principle without reading the code first produces ~0% precision"; both attempts measured, dated, and given a `verifiedBy` command |
| codebase-scanning | sensor-pipeline | followed | `scripts/census/lib/engine.mjs` `validateRule` rejects a bad regex or missing floor before any scan; a malformed registry fails the run rather than scanning nothing (asserted in the self-test) |
| codebase-scanning | evidence-scoping | followed | every `globalIgnores` entry in `eslint.config.mjs:28-51` carries a written reason and an explicit statement of what it does **not** exempt; `memory/impeccable-detector-triage.md` records a 38/38-false-positive scan and the config that scoped it |
| codebase-scanning | llm-assisted-scanning | partial | `docs/architect/` and `docs/harness/` are LLM scans with quoted evidence, and `memory/impeccable-detector-triage.md:35-40` fixes the triage rule ("reject a rule only after checking every instance it flagged") — but nothing verifies a quoted span still exists at the cited line |
| codebase-scanning | verify-after-generate | partial | the generated SQL snapshot is verified against `CORE_DDL` in CI (`npm run db:snapshot -- --check`), but `context-map.json` is generated by an external scanner with no drift check — this audit found 65/932 stale path refs by hand |
| codebase-scanning | finding-lifecycle | partial | findings live as dated prose in `docs/architect/`, `docs/harness/` and the route records; no dedup key and no close-verification, so a fixed finding stays in the record |
| codebase-scanning | dead-code-detection | partial | `scripts/case-loops/**/archive/` is quarantine-not-delete, which is the right posture, but nothing proves an archived script is unreferenced — the stale `context-map.json` refs are exactly that class |
| codebase-scanning | incremental-scanning | n/a | census and lint run at full repo scope every time; no since-last-scan mechanism exists and the tree is small enough not to need one |
| codebase-scanning | ingestion-budget | n/a | every scanning target is this repo's own tree, read from disk |
| docs-sync | dated-corrections | followed | every memo and config comment carries its date and measurement; `memory/robocopy-of-a-live-pglite-store-can-corrupt.md:18-38` carries two dated addenda that correct the original reading rather than overwriting it |
| docs-sync | coupled-surface-inventory | followed | `docs/feature-doc-map.json` declares source→doc couplings, names the altitude that dismisses each, and explicitly lists the dated artifacts that must never be retro-edited |
| docs-sync | cross-repo-drift-detection | followed | `scripts/census/check-library-adherence.mjs` re-hashes the ported personas engine and reports drift ("engine copy matches personas@f9e3a33fd") without needing the sibling checkout |
| docs-sync | same-change-enforcement | deviation | the rule is stated in CLAUDE.md's definition of done and nothing reads `docs/feature-doc-map.json` — no gate, no hook, no CI step; the map is an unenforced convention |
| docs-sync | checked-vs-skipped-denominators | deviation | there is no doc-sync checker at all, so there is no denominator; the ported census header still points at personas' `scripts/docs/__tests__/check-doc-sync.test.mjs`, which does not exist here |
| docs-sync | doc-rot-detection | deviation | `docs/feature-doc-map.json:_comment` still says "25 contexts / 9 groups" while `context-map.json` and CLAUDE.md say 48 contexts / 10 groups — nothing detects it |
| docs-sync | source-doc-mapping | partial | the map declares real couplings, but its own header count is stale and nothing reports unmapped areas |
| docs-sync | catch-up-markers | partial | `docs/routes/*.md` are append-only and dated, but no marker distinguishes covered-at-anchor from never-in-scope, so a catch-up pass would have no boundary to work from |
| docs-sync | source-as-data-without-the-app | n/a | no documentation gate reads a registry that lives in application source |
| repo-manifest-standard | capability-not-tool-vocabulary | followed | `.ai/manifest.yaml:16-27` — "Capabilities, not tools"; every entry is a name mapped to a real `package.json` script |
| repo-manifest-standard | must-ignore-unknown | followed | `.ai/manifest.yaml:2-4` states that unknown fields MUST be ignored, so the contract survives schema growth |
| repo-manifest-standard | pointers-not-embeds | followed | `.ai/manifest.yaml:29-37` points at contextMap / memory / design / routeRecords / docMap / lintRules instead of embedding any of them |
| repo-manifest-standard | semver-additive-evolution | followed | `schemaVersion: 0.1.0` is stamped on the artifact and separate from `schema: ai-manifest` |
| repo-manifest-standard | generated-from-provenance | partial | `generatedFrom` + `generatedAt` are present and every `verified:` is honestly `false`, but nothing drift-checks the manifest against `package.json` — and `catalog-census: npm run census` names a command that cannot exit 0 today |
| repo-manifest-standard | spec-ships-with-artifact | deviation | `.ai/manifest.yaml:4` cites `docs/AI_MANIFEST_SPEC.md`, which does not exist in this repo, plus an absolute path into a sibling checkout — the manifest is not self-describing offline |
| public-claim-provenance | provenance-as-a-build-gate | followed | the doctrine is a packaged plugin with per-rule docs and its own runner in the composite gate (`packages/eslint-plugin-civic-transparency/`, `npm run test:rules`); triggers stand on the `lib/format.ts` chokepoint, satisfiers are file-scoped, the escape hatch (`data-undisclosed`) is disclosed to the reader as a visible „bez zdroje" badge |
| client-state | singleton-lifecycle | followed | `lib/db/store.ts` `getStore()` caches the promise before awaiting, clears on rejection, and exposes `resetStoreCache()`; same shape in `lib/db/pglite/internals.ts` |
| client-state | rehydration-narrowing | followed | `features/schranka/followCodec.ts:131-160` guards each field independently and drops only the bad item; `isEntityKey` (`followCodec.ts:78-83`) is the single vocabulary gate |
| client-state | async-race-guards | followed | `features/schranka/useNews.ts:33-48` dedups in-flight requests and removes the entry on failure; `useNews.ts:75-93` compares a request signature before using a result |
| client-state | invalidation-strategy | partial | the only freshness mechanism is a 60 s TTL floor on the schránka news cache (`useNews.ts:20-34`); no event-driven invalidation exists, and no live channel exists to drive one |
| client-state | persistence-and-migration | partial | `features/schranka/followCodec.ts:25-26` puts the version in the storage KEY and ships no migration chain, so the next shape change silently orphans every existing follow list. The repo holds a documented counter-position (`scripts/census/rules.json` → `satisfied: client-state-persistence`, measured 2026-08-14, sent upstream); recorded here as the open disagreement it is |
| client-state | identity-scoped-eviction | n/a | no accounts and no sign-in anywhere; schránka is anonymous localStorage (`followCodec.ts:8-9`) |
| client-state | optimistic-write-path | n/a | follow/unfollow is a synchronous localStorage write — no authority round-trip to paint against |
| client-state | status-fsms | n/a | RSC-driven; no `isLoading`/`isError` boolean soup exists to enumerate into states |
| client-state | store-dependency-topology | n/a | no state library in `package.json` — no composed store graph |
| client-state | store-slicing | n/a | same reason: independent hooks (`useSchranka`, `useNews`, `useToday`) and one context |
| i18n | completeness-gates | followed | 2854/2854 keys, 0 missing / 0 extra between `messages/cs.json` and `messages/en.json`, enforced by 14+ colocated `features/*/messages.test.ts` suites that run in CI |
| i18n | interpolation-and-plurals | followed | 82 real ICU plural variants modelling Czech one/few/other against English one/other; `features/schranka/messages.test.ts` reasons explicitly about placeholder parity across differing plural-form counts |
| i18n | locale-runtime | followed | `lib/i18n/request.ts:10-17` resolves the locale server-side from a cookie before render, so there is no source-language flash; `lib/i18n/locale.ts` is the switch |
| i18n | token-label-separation | followed | `features/schranka/kindVocabulary.ts:27-50` maps token → catalog key with honest unknown-token degradation; `review_state` tokens are rendered only through catalog lookups, never branched on as text |
| i18n | catalog-architecture | partial | one authored source (cs) with parity enforced, but no typed key-path codegen and no section splitting — `messages/cs.json` (3530 lines) is loaded whole per request (`lib/i18n/request.ts:15`) |
| i18n | string-extraction-enforcement | deviation | no hardcoded-string detector exists among the eight custom rules; extraction is held culturally, which is the exact failure mode the technique says cannot hold a line |
| i18n | encoding-corruption-ratchet | n/a | no legacy-encoding pipeline touches the catalogs; the cp1250 handling lives in `packages/czech-civic-data`, not in the locale files |
| i18n | incomplete-bundle-kill-switch | n/a | both shipped locales are structurally and value-complete; there is no untrustworthy locale to withhold |
| i18n | script-aware-presentation | n/a | only Latin-script locales ship (`lib/i18n/config.ts:8`) |
| error-handling | error-doors | followed | `lib/db/loaderGuard.ts:13-16` `reportLoaderFailure` is the one background door — 141 call sites across 52 files — and `app/error.tsx:43-46` is the user-facing one |
| error-handling | swallowed-error-prevention | followed | `custom/no-silent-catch` and `custom/no-silent-null-catch` both at `error` (`eslint.config.mjs`); the second targets `catch { return null }` specifically — the fallback-with-no-door evasion that survives naive gates |
| error-handling | crash-capture | followed | `instrumentation.ts` covers nodejs + edge; `app/error.tsx` + `app/global-error.tsx` cover render crashes; `beforeSend`/`beforeSendTransaction` sanitize before send (`features/schranka/telemetryScrub.ts`) |
| error-handling | structured-propagation | partial | raw `Error` objects are preserved rather than stringified, but nothing adds a typed category per layer — `loaderGuard.ts:13` is `(loader: string, err: unknown)` |
| error-handling | user-facing-mapping | partial | copy is honest and catalog-translated per surface (`app/error.tsx` deliberately dropped a false "report sent" claim), but there is no message+suggestion registry keyed by failure category — three hand-authored surfaces instead |
| error-handling | taxonomy-design | n/a | no closed failure-category enum exists and there is one dominant failure shape (loader fails → labelled fallback → report), so a taxonomy has no consumer yet |
| test-harness | live-app-harness | followed | `scripts/smoke.ts` boots the real `next start` artifact, harvests a live MP id from rendered HTML instead of hardcoding one, and distinguishes mock-data markers from real-store markers rather than trusting HTTP 200 |
| test-harness | long-lane-certification | followed | `scripts/sentinel/run.ts` + `.github/workflows/sentinel.yml` — a never-ran or unreadable state emits the same shaped report (all rows `unevaluable`, exit 2) as a real run, and the nightly cron was deliberately removed because a never-green hosted lane is noise, not signal |
| test-harness | platform-quirk-absorption | followed | PGlite worker contention is absorbed centrally in `vitest.config.ts` with the measured symptom in-file; `ci.yml` pins Node 24 with the npm 10-vs-11 optional-peer reason written out |
| test-harness | out-of-graph-artifacts | followed | `packages/czech-civic-data` has its own vitest config **and** is folded into the root include list (`vitest.config.ts:23-26`); the plugin's RuleTester suite is its own named CI step |
| test-harness | isolation-lanes | partial | PGlite tests isolate properly from the live store (fresh `mkdtemp` dirs, never `./.pglite`), but there is no declared lane split — pure-logic and store-booting tests share one config, one timeout budget and one worker cap |
| test-harness | fixture-economics | deviation | every PGlite-backed file pays a full `mkdtempSync` + `open()` + DDL boot in its own `beforeAll` (`repositories/changes.test.ts:11-16`); no build-once/copy-per-test template, and that contention is precisely why the worker cap was needed |
| test-harness | suite-partitioning | deviation | one flat include list covers `lib/**`, `features/**`, `scripts/**`, `packages/*/src/**` under one budget as a single CI step — the everything-in-one-suite partition the technique names |
| test-harness | flake-lifecycle | deviation | no flake registry, quarantine marker or transition-count detector; the observed PGlite flakiness was answered by throttling global parallelism, not by detect → label → quarantine → release |
| test-harness | history-driven-partitioning | deviation | no per-test duration history and no duration-based worker assignment; the answer to imbalance was a blunt global cap |
| test-harness | negative-control-tests | n/a | the RuleTester suites test the rules, not a mutated product path; no deliberate mutate-and-watch-it-fail procedure was found in the sampled tests |

| public-claim-provenance | degraded-never-claims-live | followed | `features/shared/components/LiveDataNotice.tsx:5-11` exists precisely because labelling each tile „ilustrativní ukázka" reads as an editorial choice rather than an outage — the fallback is stated once, at the top, in the page's voice; state is derived from the loader outcome, never from whether a value looks plausible |
| public-claim-provenance | no-data-source-labelled-inline | followed | `features/atlas/AtlasUnscored.tsx:11-21` — a source the atlas cannot measure gets a sentence naming the missing mechanism, not four „nehodnoceno" cells that would assert something false; labels state the reason and what would change it |
| public-claim-provenance | derived-numerator-authored-denominator | followed | `features/landing/components/DataSources.tsx:57-61,124-137` separates the hand-authored `INGESTED_SOURCES.length` declaration from the measured counts and labels it as declared, not measured |
| public-claim-provenance | build-time-derivation-off-the-client-bundle | followed | the heavy passes are `import "server-only"` and cannot enter the client bundle (`features/civicscore/getLeaderboardData.ts:38`, `features/atlas/getAtlasData.ts:22`); `/metodika` derives every published figure by importing the module that computes it, with `WEIGHT_TOTAL` summed rather than typed (`features/civicscore/MetodikaPage.tsx:12-17,44-46`) |
| public-claim-provenance | presentation-invariants-on-derived-values | followed | missing is not zero — `absenceRate: number \| null` and the `numOrNull`/`num` split (`features/civicscore/getLeaderboardData.ts:63-65,226-233`) fix an earlier zero-substitution; the breakdown's rounding drift is measured and footnoted rather than claiming an identity it cannot keep (`getLeaderboardData.ts:19-27`) |
| public-claim-provenance | promise-only-what-ships | followed | the only forward-looking surface is the correction link, and it points at a mechanism that exists — a prefilled mailto carrying the claim ref, page URL and date (`messages/cs.json` `feedback.*`); no confirmation copy promises a follow-up |
| table | client-server-split | followed | both real tables load a complete, bounded set once and filter/sort/window on the client — 207 rows (`features/civicscore/components/LeaderboardTable.tsx:185-194`), 211 ties (`features/money/components/TiesLedger.tsx:110-176`); one clean regime, never split across tiers |
| table | sorting | partial | `compareLeaderboardRow` (`features/civicscore/getLeaderboardData.ts:195-198`) is a total order — score, then Czech collation, then `pspId` identity — with a dedicated probe (`leaderboardOrder.test.ts`), and ranks are competition-ranked so ties share a rank; but `TiesLedger`'s sortable `Th` sets no `aria-sort` (0 hits repo-wide), so sort state is not announced |
| table | pagination | followed | `features/money/components/TiesLedger.tsx:64,174-176,286-292` — client-side offset over a small fixed set, `PAGE_SIZE=25`, with the shown/total counts carrying the active predicate |
| table | performance | partial | rung 0 was done once and written down (the per-row six-segment breakdown was removed after measuring ~1 533 SVG paths at 207 rows, `LeaderboardTable.tsx:12-21`) and rows are keyed by identity, not index; but no row is memoised, so all 207 `motion.div` rows re-render on every search keystroke, with no measurement recorded for that path |
| table | loading-and-empty-states | partial | both tables are server-rendered populated, so the placeholder half does not arise; the filtered-empty copy names that a filter is active but not which predicate (`messages/cs.json` `emptyFilters`) |
| canvas-graph | render-budget | partial | rung 1 is structural — pan/zoom/hover live in a ref and drive one coalesced `requestAnimationFrame` redraw, so pointer movement re-renders no React (`features/graph/components/GraphStage.tsx:118,427-433`), with the StrictMode rAF cleanup trap fixed and memoed; label budget scales with zoom behind one collision-avoiding priority queue (`:355-377`). Rung 2 is undercut by the edge culling below |
| canvas-graph | direct-manipulation | followed | for the read-only subset that applies: pointer capture on press and release on every exit path (`GraphStage.tsx:583,609`), a 2 px movement threshold separating click from drag, and the trailing click suppressed so a pan release does not select |
| canvas-graph | viewport-transform | partial | zoom-to-point is written once and every entry point uses it, with the scale clamped in that one place (`GraphStage.tsx:551-561`); but screen↔world conversion is inlined three more times — `draw()`'s `screen()` (`:313`), `hitTest()`'s inverse (`:532-533`) and the fit math (`:463-472,486-498`) — which is the fragmentation the technique says diverges the day the transform gains a wrinkle |
| canvas-graph | edge-management | deviation | `GraphStage.tsx:191` culls an edge when **both** endpoints are offscreen — the technique's named anti-pattern, which deletes exactly the long cross-graph links a reader is following. Shared anchor geometry is correctly central (one `positions` map + `radiusOf`); directed edges carry `src`/`dst` and a relation label but draw no arrowhead |
| canvas-graph | canvas-accessibility | partial | the refusal is deliberate and honest — „Proto tu není tabIndex, který by lhal" (`GraphStage.tsx:24-26`) — and the substitute is a real combobox palette with arrow keys and `aria-activedescendant` (`features/graph/components/NodeSearch.tsx`), which the technique accepts as primary navigation; but there is no roving node cursor, no topological walk, and no text rendering of the graph |
| canvas-graph | graph-layout | n/a | `/graf` is a read-only viewer — positions come from one server-computed layout and no node can be dragged, so the user-authored-versus-generated provenance bit has nothing to record |

## Deviations backlog

Ranked by value. Items marked ✅ were fixed in this pass.

1. ✅ **`custom/no-raw-number-display` was warn-only at a measured zero** — a
   ratchet that had already graduated but kept its scaffolding, so the burn-down
   could silently reverse. Promoted to `error` under `features/**`
   (`eslint.config.mjs`); `app/**` was already there.
   *(public-claim-provenance/provenance-as-a-build-gate, quality-gates/ratchet-design)*
2. ✅ **The commit rung suppressed the advisory display channel** —
   `lefthook.yml` ran `eslint --quiet`, which fault injection proved was a pure
   display switch (exit 0 with and without, since no `--max-warnings` is set).
   It destroyed the only channel a warn-level rule has, at the one rung where
   the author is looking, and bought no enforcement. Removed.
   *(quality-gates/severity-by-construction)*
3. ✅ **The tamed vitest workers lived only in memos** — `vitest.config.ts` had
   the 60 s timeouts but not the `maxWorkers: 3` cap, so `npm run test`,
   pre-push and CI all ran the PGlite files at the parallelism measured flaky on
   2026-08-04. Cap checked in with its measurement.
   *(embedded-db/single-writer-holder-discipline)*
4. ✅ **Stale pointers to a retired script** — `memory/whole-artifact-invariants-beat-pattern-gates.md`,
   its paired `MEMORY.md` index line, the script's own usage header, and 61 of
   `context-map.json`'s 932 path refs pointed at pre-`archive/` locations.
   Remapped; 4 refs to genuinely deleted files remain (below).
   *(codebase-scanning/verify-after-generate, docs-sync/source-doc-mapping)*
5. ✅ **The gate was described in three places and agreed with none** —
   CLAUDE.md and AGENTS.md called `npm run check` a three-step chain for a
   six-step script and named six custom rules for eight. Corrected, with the
   `check`-vs-CI asymmetry and the empty census registry written down.
   *(quality-gates/policy-projection)*
6. **`/graf` culls an edge only when BOTH its endpoints are offscreen**
   (`features/graph/components/GraphStage.tsx:191`). The registry names this
   exact anti-pattern: an edge is visible if any part of its geometry crosses
   the viewport, and endpoint-only culling deletes precisely the long
   cross-graph links a reader is trying to follow — on the one surface whose
   subject *is* the relationships. The cheap correct fix is a segment- or
   bounding-box-versus-view-rect test in place of the two `inView` calls; it can
   only ever draw more, never fewer, edges. Deliberately not taken here: this
   pass had already spent its two discretionary fixes, and a rendering change
   deserves its own diff. **Rank this first for the next wave.**
   *(canvas-graph/edge-management, render-budget)*
7. **`npm run check` ⊅ CI and CI ⊅ `npm run check`.** `census:test` and
   `library:check` run only locally; the schema-drift check and `build` run only
   in CI. A check that runs only on the author's machine is a courtesy. Add both
   local-only steps to `.github/workflows/ci.yml`.
   *(quality-gates/gate-laddering)*
8. **`npm run census` cannot exit 0 and is therefore wired to nothing.**
   `scripts/census/rules.json` deliberately holds zero adopted rules (2 satisfied,
   7 declined, 36 unreviewed — a reviewed, honest state), but the ported runner
   treats an empty registry as a structural failure. The runner is a verbatim
   port and must not be forked here; the fix belongs upstream in personas — an
   empty-but-reviewed registry is a *pass*, not a broken instrument. Until then
   `.ai/manifest.yaml`'s `catalog-census` capability names a command that always
   fails. *(quality-gates/gate-liveness)*
9. **Nothing enforces `docs/feature-doc-map.json`.** The coupling map is good and
   the definition of done cites it, but there is no checker, so there is no
   denominator and no gate — and the map's own header is already stale
   ("25 contexts / 9 groups" vs 48/10). Port a `check-doc-sync` step and add it
   to both `npm run check` and CI.
   *(docs-sync/same-change-enforcement, checked-vs-skipped-denominators, doc-rot-detection)*
10. **No ratchet on `custom/require-source-citation`.** 11 warnings remain
   (`features/dashboard/components/FactRow.tsx:77`,
   `features/graph/components/NodeSearch.tsx:158`,
   `features/shared/poster/demo/LeaderboardPoster.tsx` ×9), and nothing stops a
   twelfth. Either fix the three files and graduate the rule as
   `no-raw-number-display` just did, or put the count under the census ratchet.
   *(quality-gates/severity-by-construction, ratchet-design)*
11. **PGlite fixture economics.** Every store-backed test file boots WASM +
    DDL in its own `beforeAll`; the worker cap treats the symptom. A
    build-once/copy-per-test template plus a `pglite-integration` lane split from
    a wide `unit` lane would likely let parallelism scale back up.
    *(test-harness/fixture-economics, isolation-lanes, suite-partitioning)*
12. **No run-once migration ledger and no pre-DDL snapshot.** `CORE_DDL`
    reapplies at every boot behind `if not exists` guards, so every guard is
    load-bearing forever and nothing knows when work is pending to snapshot
    before. Architectural — not a patch.
    *(migrations/idempotent-steps, pre-migration-snapshots)*
13. **No retention policy on five append-only tables** (`kg_node_history`,
    `kg_edge_history`, `change_event`, `review_audit`, `lens_submission`) and no
    per-table storage accounting. This is a product/retention decision, not an
    engineering-only fix. *(embedded-db/storage-accounting-and-pruning)*
14. **No hardcoded-string detector.** `custom/no-raw-number-display.cjs` is a
    near-identical template to copy; today catalog discipline is cultural.
    *(i18n/string-extraction-enforcement)*
15. **The manifest's spec does not ship with it.** `.ai/manifest.yaml:4` cites a
    `docs/AI_MANIFEST_SPEC.md` that does not exist here and an absolute path into
    a sibling checkout. Vendor the spec or drop the citation.
    *(repo-manifest-standard/spec-ships-with-artifact)*
16. **Four `context-map.json` refs point at genuinely deleted files** —
    `lib/civic/dataSources.test.ts`, `features/landing/components/TrendChart.tsx`,
    `features/votetrack/kompas/copy.ts`, `features/votetrack/record/copy.ts`.
    A rescan should drop them; hand-deleting entries from a generated file was
    out of scope for this pass. *(codebase-scanning/dead-code-detection)*
17. **`features/schranka/followCodec.ts` has no in-payload version.** Version-in-
    the-key means the next shape change orphans every reader's follow list. The
    repo holds a reviewed counter-position; if it stands, the cheap hedge is an
    in-payload version field added now, while the shape is still v1.
    *(client-state/persistence-and-migration)*
18. **No db self-instrumentation.** Query timing, per-table counters and
    lock-wait tracking are absent; performance regressions are found by hand
    afterwards. *(embedded-db/db-self-instrumentation)*
19. **No structured error taxonomy or user-facing message registry.** Three
    hand-authored failure surfaces, no category threading through
    `reportLoaderFailure`. Low urgency at one dominant failure shape.
    *(error-handling/structured-propagation, user-facing-mapping)*
20. **`sentinel.yml` has no trigger.** The lane is well-built and honest about
    never-ran; it just does not run on a clock yet.
    *(test-harness/long-lane-certification)*
21. **`aria-sort` appears nowhere** (0 hits across `features/`), so
    `TiesLedger`'s sortable headers change the order without announcing it.
    One attribute per `<th>`, driven by the existing `sortKey`/`sortDir`.
    *(table/sorting)*
22. **Screen↔world conversion is written four times inside `GraphStage.tsx`**
    (`draw()`'s `screen()`, `hitTest()`'s inverse, `zoomAt`, the fit math).
    Self-consistent today because it is one file; the failure mode is the first
    wrinkle — a clamp, a device-pixel correction, a content-fit offset — landing
    in one of them. Extract `toWorld`/`toScreen` and let everything derive.
    *(canvas-graph/viewport-transform)*
23. **All 207 leaderboard rows re-render on every search keystroke.** Rows are
    keyed by `pspId`, so memoising them is safe; today nothing does, and unlike
    the rest of this codebase no measurement is recorded for that path.
    *(table/performance)*
24. **Directed edges on `/graf` draw no arrowhead.** `src`/`dst` and `rel` are
    carried but direction is only conveyed through hover highlighting, on a
    surface whose subject is the relationships. *(canvas-graph/edge-management)*
25. **`GraphStage`'s `onWheel` never calls `preventDefault()`**, so a page
    scroll and a canvas zoom can co-fire where an ancestor scrolls.
    *(canvas-graph/viewport-transform)*
26. **Filtered-empty copy names that a filter is active, not which one.**
    Interpolate the live predicate into `emptyFilters`.
    *(table/loading-and-empty-states)*
