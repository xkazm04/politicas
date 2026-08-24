# Registry conformance — software-engineering

contributor: mkdol-dev-box · audited: 2026-08-24 · bundle: `ai-registry/knowledge/software-engineering`

Fourteen subjects selected against this repo's real surfaces: an embedded
single-writer Postgres (PGlite) behind a repository layer, a large offline
`scripts/` analysis pipeline, a ten-rule in-repo ESLint plugin carrying the
"every rendered number cites its source" doctrine, a composite local gate plus
CI, a Czech-first cs/en catalog, a whole-graph canvas, and one large ranking
table. Subjects with no surface here (fleet orchestration, IPC, packaging,
rate limiting, p2p, voice) are not padded in as n/a rows.

Every technique file was read before its row was written. A `deviation` is a
finding, not a shame.

**107 technique rows: 69 followed · 18 partial · 3 deviation · 17 n/a.** Wave 2 (2026-08-24) moved 21 rows to `followed` — 12 of the 15 deviations and 9 of the 27 partials — and moved one deviation to `partial`. The three deviations left are named in the backlog with the reason each is still there, and two of the three are not engineering calls.

| subject | technique | status | evidence |
|---|---|---|---|
| embedded-db | single-writer-holder-discipline | followed | `scripts/db/backup.ts:74-119` holds the connection, CHECKPOINTs, strips `postmaster.pid` from the copy, prunes by its own prefix; 0 store-opening script entrypoints lack an explicit `process.exit` (swept 2026-08-24) |
| embedded-db | connection-pooling | n/a | `lib/db/pglite/internals.ts:41-57` — PGlite is single-connection by construction; one memoized handle, no pool to size |
| embedded-db | db-self-instrumentation | followed | `lib/db/pglite/instrument.ts` wraps `query`/`exec`/`transaction` on the one memoised connection (cf6bef8) — no call site changed. Keyed `<table>/<read\|write\|ddl\|tx\|other>`, with the table vocabulary PARSED OUT OF `CORE_DDL` at load so `ddl.ts` stays the sole authority and statement text is never a key. One 512-record ring in parallel typed arrays (~14 KB, allocated once); p50/p95 by nearest-rank at READ time over observed samples, never interpolated and never maintained on the write path. Rows touched recorded (`affectedRows` fallback for writes; `-1` = unobservable, excluded rather than counted as 0). Thresholds calibrated against this store's own recorded figures — read 60 ms sits above the worst healthy sample (41,7 ms) and below the cheapest recorded pathology (101,7 ms) — and the report labels the two borrowed lines as borrowed. Warn channel rate-limits 3/key/60 s and COUNTS suppression, emitting one summary with the suppressed count and worst suppressed duration. Measured off-budget: disabled is object identity, enabled costs +1,17/+1,16/+1,29 µs per op over 20 000 A/B calls — 0,2 % of the fastest healthy query here. Lock-wait is declined with the reason stated in-file (one connection, so a pool counter would read zero forever and look like evidence); issue DEPTH is recorded instead and never reported as a duration |
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
| quality-gates | severity-by-construction | followed | the 11 `features/**` warnings that could never refuse are 0 (c765a61): `<PosterFrame citation={…}>` became a satisfier, so the poster's nine real citations stopped reading as nine exceptions, and two files carry a `citation-ok:` reason each. `require-source-citation` is now `error` under `features/**` — a probe rendering `{f.int(n)}` uncited is `1 error`, where it was a warning nothing could refuse. Three doctrine rules now graduate at a measured zero |
| quality-gates | gate-laddering | followed | `census:test` and `library:check` added to `.github/workflows/ci.yml` (dc56e15), so CI ⊇ `npm run check`; the reverse asymmetry (`db:snapshot --check`, `build`, `npm audit`) is named in `CI_ONLY_BY_DESIGN` with the clean-room reason each one needs. `lib/testing/gateLadder.test.ts` DERIVES the containment from `package.json` + the workflow and fails on either gap — replacing CI's `library:check` with `echo skipped` turns it red |
| quality-gates | policy-projection | followed | the prose was corrected earlier that day; what closes the row is that the load-bearing half stopped being a copy — `lib/testing/gateLadder.test.ts` parses the real `check` chain out of `package.json` and the real `run:` commands out of `ci.yml`, so the two rungs cannot disagree without a red test at the push rung |
| quality-gates | chokepoint-tag-registry | partial | `lib/format.ts` is the declared display-number chokepoint and `custom/no-raw-number-display` statically proves nothing escapes it; there is no registry enumerating the repo's other chokepoints (`app/globals.css` tokens, `getStore()`) |
| codebase-scanning | rule-precision-discipline | followed | `scripts/census/rules.json:$comment` — "writing a gate from a principle without reading the code first produces ~0% precision"; both attempts measured, dated, and given a `verifiedBy` command |
| codebase-scanning | sensor-pipeline | followed | `scripts/census/lib/engine.mjs` `validateRule` rejects a bad regex or missing floor before any scan; a malformed registry fails the run rather than scanning nothing (asserted in the self-test) |
| codebase-scanning | evidence-scoping | followed | every `globalIgnores` entry in `eslint.config.mjs:28-51` carries a written reason and an explicit statement of what it does **not** exempt; `memory/impeccable-detector-triage.md` records a 38/38-false-positive scan and the config that scoped it |
| codebase-scanning | llm-assisted-scanning | partial | `docs/architect/` and `docs/harness/` are LLM scans with quoted evidence, and `memory/impeccable-detector-triage.md:35-40` fixes the triage rule ("reject a rule only after checking every instance it flagged") — but nothing verifies a quoted span still exists at the cited line |
| codebase-scanning | verify-after-generate | followed | both generated artifacts are now checked against reality: the SQL snapshot against `CORE_DDL` in CI, and `context-map.json` by `lib/testing/contextMapRefs.test.ts` (71db1f3) — 785 path refs walked, 0 dangling. One-way by design: naming a file that is gone is never normal, a file the generator has not yet seen is. It asserts its own denominator (≥700) first, so an emptied walk cannot pass as "0 dangling" |
| codebase-scanning | finding-lifecycle | partial | findings live as dated prose in `docs/architect/`, `docs/harness/` and the route records; no dedup key and no close-verification, so a fixed finding stays in the record |
| codebase-scanning | dead-code-detection | partial | the map-side half is closed: the four refs to genuinely deleted files are gone and `contextMapRefs.test.ts` fails on any new one (71db1f3). Still open: `scripts/case-loops/**/archive/` is quarantine-not-delete (the right posture) and nothing yet proves an archived script is unreferenced from the other direction |
| codebase-scanning | incremental-scanning | n/a | census and lint run at full repo scope every time; no since-last-scan mechanism exists and the tree is small enough not to need one |
| codebase-scanning | ingestion-budget | n/a | every scanning target is this repo's own tree, read from disk |
| docs-sync | dated-corrections | followed | every memo and config comment carries its date and measurement; `memory/robocopy-of-a-live-pglite-store-can-corrupt.md:18-38` carries two dated addenda that correct the original reading rather than overwriting it |
| docs-sync | coupled-surface-inventory | followed | `docs/feature-doc-map.json` declares source→doc couplings, names the altitude that dismisses each, and explicitly lists the dated artifacts that must never be retro-edited |
| docs-sync | cross-repo-drift-detection | followed | `scripts/census/check-library-adherence.mjs` re-hashes the ported personas engine and reports drift ("engine copy matches personas@f9e3a33fd") without needing the sibling checkout |
| docs-sync | same-change-enforcement | followed | `scripts/docs/check-doc-sync.mjs` + the lefthook `commit-msg` rung (2e42ec2, 63119d0) read the VCS diff — never a transcript — with `-M` so a rename reports both sides. Satisfaction is on the NAMED doc, never a `docs/` prefix. Dismissal is a `Doc-sync(<doc>): <reason>` commit trailer, counted and printed, reasons under 12 chars refused. Proven live: it refused a real commit in this very session and named the three docs it owed |
| docs-sync | checked-vs-skipped-denominators | followed | every block of `check-doc-sync.mjs` prints `n drifted of m checked, k skipped` with the four reason classes (unresolvable / precondition-absent / instrument-absent / record-incomplete) listed even at zero, labels itself BLOCKING or informational in its own output, and puts the denominators inside the same object as the findings in `--json`. An empty denominator exits 2, not 0 — the resolution chosen and written into the file header |
| docs-sync | doc-rot-detection | followed | the header now says 48/10 and, more to the point, that claim is RE-DERIVED from `context-map.json` on every run and fails when the prose disagrees (block B); `--update-comment` rewrites it from the source rather than by hand |
| docs-sync | source-doc-mapping | followed | the count is derived, and coverage is reported from BOTH sides as an explicitly informational block: 45 of 48 contexts reached by some `sourceGlob` (the three that are not are named), 34 of 244 docs coupled, 191 honoured as declared exclusions via a machine-readable `unmappedByDesign` list, 19 neither — candidates, not violations, and the block says so in its own output |
| docs-sync | catch-up-markers | partial | `docs/routes/*.md` are append-only and dated, but no marker distinguishes covered-at-anchor from never-in-scope, so a catch-up pass would have no boundary to work from |
| docs-sync | source-as-data-without-the-app | n/a | no documentation gate reads a registry that lives in application source |
| repo-manifest-standard | capability-not-tool-vocabulary | followed | `.ai/manifest.yaml:16-27` — "Capabilities, not tools"; every entry is a name mapped to a real `package.json` script |
| repo-manifest-standard | must-ignore-unknown | followed | `.ai/manifest.yaml:2-4` states that unknown fields MUST be ignored, so the contract survives schema growth |
| repo-manifest-standard | pointers-not-embeds | followed | `.ai/manifest.yaml:29-37` points at contextMap / memory / design / routeRecords / docMap / lintRules instead of embedding any of them |
| repo-manifest-standard | semver-additive-evolution | followed | `schemaVersion: 0.1.0` is stamped on the artifact and separate from `schema: ai-manifest` |
| repo-manifest-standard | generated-from-provenance | partial | `generatedFrom` + `generatedAt` are present and every `verified:` is honestly `false`. The `catalog-census` lie is now DISCLOSED where a reader meets it (9eeefd9): the capability keeps its entry with the upstream defect written beside it, because dropping it would read as "this repo has no catalog census". Still open: nothing machine-checks the manifest against `package.json` — the nine checks are specified, not implemented |
| repo-manifest-standard | spec-ships-with-artifact | followed | `docs/AI_MANIFEST_SPEC.md` now exists here (2ea09e1) and resolves from the repo root in a fresh clone with no network. Checked before writing it: the cited sibling does not carry the document either, so the contract's definition lived nowhere at all. It carries the reimplementation clause and nine numbered conformance checks in prose precise enough to reimplement. No drift check accompanies it, per the technique's own decision rule — the source of truth is now a document in this repository, so the copy is a pointer and there is nothing to drift against |
| public-claim-provenance | provenance-as-a-build-gate | followed | the doctrine is a packaged plugin with per-rule docs and its own runner in the composite gate (`packages/eslint-plugin-civic-transparency/`, `npm run test:rules`); triggers stand on the `lib/format.ts` chokepoint, satisfiers are file-scoped, the escape hatch (`data-undisclosed`) is disclosed to the reader as a visible „bez zdroje" badge |
| client-state | singleton-lifecycle | followed | `lib/db/store.ts` `getStore()` caches the promise before awaiting, clears on rejection, and exposes `resetStoreCache()`; same shape in `lib/db/pglite/internals.ts` |
| client-state | rehydration-narrowing | followed | `features/schranka/followCodec.ts:131-160` guards each field independently and drops only the bad item; `isEntityKey` (`followCodec.ts:78-83`) is the single vocabulary gate |
| client-state | async-race-guards | followed | `features/schranka/useNews.ts:33-48` dedups in-flight requests and removes the entry on failure; `useNews.ts:75-93` compares a request signature before using a result |
| client-state | invalidation-strategy | partial | the only freshness mechanism is a 60 s TTL floor on the schránka news cache (`useNews.ts:20-34`); no event-driven invalidation exists, and no live channel exists to drive one |
| client-state | persistence-and-migration | followed | `SCHRANKA_SCHEMA_VERSION` is written INSIDE the payload as `v`, and the key is now permanently the address (e08a764). A payload with no `v` is shape 1 — what every earlier release wrote. An empty `MIGRATIONS` table carries the append-only rule where the next author will look. Skew runs both ways: a payload from the FUTURE is detected through `readSchranka()` and deliberately NOT overwritten (`useSchranka` refuses the write and says so). The repo's counter-position still stands for its other two cases, which carry no shape at all |
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
| i18n | string-extraction-enforcement | followed | `custom/no-hardcoded-display-string` at `error` over `app/**`, `features/**`, `components/**` (a038aaa). The threshold (≥3 letter-bearing words) was CALIBRATED against the live tree before the pattern was written — 484 / 287 / 227 / 158 hits at ≥1/2/3/4 words against 86 / 9 / 1 / 0 false positives — and `<style>`/`<script>` children excluded, giving 226/226 precision. All 226 live hits sit in six declared zones (operator console, review console, the provider-less global error boundary, two surfaces holding a written counter-position, archived labs); outside them the count is zero, which is why it ships blocking. The constant-table trigger the technique also names was measured and REFUSED with the numbers on the table |
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
| test-harness | isolation-lanes | followed | three declared lanes with their own budgets (956526a): `unit` (203 files, `maxWorkers` 11, short timeouts), `pglite` (16 files, tamed workers, 60 s hook timeout) and a non-blocking `quarantine` lane whose include list IS the register. `lib/testing/pglite-fixture.ts` is the one door to an isolated data dir and ASSERTS its preconditions rather than falling back: a fixture path that could resolve inside the repo (i.e. to the live `./.pglite`) is refused outright, the copy is structurally verified against the template before it is handed over, and running outside a lane degrades to the cold boot ANNOUNCED rather than silently |
| test-harness | fixture-economics | followed | build-once / copy-per-test (73410a9): `new PGlite(<empty dir>)` runs a full `initdb` and cost 4,1–4,8 s PER FILE; the template is provisioned once and each store-backed file now copies it in 969–1 219 ms measured (14 of 16 converted; 2 exempt with recorded reasons). THE AUDIT'S PREMISE WAS WRONG and the measurement says so: the cost is `initdb` (3 843–4 405 ms), not the DDL (279–346 ms cold, and only 24–61 ms to re-run over a provisioned database) — which is why `lib/db/pglite/internals.ts` needed no change at all. Copying THIS store is safe for the reason the live one is not, and the template file says which — the repo's own `robocopy-of-a-live-pglite-store-can-corrupt` memo is cited rather than re-litigated |
| test-harness | suite-partitioning | followed | `lib/testing/lanes.ts` is one authority for what runs where, and because an explicit path list is exactly the thing that rots silently, `lane-partition.test.ts` gates three properties on every run: the union of the lanes equals the legacy flat include set (nothing dropped), the lanes are disjoint (nothing runs twice under two budgets), and no file left in the unit lane carries a PGlite boot marker (nothing misfiled) — a new store-booting test that forgets to enlist turns the gate red with its own path named. Measured: 276,7 s under one config and one cap → 70,6 s |
| test-harness | flake-lifecycle | followed | all five transitions have a mechanism. DETECT: `npm run flake:detect` computes TRANSITION COUNTS over retained run history on the same HEAD with a clean tree, reports its own denominator, and says "no verdict available" rather than a percentage over three runs. QUARANTINE: `lib/testing/flake/registry.json` — an entry needs a named owner (a person, never a team), a date, an EXPIRY, a suspected cause, a form and evidence; it removes the file from the blocking lanes into `npm run test:quarantine`. RELEASE: `assertRegisterHealthy()` runs as a plain test in the blocking unit lane, so an expired quarantine goes red without anyone remembering a dashboard. The register is EMPTY and says why that is honest: the one measured instability was a contention symptom, i.e. a harness defect, and quarantining it would have hidden the measurement that fixed it. Labelling is deliberately NOT automatic and says so — promotion is a human decision, and an agent must never quarantine a test to make a build green |
| test-harness | history-driven-partitioning | partial | `lib/testing/flake/sequencer.ts` orders files by MEASURED median duration, descending (the limit is stated below, not hidden) — the greedy longest-first assignment the technique prescribes, applied at the only lever vitest offers (it hands the next file to the next free worker, so file order IS the bin-packing decision). It replaces vitest's own longest-first-by-BYTES heuristic, which is wrong here by orders of magnitude: `kgOrder.test.ts` is a small file that boots a WASM Postgres and the `messages.test.ts` files are large ones that finish in milliseconds. Cold start is handled the way the technique requires — an unmeasured file gets a PESSIMISTIC default at the current median and is interleaved, never zero (which would herd every new file to the end of the queue). The limit is written in the file rather than left to be discovered: CI starts on a fresh machine every run, so every file is cold and this degrades to the byte heuristic with a stable tiebreak — no worse, no better. It pays on a developer box and any runner with a warm cache — measured 47,6 s → 40,0 s on the pglite lane. Held at `partial` on the implementing worker's own judgement rather than mine: the technique asks for duration-based WORKER ASSIGNMENT, vitest exposes only file order, and CI starts cold every run, so the mechanism is real but its reach is smaller than the technique's |
| test-harness | negative-control-tests | n/a | the RuleTester suites test the rules, not a mutated product path; no deliberate mutate-and-watch-it-fail procedure was found in the sampled tests |

