# Combined Bug-Hunt + UI-Perfectionist Scan — politicas, 2026-07-26

> Combined single-pass audit merging the Bug Hunter and UI Perfectionist agent lenses.
> 25 parallel subagent runs (one per context, full project coverage), batched in waves of 8. Each subagent produced exactly 5 findings, mixing both lenses in whatever ratio the code actually warranted (no artificial split).

---

## Totals

| | Critical | High | Medium | Low | **Total** |
|---|---:|---:|---:|---:|---:|
| Across 25 contexts | 9 | 36 | 68 | 12 | **125** |
| Share | 7% | 29% | 54% | 10% | 100% |

Lens split: **84 Bug** (67%) / **41 UI** (33%).

Baseline health at scan time: 0 TypeScript errors, 352/352 tests passing (36 test files).

---

## Per-context breakdown

(Sorted by criticals desc, then by high desc)

| # | Context | Group | Critical | High | Medium | Low | Total | Report |
|---|---|---|---:|---:|---:|---:|---:|---|
| 1 | Ingestion Normalization | Data Ingestion | 1 | 1 | 2 | 1 | 5 | `ingestion-normalization.md` |
| 2 | Source Adapters | Data Ingestion | 1 | 2 | 2 | 0 | 5 | `source-adapters.md` |
| 3 | Money Case Files & Human Review | Financial Transparency | 1 | 2 | 2 | 0 | 5 | `money-case-files-human-review.md` |
| 4 | PGlite Repositories | Data Layer | 1 | 2 | 2 | 0 | 5 | `pglite-repositories.md` |
| 5 | i18n & Number Formatting | Infra & Observability | 1 | 2 | 2 | 0 | 5 | `i18n-number-formatting.md` |
| 6 | Custom ESLint Rules | Infra & Observability | 1 | 2 | 2 | 0 | 5 | `custom-eslint-rules.md` |
| 7 | FollowTheMoney Graph | Financial Transparency | 1 | 1 | 3 | 0 | 5 | `followthemoney-graph.md` |
| 8 | Knowledge Graph Domain Model | Data Layer | 1 | 1 | 3 | 0 | 5 | `knowledge-graph-domain-model.md` |
| 9 | Sample Data Fallback | Data Layer | 1 | 1 | 3 | 0 | 5 | `sample-data-fallback.md` |
| 10 | Landing Page | Landing & Navigation | 0 | 3 | 2 | 0 | 5 | `landing-page.md` |
| 11 | Graph Playground | Knowledge Graph Explorer | 0 | 2 | 3 | 0 | 5 | `graph-playground.md` |
| 12 | BudgetMirror | Financial Transparency | 0 | 2 | 2 | 1 | 5 | `budgetmirror.md` |
| 13 | MP Profile Dossier | MP Profiles & Rankings | 0 | 2 | 2 | 1 | 5 | `mp-profile-dossier.md` |
| 14 | PGlite Store & Runtime | Data Layer | 0 | 2 | 2 | 1 | 5 | `pglite-store-runtime.md` |
| 15 | Velin Dashboard | MP Profiles & Rankings | 0 | 2 | 3 | 0 | 5 | `velin-dashboard.md` |
| 16 | VoteTrack | Voting & Legislation | 0 | 2 | 3 | 0 | 5 | `votetrack.md` |
| 17 | Admin Console | Data Ingestion | 0 | 1 | 3 | 1 | 5 | `admin-console.md` |
| 18 | App Shell & Navigation | Landing & Navigation | 0 | 1 | 3 | 1 | 5 | `app-shell-navigation.md` |
| 19 | CivicScore Leaderboard | MP Profiles & Rankings | 0 | 1 | 4 | 0 | 5 | `civicscore-leaderboard.md` |
| 20 | LawWatch | Voting & Legislation | 0 | 1 | 3 | 1 | 5 | `lawwatch.md` |
| 21 | Scoring & Verdict Copy | Data Layer | 0 | 1 | 3 | 1 | 5 | `scoring-verdict-copy.md` |
| 22 | Shared Display Primitives | Shared UI Primitives | 0 | 1 | 2 | 2 | 5 | `shared-display-primitives.md` |
| 23 | Test Utilities & Loader Coverage | Infra & Observability | 0 | 1 | 4 | 0 | 5 | `test-utilities-loader-coverage.md` |
| 24 | App Bootstrap & Global Styles | Infra & Observability | 0 | 0 | 4 | 1 | 5 | `app-bootstrap-global-styles.md` |
| 25 | Archived Art Direction (Rentgen) | Shared UI Primitives | 0 | 0 | 3 | 1 | 4* | `archived-art-direction-rentgen.md` |

