# Field Report v2 — politicas — shard logic-data-platform

Shard = ai-agents (16) + integrations-security (19) + platform-delivery (16),
scored fully; plus data-persistence (score PGlite + client analogues) and
backend-runtime (score error/telemetry/logging/events analogues, rest n/a-absent).

## Headline counts

- **Leaves touched: 88** (51 named "full-score" + ~19 data-persistence + ~7 backend-runtime analogues + domain-level n/a rollups).
- **holds: 12 · holds(self): 15 · violates: 0 · partial: 14 · n/a-absent: 40 · n/a-scope: 7**
- **Deviations worth a fix: 3** (all low severity; the repo is unusually mature — no correctness violations found).
- **Coverage:** deep-scored (executed) **28** leaves off 14 file reads + 8 greps; shallow (head/grep-only) **14**; the remaining ~46 are domain-level `n/a-absent` rollups (no LLM call site, no Rust/IPC/Tauri backend, no credential vault) — enumerated, never fabricated.
- **Enrichment candidates: 8**, headed by politicas' own **four-state adherence ledger** (`scripts/census/rules.json` + `check-library-adherence.mjs`) — the `satisfied` fourth state is a genuine refinement the corpus should absorb.

---

## 0. Orientation + independence declaration

**Repo shape.** politicas is a Czech civic-transparency Next.js 16 / React 19 / TS
app. Local-first **PGlite** (in-browser/in-process WASM Postgres) is the store;
data is ingested from public government feeds (psp.cz, smlouvy, kiosek.justice.cz,
dataor, pumper) and rendered through deterministic analysis/verdict pipelines.
There is **no generative LLM call site in the product** (grep for
`anthropic|openai|claude-|messages.create` hits only `.claude/skills/**` agent
tooling, never `app/ lib/ features/`), **no Rust / Tauri / IPC** (self-declared in
the ledger; no `.rs`, no `src-tauri`), and **no credential vault / OAuth / column
encryption** (the only `encrypt` hits are ZIP inflate/deflate in
`packages/czech-civic-data/src/zip.ts`). Secrets are two shared operator tokens
(`ADMIN_TOKEN`, `REVIEWER_TOKEN`) behind one constant-time chokepoint.

**Entanglement with the corpus — high, and declared honestly.** politicas keeps
`scripts/census/rules.json`: a **four-state adherence ledger** against
`personas@f9e3a33fd`, with a vendored catalogue (`library-index.json`, 247 leaves
/ 45 written) and a gate (`check-library-adherence.mjs`) wired into `npm run
check`. Source comments cite corpus doctrine **verbatim** — "instrument before
result", "a killed call must still produce a row", "the kernel's rule is that a
dropped row is logged, never silent", "a loud no-op instead of a false green".
This repo was built *reading this corpus*. Therefore every hold that maps to a
principle the repo already reviewed is flagged **`holds(self)`** — weaker
evidence of universal physics than an independent hold, though several are
independent *by a different mechanism* (Result-returning error contract;
version-in-key persistence; structural anonymity), which the ledger itself argues
is arguably *stronger* than the library's own prescription.

**Ledger state consumed as ground truth:** `satisfied` = {client-state-persistence,
swallowed-error-telemetry}; `declined` = {ipc-command-authorization,
new-ipc-command, command-naming-placement, bridge-type-contract,
rust-unit-test-harness, feature-flagged-compilation, row-to-struct-mapping} — all
seven declines are Rust/IPC/Tauri leaves with substantive reasons.

`.claude/worktrees/ci-push/**` is a stale duplicate checkout and was excluded
from all measurement (it is also `globalIgnores`d in `eslint.config.mjs`).

---

## 1. Scorecard