| public-claim-provenance | degraded-never-claims-live | followed | `features/shared/components/LiveDataNotice.tsx:5-11` exists precisely because labelling each tile „ilustrativní ukázka" reads as an editorial choice rather than an outage — the fallback is stated once, at the top, in the page's voice; state is derived from the loader outcome, never from whether a value looks plausible |
| public-claim-provenance | no-data-source-labelled-inline | followed | `features/atlas/AtlasUnscored.tsx:11-21` — a source the atlas cannot measure gets a sentence naming the missing mechanism, not four „nehodnoceno" cells that would assert something false; labels state the reason and what would change it |
| public-claim-provenance | derived-numerator-authored-denominator | followed | `features/landing/components/DataSources.tsx:57-61,124-137` separates the hand-authored `INGESTED_SOURCES.length` declaration from the measured counts and labels it as declared, not measured |
| public-claim-provenance | build-time-derivation-off-the-client-bundle | followed | the heavy passes are `import "server-only"` and cannot enter the client bundle (`features/civicscore/getLeaderboardData.ts:38`, `features/atlas/getAtlasData.ts:22`); `/metodika` derives every published figure by importing the module that computes it, with `WEIGHT_TOTAL` summed rather than typed (`features/civicscore/MetodikaPage.tsx:12-17,44-46`) |
| public-claim-provenance | presentation-invariants-on-derived-values | followed | missing is not zero — `absenceRate: number \| null` and the `numOrNull`/`num` split (`features/civicscore/getLeaderboardData.ts:63-65,226-233`) fix an earlier zero-substitution; the breakdown's rounding drift is measured and footnoted rather than claiming an identity it cannot keep (`getLeaderboardData.ts:19-27`) |
| public-claim-provenance | promise-only-what-ships | followed | the only forward-looking surface is the correction link, and it points at a mechanism that exists — a prefilled mailto carrying the claim ref, page URL and date (`messages/cs.json` `feedback.*`); no confirmation copy promises a follow-up |
| table | client-server-split | followed | both real tables load a complete, bounded set once and filter/sort/window on the client — 207 rows (`features/civicscore/components/LeaderboardTable.tsx:185-194`), 211 ties (`features/money/components/TiesLedger.tsx:110-176`); one clean regime, never split across tiers |
| table | sorting | followed | the total order and its probe were already right; the announcement was missing. `TiesLedger`'s `Th` now sets `aria-sort` from the existing `sortKey`/`sortDir` (80f6cc0) — `ascending`/`descending` on the active column and `none` on the other sortable ones rather than nothing, so a reader learns the column CAN be sorted. No second state model was introduced |
| table | pagination | followed | `features/money/components/TiesLedger.tsx:64,174-176,286-292` — client-side offset over a small fixed set, `PAGE_SIZE=25`, with the shown/total counts carrying the active predicate |
| table | performance | partial | rows are now a `React.memo` `LeaderboardRow` keyed by `pspId`, with prop identity verified site by site (4a6778a): `entry` survives `.filter()` by reference, the shared props are stable, the rest are primitives, and the toggle callback is passed through rather than re-wrapped per row. Deliberately still `partial`: this repo has no jsdom/render harness, so NO render-count or timing figure is claimed for that path — the file says exactly that in place of a number, which is the house rule |
| table | loading-and-empty-states | followed | the empty ledger now names the ACTIVE PREDICATES (48389a9) — tie class, corroboration, temporal state, club and the search query — in the same labels the chips carry, because two names for one filter is worse than none. The old copy stays as the zero-predicate fallback: an empty table with nothing filtering is a different fact and must not claim a filter is active. The placeholder half genuinely does not arise; both tables are server-rendered populated |
| canvas-graph | render-budget | followed | rung 1 unchanged and still structural (pan/zoom/hover in a ref, one coalesced rAF, the StrictMode cleanup trap fixed; the label budget scales with zoom behind one collision-avoiding queue). Rung 2 is repaired: edges are culled by GEOMETRY through `features/graph/viewCull.ts` (ecfce99), so a long cross-graph link with both endpoints offscreen is drawn again. The change can only ever draw more, never fewer |
| canvas-graph | direct-manipulation | followed | for the read-only subset that applies: pointer capture on press and release on every exit path (`GraphStage.tsx:583,609`), a 2 px movement threshold separating click from drag, and the trailing click suppressed so a pan release does not select |
| canvas-graph | viewport-transform | followed | one authority: `features/graph/viewTransform.ts` (`toWorld`/`toScreen`/`clampK`/`zoomAtPoint`/`centerOn`/`fitRect`) with a round-trip property test, and every site in `GraphStage.tsx` derives from it — including a FIFTH copy found during the extraction, the edge-label midpoint (e14526f). `fitRect` now clamps `k` through `clampK`, which the old `fitView` did not: the clamp belongs in the authority. Separately the wheel handler moved to a native non-passive listener, so canvas zoom cancels page scroll instead of co-firing with it (ecfce99) |
| canvas-graph | edge-management | followed | endpoint culling replaced by a Liang–Barsky segment-vs-rect test (`viewCull.ts`, 13 fixture tests; restoring the old semantics turns four of them red), and directed edges now draw an arrowhead at the DESTINATION anchor computed from the already-central `positions` + `radiusOf` — no second copy of node geometry — accumulated into one `Path2D` per bucket so the file's batching doctrine holds, and dropped entirely below `k = 0.55` per zoom-aware detail (ecfce99, ca3575e). Edge IDENTITY stays pair-shaped; the backlog records why that half is blocked rather than deferred |
| canvas-graph | canvas-accessibility | partial | the refusal is deliberate and honest — „Proto tu není tabIndex, který by lhal" (`GraphStage.tsx:24-26`) — and the substitute is a real combobox palette with arrow keys and `aria-activedescendant` (`features/graph/components/NodeSearch.tsx`), which the technique accepts as primary navigation; but there is no roving node cursor, no topological walk, and no text rendering of the graph |
| canvas-graph | graph-layout | n/a | `/graf` is a read-only viewer — positions come from one server-computed layout and no node can be dragged, so the user-authored-versus-generated provenance bit has nothing to record |

