# Combined Scan Fix Wave 1 — Review-Gate Race Conditions & Data Trust

> 5 commits, 5 findings closed.
> Baseline preserved: 0 TS errors → 0 TS errors, 352/352 tests → 352/352 tests.

## Commits

| # | Commit | Findings closed | Severity | Files |
|---|---|---|---|---|
| 1 | `8e40f10` fix(money): guard review-console decisions against double-submit and re-decide races | money-case-files-human-review.md #1, #2 | Critical, High | `features/money/components/VerificationConsole.tsx` |
| 2 | `6d72ff0` fix(money): constant-time comparison for reviewer token | money-case-files-human-review.md #3 | Medium | `features/money/reviewActions.ts` |
| 3 | `b8197f1` fix(db): wrap review-state read-modify-write in a transaction | pglite-repositories.md #1 | Critical | `lib/db/pglite/internals.ts`, `lib/db/pglite/repositories/review.ts` |
| 4 | `03a2d47` fix(analysis): exclude human-rejected money ties from moneyTrails() | knowledge-graph-domain-model.md #1 | Critical | `lib/analysis/kg-money.ts` |

(Commit 1 closes two findings in the same file/same guard — the keyboard double-submit race and the re-decide-after-done race share one root cause and one fix.)

## What was fixed (grouped by sub-pattern)

1. **Client-side double-submission/re-decide guard (VerificationConsole.tsx)** — `handleDecide` had no check of the tie's current write phase before firing a new `submitReviewDecision` call. The mouse buttons disabled only via a JSX `disabled` prop during `"pending"`, which the keyboard shortcut path (1/2/3) bypassed entirely by calling `handleDecide` directly. A fumbled or rapid keypress could fire two concurrent writes for the same tie, and a stray click after completion could silently re-decide an already-written tie. Added a real guard inside `handleDecide` itself (`if (currentPhase === "pending" || currentPhase === "done") return`) so both the mouse and keyboard paths share one enforced invariant, and extended the button `disabled` condition to also cover `"done"`.

2. **Timing-safe token comparison (reviewActions.ts)** — the reviewer token was compared with plain `!==`, which is not constant-time; an attacker able to repeat requests against the public server-action endpoint could measure comparison latency to recover `REVIEWER_TOKEN` character by character. Replaced with SHA-256 digest + `crypto.timingSafeEqual`, which also hides input-length timing.

3. **Transactional review-state write (review.ts + internals.ts)** — `setTieReviewState` did select → insert-audit → update as three separate auto-committed statements with no lock, so two concurrent decisions on the same tie could both read the same `props` before either wrote, and whichever write landed last silently discarded the other's effect — even though both decisions were durably recorded in the audit log. Added a `transaction()` method to the shared `Pglite` interface (the real PGlite instance already supports it and serializes transactions against every other query on the single connection) and wrapped the whole read-modify-write inside one transaction callback.

4. **Rejected ties excluded from money trails (kg-money.ts)** — `moneyTrails()` treated a human-`rejected` link the same as `pending_review`, only downgrading `fullyVerified` to `false` instead of excluding it. A trail could present a contract-value total and company list that included a link a human explicitly refuted. Added an early `continue` for `state === "rejected"` before the link is folded into `byPerson`.

## Verification table (before/after counters)

| Check | Before wave | After wave |
|---|---|---|
| TypeScript errors | 0 | 0 |
| Tests passing | 352/352 (36 files) | 352/352 (36 files) |
| Lint (pre-commit hook) | — | clean on every commit |

## Cumulative status (across all waves so far)

- **Wave 1 (this wave)**: 5 findings closed (3 Critical, 1 High, 1 Medium) — Theme A, Review-Gate Race Conditions & Data Trust.
- Remaining: 120 findings across themes B–J (see INDEX.md).

## Patterns established (additions to the catalogue, items 1-3)

1. **UI-only in-flight guards are not real guards** — a `disabled` JSX prop on one input path (mouse click) does nothing to a parallel input path (keyboard shortcut) that calls the same handler directly. Any handler that must not be re-entered while a request is in flight needs the guard *inside the handler*, not decorating one caller.
2. **Single-connection embedded DB race pattern**: `select` → JS-side mutate → `update` across separate auto-committed statements is a classic read-modify-write race even on a single-connection embedded database (PGlite) — concurrency doesn't require multiple DB connections, just multiple concurrent JS callers sharing one. Wrap in `pg.transaction()` (PGlite serializes transactions against the shared connection) rather than assuming "single connection" implies "no race."
3. **Non-"verified" is not one bucket** — anywhere a review/approval state has more than two values (`verified` / `pending_review` / `rejected`), code that branches on `state !== "verified"` conflates "not yet decided" with "explicitly refused," which is usually wrong: a rejection should exclude, not just flag.

## What remains

Themes B (silent numeric failures), C (money/graph data-integrity mismatches beyond the review gate), D (ingestion & backend robustness), E (lint-rule false negatives), F–J (UI polish, graph/canvas robustness, shared primitives, legislative-data correctness, test coverage) are all still open — see `INDEX.md` for the full per-theme breakdown and suggested wave split.