| leaf | clauses | verdict | notes (file:line) |
|---|---|---|---|
| **ai-agents** |||
| headless-model-call | P1–P7 | n/a-absent | no product model call site; grep clean across app/lib/features |
| model-and-effort-selection | P1–P7 | n/a-absent | `vote_tag.model/method` (ddl.ts:386) stamps a *deterministic classifier*, not a generative model; no selection cascade |
| failure-recovery-strategy | P1–P5+ | **partial** | `fetchWithRetry` retries ALL non-ok uniformly — no failure-class taxonomy (kiosek.ts:191-209). See §2 |
| structured-output-extraction | P1–P8 | n/a-absent | no LLM extraction; analogue = typed parsers with load-bearing-field guards ("no silent-truncation exception", kiosek.ts:238) |
| prompt-assembly | prose | n/a-absent | no prompt assembly |
| spend-ceilings | P1–P7 | n/a-absent | no spend; token.ts three-state gate echoes P3 (absent/valid/corrupt) but no money |
| llm-spend-accounting | P1–P6 | n/a-absent | no LLM billing |
| autonomy-gating | P1–P7 | **partial** | P2 fail-closed HOLDS in token.ts:47-58 & accessGate.ts:49-57; P3/P4/P5 (kill-switch, hold-clock) n/a — no autonomous actor |
| agent-dispatch | prose | n/a-absent | no agent dispatch |
| untrusted-definition-validation | prose | **holds** | decodeWeights rejects-never-repairs (weights.ts:51-62); IČO modulo-11 checksum + "only when labelled IČ" (kiosek.ts:39); single codec chokepoint |
| informed-consent-gate | prose | **partial** | analogue = disclosure doctrine: k-anonymity n≥20 "disclosed on every surface" (weights.ts:9-13); not an AI-action consent gate |
| ai-draft-preview-apply | prose | n/a-absent | analogue = review confirm/reject BEFORE `kg_edge.props.review_state` flip (ddl.ts:249) |
| model-composed-ui | prose | n/a-absent | no model-composed UI |
| human-review-queue | prose | **holds(self)** | review_audit append-only, single writer, audit row predates state flip, /admin gated console, decision CHECK enum (ddl.ts:247-265; accessGate.ts) |
| selective-per-item-verdicts | prose | **holds** | per-edge confirm/reject/needs-more keyed on (src,rel,dst) (ddl.ts:253-265) |
| findings-triage-queue | prose | **partial**(shallow) | money leads + case-loop review console (accessGate.ts:6) — surface confirmed, internals not deep-read |
| **integrations-security** |||
| secret-display-and-transfer | prose | **holds(self)** | token.ts: never logged, `server-only`, sha256+timingSafeEqual so even length can't leak (token.ts:18-30) |
| automated-credential-provisioning | prose | n/a-absent | no credential provisioning |
| credential-capture-form | prose | n/a-absent | only a single shared-token unlock; no credential form |
| least-privilege-scope-grant | prose | **holds** | admin cookie scoped to /admin path, httpOnly, 12h max-age ("a forgotten open tab is not a standing grant", accessGate.ts:29-34) |
| oauth-connect-flow | prose | n/a-absent | no OAuth |
| credential-rotation-and-revocation | prose | n/a-absent | rotation = env-var change; cookie 12h expiry is the only time-bound |
| credential-readiness-resolution | prose | **holds(self)** | TokenGate `not-configured` ≠ `unauthorized` ≠ `ok` — unconfigured surface states it plainly (token.ts:32-39; accessGate.ts:36-41) |
| connection-health-check | prose | **partial**(shallow) | lib/db/readiness.ts probe exists; not deep-read |
| credential-slot-binding | prose | n/a-absent | no per-persona credential slots |
| secret-and-pii-redaction | prose | **holds(self)** | scrubFollowTelemetry strips follow-list keys keeps count (sentry.server.config.ts:28-29); structural anonymity (weights.ts:9-13) |
| column-encryption-at-rest | prose | n/a-absent | no encryption; store is public data. Integrity via hash chain, not confidentiality (ddl.ts:267-284) |
| sync-reconciliation-and-conflicts | prose | **holds** | upsert dedup-last-wins (internals.ts:118-132); non-append-only feed reconciliation (kiosek poll-forward-dedup-by-url); bitemporal supersede + history tables (ddl.ts:286-339) |
| portable-export-bundle | prose | **holds**(partial) | ledger = pure fns, bit-for-bit reproducible "against exported rows" for an external auditor; versioned canonical serialization (ledger.ts:1-26) |
| vault-key-handling | prose | n/a-absent | no vault/key material |
| filesystem-boundary | ~ | **partial**(shallow) | analysis scripts "read a COPY of the directory" (internals.ts:32); no caller-supplied path-traversal surface found |
| outbound-http-call | prose | **holds** | 4/5 adapters bind `AbortSignal.timeout` (dataor 180s, monitor 30s, pumper 60s, smlouvy 30s); throttle+backoff; kiosek defers to injected fetchers (DI) |
| external-url-opening | ~ | **holds**(shallow) | 69 `rel=`/noopener occurrences across 27 feature files on external links |
| sql-console | prose | n/a-absent | no raw-SQL input surface; all PGlite access is parameterized repo methods |
| cross-device-pairing | prose | n/a-absent | no pairing/P2P |
| **platform-delivery** |||
| environment-variable-configuration | prose | **holds** | .env.example (10KB documented); process.env gated; "silent no-op when DSN unset" (sentry.server.config.ts:2-13) |
| feature-flagged-compilation | P? | **n/a-scope** | declined(self) in ledger — no cargo build |
| compile-time-env-embedding | prose | **partial** | NEXT_PUBLIC_ envs embedded (DSN, APP_ENV); no embed-gate |
| codegen-task-registration | prose | **partial** | db:snapshot (gen-migration.ts) + census index build are codegen steps; no central registry |
| bundling-native-assets | prose | n/a-absent | no native/ONNX assets (PGlite WASM is an npm dep) |
| installer-acceptance-testing | prose | n/a-absent | web app; Dockerfile+fly.toml deploy, no installer |
| tauri-permissions-and-csp | prose | n/a-absent | no Tauri; Next CSP-header analogue not verified |
| release-pipeline | prose | **partial**(shallow) | Dockerfile + fly.toml; no release.yml/tag workflow |
| adding-a-ci-gate | oneWay | **holds(self)** | ci.yml gates + sentinel.yml self-corrects "skipped-step = false green"; check-library-adherence asserts instrument-before-result (exit 2). §3 |
| custom-lint-rule | prose | **holds(self)** | 8 rules in packages/eslint-plugin-civic-transparency at "error" + RuleTester tests (test:rules in CI) + per-rule docs |
| cross-artifact-drift-gate | prose | **holds(self)** | db:snapshot --check (CORE_DDL↔SQL) + PROVENANCE ported-sha (CRLF-normalized) + census self-test |
| secret-leak-scanning | prose | n/a-absent | no gitleaks in lefthook/CI. Maturity gap — §2 |
| commit-path-gates | prose | **holds** | lefthook pre-commit eslint-staged (fast, staged-only); pre-push tsc+vitest; "hooks NEVER stash/overwrite tree" (lefthook.yml) |
| live-ui-test-automation | oneWay | n/a-absent | no Tauri :17320 harness; analogue = scripts/smoke.ts + sentinel store-audit |
| rust-test-fixtures | prose | n/a-absent | no Rust; census __fixtures__ = deliberate-violation corpus analogue |
| rust-unit-test-harness | prose | **n/a-scope** | declined(self) — Vitest + eslint-plugin RuleTester are the equivalent lane |
| **data-persistence (applicable)** |||
| schema-inexpressible-invariant | prose | **holds** | CHECK(decision in…) (ddl.ts:258); single-writer chokepoints per derived table; validate-never-repair at write |
| status-transition-rules | prose | **holds** | ingest_run status 'running'→finished; audit row predates state flip (ddl.ts:14-24,247) |
| backfill-migration | prose | **holds(self)** | `add column … default now()` with explicit honest semantics ("recorded since this migration", ddl.ts:296-305) |
| data-normalization-migration | prose | **holds** | *_norm ASCII-folded columns, indexed, "never fold at query time" (ddl.ts:5-6) |
| conditional-write | prose | **holds** | ON CONFLICT (id) DO UPDATE (internals.ts:158-162) |
| transaction-boundary | prose | **holds(self)** | upsertMany wraps N chunks in ONE pg.transaction (fixed partial-commit bug); serialized single conn (internals.ts:139-166) |
| paginated-list-query | prose | **holds** | limitOf clamp [1,2M]; stable order; warnIfTruncated guard (internals.ts:169-195) |
| dynamic-filter-query | prose | **holds** | parameterized; any($n::int[]); empty-IN-list trap handled (votes.ts:59-84) |
| id-generation | prose | **holds** | natural keys <publisher>:<table>:<id> (idempotent) + crypto.randomUUID for audit/lens (ddl.ts:6-8; weights.ts:60) |
| json-blob-column | prose | **holds** | raw jsonb verbatim + documented exception; GIN index; json() coercion→{} (ddl.ts; internals.ts:95-106) |
| timestamp-storage | prose | **holds** | timestamptz + default now(); bitemporal world/record time; infinity-Date guard (internals.ts:71-94) |
| upsert | prose | **holds** | ON CONFLICT DO UPDATE, dedup-last-wins, chunked, one txn (internals.ts:122-166) |
| schema-change / boot-migration-step | prose | **holds** | CORE_DDL at open() with `if not exists` create+alter = idempotent (internals.ts:48) |
| index-design | prose | **holds** | per-access-path btree + GIN; measured bitmap-scan note (ddl.ts; votes.ts:69) |
| delete-semantics | prose | **holds**(partial) | append-only history "nothing updates/deletes history rows"; supersede-not-delete (ddl.ts:308-312) |
| persisted-model-struct | prose | **holds**(shallow) | typed Row interfaces + mappers; provenance quartet every row (types.ts/mappers.ts) |
| row-to-struct-mapping | prose | **holds** | by-NAME coercion (mapVoteEvent, num/str/isoTs); rusqlite-positional version declined(self) |
| query-latency-instrumentation | prose | **partial** | truncation guard is correctness not latency; no per-query timing |
| connection-pool (Rust leaf) | prose | **holds**(analogue) | memoised single-conn open() with rejected-promise reset (internals.ts:41-57) |
| **backend-runtime (analogues; rest n/a-absent)** |||
| swallowed-error-telemetry | prose | **holds(self)** | SATISFIED — Result-returning + no-silent-catch/no-silent-null-catch @error + reportLoaderFailure. Console-only doors noted §2 |
| structured-logging | prose | **partial**(shallow) | reportLoaderFailure + Sentry breadcrumbs + structured warnIfTruncated |
| telemetry-scrubbing | prose | **holds(self)** | scrubFollowTelemetry beforeSend/beforeSendTransaction (sentry.server.config.ts:28-29) |
| typed-error-contract | prose | **holds** | TokenGate/AdminGateStatus unions; Result {ok:false,error} (token.ts:39; weights.ts:40) |
| command-input-validation | prose | **holds**(partial) | write-path validation: decodeWeights, checkSharedToken trims, IČO checksum; route-handler layer shallow |
| backend-to-frontend-events | prose | **n/a-scope** | no IPC transport; change_event is a domain table not a bus |
| polling-loop | prose | **partial** | ingest cadence is cron-script; ?entita= is a filter not a poll |
| ~36 remaining backend-runtime (IPC def/auth, job-coord, eventing transport, background-work) | — | **n/a-absent** | no Rust/IPC/Tauri backend; 4 explicitly declined(self) |