## Drained 2026-08-24 (wave 2)

Struck from the ranked backlog below, each with the commit that did it and the
honest residue — what the technique still asks for that this wave did not land.
A drained item with residue is still drained; a drained item with a hidden
residue would not be.

- ~~6. **`/graf` culled an edge only when BOTH endpoints were offscreen**~~ —
  `ecfce99`. **followed.** Liang–Barsky segment-vs-rect in
  `features/graph/viewCull.ts`, a pure module with 13 fixture tests; restoring
  the endpoint semantics turns four of them red. The fix can only ever draw
  more edges, never fewer. Residue: none.
- ~~7. **`npm run check` ⊅ CI and CI ⊅ `npm run check`**~~ — `dc56e15`.
  **followed.** `census:test` + `library:check` added to CI; the reverse
  asymmetry (`db:snapshot --check`, `build`, `npm audit`) is now named with the
  clean-room reason each needs. `lib/testing/gateLadder.test.ts` derives the
  containment from `package.json` + the workflow rather than asserting it in
  prose. Residue: none.
- ~~9. **Nothing enforced `docs/feature-doc-map.json`**~~ — `2e42ec2`,
  `63119d0`. **followed.** Reads the VCS diff, never a transcript; `-M` on, so
  a rename reports both sides. Satisfaction on the NAMED doc. Dismissal is a
  counted `Doc-sync(<doc>): <reason>` trailer with reasons under 12 characters
  refused. 32/32 self-test over scratch git repos, and it refused a real commit
  in this session. Residue: it reports 3 contexts no glob reaches
  (`packages/eslint-plugin-civic-transparency/`, `packages/czech-civic-data/`,
  `scripts/sentinel/`) and 19 docs that are neither coupled nor declared
  excluded — reported as informational candidates, deliberately not invented
  into couplings.