\* Rentgen agent reported 5 total but one entry was a "good news" verification note, not a defect — 4 actionable findings; counted as 5 in the raw tallies above since the file itself declares `> Total: 5`.

---

## All 9 critical findings — one-line summary

Grouped into themes for triage.

### A. Data trust violations — the review/verification gate can be silently bypassed
1. **Money Case Files & Human Review — Keyboard double-submission race on the verification gate** — rapid `1`/`3` keypresses fire two concurrent `submitReviewDecision` calls with no in-flight guard on the keyboard path; server response order (not reviewer intent) decides the final state. `features/money/components/VerificationConsole.tsx:108-139,161-164`
2. **PGlite Repositories — Lost-update race on `kg_edge.props.review_state`** — no transaction/row-lock around the review read-modify-write; concurrent decisions on the same tie can silently discard one decision while both land in the append-only audit log. `lib/db/pglite/repositories/review.ts:29-70`
3. **Knowledge Graph Domain Model — Rejected money ties still counted in trails** — `moneyTrails()` treats a human-`rejected` link the same as `pending_review`; a refuted tie's company/contract totals still contribute, only flagged `fullyVerified: false`. `lib/analysis/kg-money.ts:277-297`

### B. Silent data-integrity failures on the "trust is the product" transparency features
4. **FollowTheMoney Graph — Two independent unresolved-edge gates diverge stats from the ledger** — company-side and person-side "drop if unresolved" checks happen at different points, so displayed stat tiles (pendingTies, reachable CZK) can never reconcile with the visible ledger rows. `features/money/getMoneyData.ts:44-116`
5. **Source Adapters — Three distinct legal forms (v.o.s./k.s./družstvo) all mapped to the wrong "sro" dataset** — confidently queries the wrong CKAN dataset, surfacing as an indistinguishable "record not found" instead of a wrong-guess signal, defeating the module's ARES VR corroboration purpose. `lib/ingest/sources/dataor.ts:137-152`
6. **Sample Data Fallback — The "never break the page" fallback can itself hard-crash at import time** — `buildLeaderboard()` runs eagerly at module load and throws if hand-maintained score bands drift from the anchor dataset, taking down every importing page exactly when the real DB is already down. `lib/civic/leaderboard.ts:71-85,211`

### C. Broken numeric trust primitives
7. **i18n & Number Formatting — No non-finite guard anywhere in the formatting layer** — any `NaN`/`Infinity` upstream value renders literally as `"NaN"` or `"Infinity"` in budget figures, scores, and percentages app-wide. `lib/format.ts:14,17,31,34`

### D. Infrastructure that's supposed to catch the above, but doesn't
8. **Ingestion Normalization — Unbounded zip decompression (zip-bomb risk)** — `inflateRawSync` has no output-size cap; a crafted/corrupted archive can exhaust process memory across the entire shared ingest path. `lib/ingest/zip.ts:67`
9. **Custom ESLint Rules — Server/client boundary rule blind to dynamic `import()`** — `no-server-import-in-client.cjs` only visits `ImportDeclaration`, never `ImportExpression`, so a code-split `import("./getGoalData")` leaks PGlite/DB code into the client bundle with zero lint signal. `eslint-rules/no-server-import-in-client.cjs:32-52`

---

## Triage themes