**Shard totals:** holds 12 · holds(self) 15 · violates 0 · partial 14 · n/a-absent 40 · n/a-scope 7.

---

## 2. Deviations (nothing applied — read-only shard)

**None are correctness violations.** All three are low-severity maturity/efficiency gaps in an otherwise exemplary repo.

1. **failure-recovery-strategy — partial (low).** `fetchWithRetry`
   (`lib/ingest/sources/kiosek.ts:191-209`) retries *every* non-ok response and
   *every* thrown error uniformly, up to `retries`, with linear backoff. It reads
   the structured `res.status` (satisfies P2) but never classifies it: a permanent
   `404`/`400` is retried identically to a transient `503`/timeout. Corpus P1/P5
   physics: recovery is a function of the failure *class*, and eligibility should
   derive from the class, not apply one answer to everything. **Held reason:** for
   a throttled ingest adapter the blast radius is ≤3 wasted retries against a
   permanently-4xx endpoint — wasteful, never data-corrupting — and the same
   loop underpins several adapters, so the fix is a shared classifier, not a
   per-adapter patch. Worth adopting a `retryable(status|error)` predicate.

2. **secret-leak-scanning — n/a-absent, flagged as maturity gap (low).** Neither
   `lefthook.yml` nor `.github/workflows/ci.yml` runs a secret scanner
   (gitleaks/trufflehog). The repo relies on `.gitignore` + the convention "never
   commit a real DSN" (sentry.server.config.ts:7). No committed secret was found,
   and the only secrets are env-injected operator tokens — so the risk is low —
   but this is the one D9-class control the corpus names that the repo has neither
   built nor declined. Candidate for a one-line pre-commit gate.