- ~~10. **No ratchet on `custom/require-source-citation`**~~ — `c765a61`.
  **followed** at `error` under `features/**`. Nine of the eleven warnings were
  `LeaderboardPoster.tsx`, which was never uncited — it builds a real citation
  and hands it to `<PosterFrame>`; the rule is file-scoped and could not see
  across the boundary, so the fix went into the RULE (`<PosterFrame
  citation={…}>` satisfies, with the prop required as the evidence) rather than
  into nine `citation-ok` annotations that would have taught the next author
  that the poster lane is exempt. Residue: none.
- ~~14. **No hardcoded-string detector**~~ — `a038aaa`. **followed.**
  `custom/no-hardcoded-display-string` at `error`, threshold calibrated against
  the live tree before the pattern was written (484 / 287 / 227 / 158 hits at
  ≥1/2/3/4 words against 86 / 9 / 1 / 0 false positives), 226/226 precision.
  Residue, stated in the rule's own header: recall is knowingly traded — one-
  and two-word labels are not caught, nor is any string built at runtime; the
  detector is a floor and the end-to-end check is a pseudo-locale sweep, which
  this repo does not yet run.
- ~~15. **The manifest's spec did not ship with it**~~ — `2ea09e1`.
  **followed.** `docs/AI_MANIFEST_SPEC.md` resolves from the repo root in a
  fresh clone with no network. Checked first: the cited sibling did not carry
  the document either, so the contract's definition lived nowhere at all.
  Residue: the nine conformance checks the spec specifies are prose, not yet a
  runner (see `generated-from-provenance`, still `partial`).