| Theme | Approx count | Why this is a wave, not just individual fixes |
|---|---:|---|
| **A. Review-gate race conditions & data trust** | 6 (3 Critical + 3 High) | All touch the human-verification pipeline (VerificationConsole, review.ts, kg-money.ts, admin mirror) — one mental model: "what happens under concurrent/partial writes to review state." |
| **B. Silent numeric/formatting failures (NaN, division-by-zero, non-finite)** | 8 (1 Critical + several High/Medium) | AnimatedScore, i18n/format.ts, contribution scoring, leaderboard fallback all share the same missing-guard pattern — one shared fix (a `Number.isFinite` guard helper) closes several at once. |
| **C. Money/graph data-integrity mismatches** | 7 (2 Critical + High/Medium) | getMoneyData.ts, kg-money.ts, getAdminData.ts, dataor.ts all silently miscount or misclassify financial/entity ties — same failure family: stats and rendered rows built from divergent filter passes. |
| **D. Ingestion & source-adapter robustness** | ~12 | Source Adapters, Ingestion Normalization, PGlite Store & Runtime, PGlite Repositories — backend data-pipeline hardening: zip bomb cap, transaction safety, poisoned-state recovery, timezone coercion. |
| **E. Custom lint-rule false negatives (tooling blind spots)** | 5 | All 6 custom ESLint rules have an AST-matching gap that silently unenforces the invariant they exist to guard — one wave, one file family. |
| **F. Landing/dashboard/profile UI consistency & polish** | ~20 | Landing Page, Velin Dashboard, MP Profile Dossier, CivicScore Leaderboard, VoteTrack — component-architecture/design-system findings clustered by shared visual-language gaps (color-coding drift, responsive breakpoints, dead affordances). |
| **G. Graph/canvas interaction robustness** | ~8 | Graph Playground, Velin Dashboard's state graph — resize races, memoized-null poisoning, keyboard/focus gaps on canvas-rendered interactives. |
| **H. Shared primitives & app-bootstrap hardening** | ~10 | Shared Display Primitives (AnimatedScore NaN passthrough), App Bootstrap & Global Styles, Archived Rentgen route — used everywhere, compounding impact. |
| **I. LawWatch/VoteTrack legislative-data correctness** | ~9 | LawWatch's collision-detection regex bug, VoteTrack's invisible excused-vote segment, BudgetMirror's i18n-keyed chart series. |
| **J. Test/tooling coverage gaps** | 5 | Test Utilities & Loader Coverage — server-only stub could mask real prod-only failures; weak assertions on the loader test. |

---

## Suggested next-phase split

A 7-wave plan, ordered by trust/severity impact first, then by shared mental model:

- **Wave 1 — Review-gate race conditions & data trust (Theme A)**: VerificationConsole double-submit guard, review.ts transaction wrap, kg-money.ts rejected-tie exclusion. ~5-6 fixes, all touching the human-review pipeline.
- **Wave 2 — Silent numeric failures (Theme B)**: shared `Number.isFinite` guard in format.ts, AnimatedScore NaN guard, leaderboard band-derivation fix, contribution.ts clamp gaps. ~6-7 fixes.
- **Wave 3 — Money/graph data-integrity mismatches (Theme C)**: getMoneyData.ts unified resolution pass, dataor.ts legal-form slug fix, getAdminData.ts steward-fabrication fix. ~5-6 fixes.
- **Wave 4 — Ingestion & backend robustness (Theme D)**: zip.ts size cap, PGlite Store poisoned-state fix, timezone coercion bug, transaction-safety for chunked upserts. ~6-7 fixes.
- **Wave 5 — Custom lint-rule false negatives (Theme E)**: fix all 6 rules' AST gaps in one focused session (shared file family, shared debugging approach). 5 fixes.
- **Wave 6 — UI consistency & polish across dashboards/profiles (Themes F+G)**: split further if needed — landing/dashboard color-coding and responsive fixes, graph-playground resize/keyboard fixes. ~10-12 fixes, may need 2 sub-waves.
- **Wave 7 — Shared primitives, bootstrap, legislative-data correctness, test coverage (Themes H+I+J)**: mop-up wave for remaining mediums/lows. ~10 fixes.

---

## How this scan was run

- **Scanner**: combined Bug Hunter (`agent_bug_hunter`) + UI Perfectionist (`agent_ui_perfectionist`) role-prompts merged into a single per-context pass, per user request ("5 items per context combined for ui-perfectionist + bug-hunter").
- **Date**: 2026-07-26
- **Scope**: all 25 contexts in the politicas context map (full project, both client and server code — this is a unified Next.js app with no separate backend service directory).
- **Method**: 25 parallel `general-purpose` subagents, one per context, batched in 4 waves of ≤8. Each subagent read every file in its context's scope in full (plus targeted cross-file verification reads), analyzed through both lenses, and wrote exactly 5 findings to its own report file.
- **Findings target**: fixed at 5 per context per user instruction (combined, not 5-per-lens).
- **Verification**: findings counted two independent ways (`> Total:` header sum = 125; `**Severity**:` bullet count = 125) — they matched, confirming no malformed reports.
- **Files read**: approximately 230+ file reads across all subagents combined (most contexts read their full scope plus 1-4 cross-file verification reads).
- **Baseline health** (captured before scan): 0 TypeScript errors, 352/352 tests passing across 36 test files.