3. **query-latency-instrumentation — partial (low).** There is no per-query timing
   or slow-query telemetry; performance evidence is ad-hoc code comments ("bitmap
   index scan — measured", votes.ts:69) and the correctness-oriented
   `warnIfTruncated`. Acceptable for a single-process PGlite store, but the leaf's
   physics (a query's latency must be observable) is only partially met.

*Minor note (not a deviation):* `warnIfTruncated` (internals.ts:190) and the
`json()` coercion catch (internals.ts:101) reach **console only**, not Sentry.
This is intentional for server-side ingest (console → server logs) and the ledger
already records swallowed-error-telemetry as `satisfied` by the Result contract —
recorded here only so a future reader knows the truncation guard's door is a log,
not an event.

---

## 3. Enrichment

| # | candidate | file:line | physics argument | in_corpus | corpus path | lane |
|---|---|---|---|---|---|---|
| 1 | **Four-state adherence ledger** (the `satisfied` state) | `scripts/census/rules.json`; `scripts/census/check-library-adherence.mjs:93-117` | adopted/declined/unreviewed makes every un-adopted principle a permanent accusation, which is how advisory tooling gets muted. The **fourth state — `satisfied`: the principle applies and this repo already meets it by a NAMED mechanism with a re-runnable `verifiedBy` command** — is the state the repo's first two gate attempts *should* have started in (both scored 0 true positives writing a gate from a principle before reading the code). It converts "we didn't adopt your rule" from an accusation into evidence. | **refines-existing** | adding-a-ci-gate.md / corpus governance | ENRICH |
| 2 | **Truncation guard** ("limit == rowcount ⇒ systematically truncated, warn") | `lib/db/pglite/internals.ts:169-195` | An ordered read whose result exactly equals its `limit` is indistinguishable from a full read, and because it is ordered the loss is *systematic* (whatever sorts last is simply absent), not random — the exact bug that grew `supplies` 2 290→153 731 and silently dropped every late-sorting company. A reusable "warn on exactly-at-limit" primitive belongs in the pagination principle. | **refines-existing** | paginated-list-query.md | ENRICH |
| 3 | **DDL↔snapshot drift gate** | `scripts/gen-migration.ts:32-48`; ci.yml:47-48 | The executed schema (`CORE_DDL`) and the reviewed artifact (`0001_civic_graph.sql`) are two representations of one truth; a `--check` gate in CI fails the build when they diverge. Independent second implementation of the corpus pattern (CRLF-normalized to avoid cry-wolf). | **built-elsewhere** | cross-artifact-drift-gate.md | SCAN-confirm |
| 4 | **PROVENANCE ported-sha drift, cry-wolf-proof** | `check-library-adherence.mjs:137-163` | A drift gate that hashes the LOCAL copy as-ported (not the upstream) and normalizes CRLF before hashing, precisely because the corpus's own drift gates mis-reported byte-identical fixtures and fresh Windows clones as drifted. The discriminator "compare like with like" is the reusable lesson. | **refines-existing** | cross-artifact-drift-gate.md | ENRICH |
| 5 | **Sentinel "unevaluable report, exit 2" doctrine** | `.github/workflows/sentinel.yml:9-33` | A gate that cannot evaluate (store absent on a hosted runner) must write a schema-valid report with every check `unevaluable` and **exit 2**, never render a green skip. Independently caught + fixed the exact "skipped step = false green" defect the corpus's `adding-a-ci-gate` catalogues. | **refines-existing** | adding-a-ci-gate.md | ENRICH |
| 6 | **Tamper-evident audit ledger** (hash chain + Merkle seal, versioned canonical serialization, domain-separated hashes) | `lib/db/pglite/ledger.ts:1-73`; `ddl.ts:267-284` | An append-only human-review trail made verifiable bit-for-bit by an external auditor: sha256 over a domain-separated, versioned canonical preimage; per-run Merkle seal. Integrity-not-encryption is the correct posture for a *public-data* store (confidentiality is moot; provable non-tampering is the value). No corpus leaf covers verifiable audit trails. | **absent** | (nearest: human-review-queue.md / portable-export-bundle.md) | ENRICH |
| 7 | **Constant-time shared-token chokepoint + 3-state readiness** | `lib/security/token.ts:26-58` | ONE comparison door for every operator secret; sha256+timingSafeEqual so neither value nor length leaks via timing; `not-configured` distinct from `unauthorized` so an unwired surface says so. Two callers (money write, admin console) that "used to be one copy waiting to happen" now share it. | **built-elsewhere / refines** | credential-readiness-resolution.md + secret-display-and-transfer.md | ENRICH |
| 8 | **Structural anonymity by schema shape** | `lib/db/pglite/repositories/weights.ts:9-19`; `ddl.ts:367-380` | Privacy made a structural impossibility rather than a policy promise: the `lens_submission` table has three columns and the repository "never receives — so can never store — anything about the submitter"; the k-anonymity floor (n≥20) is a pure read-time derivation disclosed on the surface. "Can't store what you can't receive" is a sharper prescription than redaction. | **refines-existing** | secret-and-pii-redaction.md / informed-consent-gate.md | ENRICH |

---

## 4. Methodics

- **Executed vs shallow.** 14 file reads (token.ts, accessGate.ts, ci.yml,
  sentinel.yml, eslint.config.mjs, ddl.ts, gen-migration.ts, ledger.ts head,
  votes.ts, internals.ts, kiosek.ts ×2 sections, sentry.server.config.ts,
  weights.ts, library-index.json, check-library-adherence.mjs, rules.json) + 8
  greps (LLM call sites, encrypt, fetch/http, process.env, AbortSignal, rel=,
  kiosek fetch, leaf presence). **28 leaves scored from executed evidence; 14
  shallow (head/grep-only); ~46 domain-level n/a-absent rollups.** Deep-dive count
  ~14, within the ~15 cap.
- **Two-implementation cross-checks.** (a) outbound-http timeouts verified across
  all 5 ingest adapters (4 bind `AbortSignal.timeout`, kiosek uses DI). (b)
  Truncation guard confirmed at two call sites with matching hazard comments
  (votes.ts + weights.ts). (c) Transaction boundary + upsert confirmed at the
  shared `upsertMany` helper, exercised by votes.ts.
- **Self-correction.** Initially flagged kiosek.ts as an outbound-http timeout
  *violation* (no `AbortSignal` in its fetch loop). Re-checked: kiosek takes
  `fetchOne`/`KioskFetchers` as injected dependencies (DI for testability), so the
  timeout is the injected fetcher's concern — downgraded from violation to
  no-finding.
- **Self-match discipline.** 15 verdicts flagged `holds(self)` because the repo
  vendors and gates against this corpus. Where the mechanism is genuinely
  independent (Result-returning error contract; version-in-key persistence; hash
  chain; structural anonymity) the ledger's own argument that these are *stronger*
  than the library prescription is recorded rather than discounted.
- **Instrument gaps.** No DB probe was run (the live `.pglite` store is a 1.6 GB
  gitignored data dir; the kit forbids mutating/build commands and the sentinel
  itself notes the store is unreachable from a clean environment) — data-model
  verdicts rest on the authoritative `CORE_DDL` string + repository source, which
  is the source of truth PGlite executes at `open()`, not a live query.