- ~~16. **Four `context-map.json` refs pointed at deleted files**~~ —
  `71db1f3`. **followed.** The four are gone AND the class is closed:
  `lib/testing/contextMapRefs.test.ts` walks 785 path refs and fails on any
  that does not resolve, asserting its own denominator first so an emptied walk
  cannot pass as "0 dangling". Residue: one-way by design — the reverse
  direction (a file the map has not yet seen) is the generator's coverage
  claim, not this gate's.
- ~~17. **`followCodec.ts` had no in-payload version**~~ — `e08a764`.
  **followed.** The version moved into the payload while v1 is still the only
  shape in the field; the key is now permanently the address. Skew handled in
  both directions — a payload from the future is detected and deliberately not
  overwritten. Residue: the repo's counter-position on version-in-the-key
  stands for its other two cases, which carry no shape at all; that is
  agreement, not debt.
- ~~18. **No db self-instrumentation**~~ — `cf6bef8`. **followed.** One ring,
  keyed by table+family with the vocabulary parsed out of `CORE_DDL`; p95 by
  nearest-rank at read time; rows touched recorded; thresholds calibrated
  against this store's own figures; suppression counted. Measured off-budget:
  disabled is object identity, enabled is +1,2 µs/op. Residue: lock-wait is
  declined with a stated reason (one connection — a counter reading zero
  forever looks like evidence), issue depth recorded instead; and
  `dbMetricsReport()` has no rendered consumer yet.
- ~~21. **`aria-sort` appeared nowhere**~~ — `80f6cc0`. **followed.** Driven by
  the existing `sortKey`/`sortDir`, `none` on the other sortable columns rather
  than nothing. Residue: none.
- ~~22. **Screen↔world conversion was written four times**~~ — `e14526f`.
  **followed.** It was five: the extraction found a silent copy in the
  edge-label midpoint. `features/graph/viewTransform.ts` is the authority and
  `fitRect` now clamps through `clampK`, which the old `fitView` did not.
  Residue: none.
- ~~23. **All 207 leaderboard rows re-rendered on every keystroke**~~ —
  `4a6778a`. **partial, deliberately.** The rows are memoised on `pspId` with
  prop identity verified site by site. But this repo has no jsdom or render
  harness, so no render count and no timing figure is claimed — the file
  records the absence instead of inventing a number, which is the same rule
  every other performance claim here obeys. The row stays `partial` until a
  measurement exists, not until the code changes again.
- ~~24. **Directed edges drew no arrowhead**~~ — `ca3575e`. **followed.**
  Computed at the destination anchor from the already-central `positions` +
  `radiusOf` (no second copy of node geometry), one `Path2D` fill per bucket so
  the batching doctrine holds, dropped below `k = 0.55` per zoom-aware detail.
  Residue: none.
- ~~25. **`onWheel` never called `preventDefault()`**~~ — `ecfce99`.
  **followed.** React attaches `wheel` to the app root as a PASSIVE listener,
  so the synthetic handler could never have cancelled anything; moved to a
  native listener on the wrap with `{ passive: false }`. Residue: none.
- ~~26. **Filtered-empty copy named that a filter was active, not which**~~ —
  `48389a9`. **followed.** The active predicates are named in the same labels
  the chips carry; the old copy stays as the zero-predicate fallback, because
  an empty table with nothing filtering is a different fact. Residue: none.

- ~~11. **PGlite fixture economics**~~ — `73410a9`, `956526a`, `c456d97`,
  `a2aba72`. **Four of five rows followed**, and the item turned out to be five
  rows rather than one. The cap was the wrong instrument, not too small a
  number, and the ranked item's own premise was wrong: the per-file cost is
  `initdb` (3 843–4 405 ms), NOT the DDL (279–346 ms cold, 24–61 ms to re-run
  over a provisioned database), which is why the store's own plumbing needed no
  change at all. Build-once/copy-per-test brought the per-file cost to
  969–1 219 ms; the lane split brought the suite from **276,7 s to 63,1 s**,
  with the test COUNT conserved exactly (225 files / 3 111 tests collected by
  the old flat behaviour; 209 + 16 and 2 936 + 175 by the lanes, empty
  intersection, nothing dropped and nothing phantom). Flake lifecycle and a
  duration-ordered sequencer landed with it. Residue, all of it stated in the
  files rather than left to be found: the quarantine register is EMPTY (the
  honest state — the one measured instability was a harness defect, and
  quarantining it would have hidden the measurement that fixed it), labelling is
  deliberately manual, `history-driven-partitioning` stays `partial`, and
  `maxWorkers: 3` was deliberately NOT loosened — single green runs at 4 and 6
  workers are not a stability window, and treating them as one is exactly what
  flake-lifecycle forbids.

Two items were not on the ranked list and are recorded because they were
larger than anything on it:

- **72 `SourceNote` size overrides across 29 files** — `776f01a`, plus a 73rd
  laundered through a prop default (`4fcf467`). `docs/DESIGN.md` §3 has
  forbidden `className="!text-[10px]"` on the citation primitive since
  2026-07-29 in plain words — "Do not add another" — and it had been added 72
  more times, putting the carrier of the brand rule back under the readability
  floor. A cultural rule that failed 72 times is not a rule, so `6800329` gives
  it `custom/no-source-note-size-override` at `error`, measured at zero against
  a live population of 404 call sites in 107 files.
- **Four route-level Suspense boundaries** — `0468ee1`, on `/dashboard`,
  `/denik`, `/penize` and `/penize/strety`, each citing the measured cold read
  it covers (~12 s money layer; 15 800 ms collision pass). `/zebricek` was
  ranked first for one and did NOT get it: measured, `buildLeaderboard()` is
  424–519 ms behind a cross-request memo, and a skeleton on a half-second route
  is a lie about latency.

## Deviations backlog

Ranked by value. Everything above has been struck; what follows is what this
wave did not close, each with the reason it is still here.

1. **`npm run census` cannot exit 0 and is therefore wired to nothing.**
   `scripts/census/rules.json` deliberately holds zero adopted rules (2
   satisfied, 7 declined, 36 unreviewed — a reviewed, honest state), but the
   ported runner treats an empty registry as a structural failure. **blocked:
   the runner is a verbatim port of personas' and must not be forked here** —
   forking a shared instrument is how two copies of it start disagreeing. The
   fix belongs upstream: an empty-but-reviewed registry is a *pass*, not a
   broken instrument. Since `9eeefd9` the manifest names the defect beside the
   capability rather than shipping a command that silently always fails.
   *(quality-gates/gate-liveness)*
2. **No run-once migration ledger and no pre-DDL snapshot.** `CORE_DDL`
   reapplies at every boot behind `if not exists` guards, so every guard is
   load-bearing forever and nothing knows when work is pending to snapshot
   before. **out-of-budget: architectural, not a patch** — it is a change to
   how the store boots, over a 2 GB live store, and it deserves its own pass
   with a rebuild rehearsal rather than a slice at the end of a wave.
   *(migrations/idempotent-steps, pre-migration-snapshots)*
3. **No retention policy on five append-only tables** (`kg_node_history`,
   `kg_edge_history`, `change_event`, `review_audit`, `lens_submission`) and no
   per-table storage accounting. **Split, and both halves stay open for
   different reasons.** Retention is `blocked: a product decision with no
   evident intent` — how long a civic-accountability record keeps its own audit
   trail is not an engineering call, and this repo's whole subject is that
   records are not quietly rewritten. The accounting REPORT half is pure
   engineering and merely `out-of-budget` this wave; note that
   `db-self-instrumentation` (now landed) supplies the other half of the join
   the technique wants — the rings say which table is slow, and an accounting
   report would say which is big.
   *(embedded-db/storage-accounting-and-pruning)*
4. **CHECKPOINT runs only inside a manual `npm run db:backup`.** No activity
   gate, and WAL growth between backups is unmanaged.
   **out-of-budget**, and adjacent to a hazard: maintenance writes to the live
   single-writer store while a concurrent session may hold it, which this
   repo's own memo about copying a live PGlite store exists to warn about.
   *(embedded-db/quiet-window-maintenance)*
5. **No structured error taxonomy or user-facing message registry.** Three
   hand-authored failure surfaces, no category threading through
   `reportLoaderFailure`. **out-of-budget**, and genuinely low urgency: both
   rows are `partial` rather than `deviation`, `taxonomy-design` is `n/a` for
   want of a consumer, and there is one dominant failure shape (loader fails →
   labelled fallback → report).
   *(error-handling/structured-propagation, user-facing-mapping)*
6. **`sentinel.yml` has no schedule.** **blocked: the repo holds a reviewed
   counter-position, and it is right.** The workflow has a trigger
   (`workflow_dispatch`); what it lacks is a cron, and its header explains why
   the cron was deliberately REMOVED — the live `.pglite` store cannot exist on
   a hosted runner, so a nightly would be red every night with zero
   information, which is the "permanent red refuses nothing" failure the
   laddering technique names. It earns a schedule at the ADOPTION POINT already
   marked in the file (self-hosted runner, or a store artifact), not before.
   The `long-lane-certification` row is `followed` for exactly this reasoning.
   *(test-harness/long-lane-certification)*
7. **Edges carry pair identity, not a durable minted id.** `kg_edge`'s primary
   key is `(src, rel, dst)`, and `review_audit`, `kg_edge_history` and
   `change_event` key on the same triple. **blocked: a schema migration that
   would strand persisted data.** Four tables would have to move together over
   a 2 GB live store that is in `neverTouch`, rebuilt from `data/raw/` which is
   also in `neverTouch`, and there is no way to rehearse the migration here.
   Worth recording that the defect the technique guards against cannot arise on
   this surface today: `/graf` is a read-only viewer (which is why
   `graph-layout` is `n/a`), so no user retargets an endpoint, and ingest is
   `(src, rel, dst)`-unique by construction. Re-open it with the ingest
   pipeline, not from the UI side.
   *(canvas-graph/edge-management — the identity half)*
8. **No render measurement for the memoised leaderboard rows.** The memo
   landed; the number did not, because there is no jsdom or render harness in
   this repo and adding one is a test-infrastructure decision that belongs with
   the lane split above, not beside a component change.
   *(table/performance)*
9. **Nothing machine-checks `.ai/manifest.yaml` against `package.json`.** The
    nine conformance checks are now specified in prose precise enough to
    reimplement (`docs/AI_MANIFEST_SPEC.md`), and no runner performs them. The
    honest blocker is small and specific: there is no YAML parser in
    `package.json`, and hand-rolling a subset parser would make the checker's
    own conformance claim narrower than the spec it enforces.
    *(repo-manifest-standard/generated-from-provenance)*
10. **Nothing proves an archived script is unreferenced.**
    `scripts/case-loops/**/archive/` is quarantine-not-delete, which is the
    right posture; the map-side half of this class is now gated, but the
    reverse direction is not.
    *(codebase-scanning/dead-code-detection)*
