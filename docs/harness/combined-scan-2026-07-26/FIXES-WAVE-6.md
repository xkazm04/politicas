# Combined Scan Fix Wave 6 — Custom ESLint Rule False Negatives

> 5 commits, 5 findings closed.
> Baseline preserved: 0 TS errors → 0 TS errors, 352/352 tests → 352/352 tests, full `eslint .` run → 0 new violations after every commit.

## Commits

| # | Commit | Findings closed | Severity | Files |
|---|---|---|---|---|
| 1 | `07909f6` fix(lint): no-server-import-in-client now checks dynamic import() too | custom-eslint-rules.md #1 | Critical | `eslint-rules/no-server-import-in-client.cjs` |
| 2 | `0bf9e9b` fix(lint): no-silent-catch now flags promise.catch(() => {}) too | custom-eslint-rules.md #2 | High | `eslint-rules/no-silent-catch.cjs` |
| 3 | `6145e52` fix(lint): no-silent-null-catch can no longer be defeated by an extra statement | custom-eslint-rules.md #3 | High | `eslint-rules/no-silent-null-catch.cjs` |
| 4 | `ab1fdd1` fix(lint): enforce-reduced-motion-fallback checks per-component, not per-file | custom-eslint-rules.md #4 | Medium | `eslint-rules/enforce-reduced-motion-fallback.cjs` |
| 5 | `4a2b839` fix(lint): no-hardcoded-colors skips known non-color JSX attributes | custom-eslint-rules.md #5 | Medium | `eslint-rules/no-hardcoded-colors.cjs` |

This wave is unusual in that every finding is a bug in a *lint rule*, not application code — each fix closes an enforcement gap for an invariant the codebase already believes it's protecting. Every commit was verified with a full `npx eslint .` pass (not just the changed rule file) to confirm the tightened rule produces zero new violations against the existing, already-lint-clean codebase.

## What was fixed (grouped by sub-pattern)

1. **AST-node-type blind spots (findings #1, #2)** — both `no-server-import-in-client` and `no-silent-catch` only registered a visitor for the "obvious" syntax form (static `import`, `try/catch`) and missed a syntactically-different-but-semantically-identical form (`import()`, `.catch()`) that the rule's name and doc comment both implied was covered. Fixed by adding the missing visitor (`ImportExpression`, `CallExpression`) alongside the existing one.

2. **Shape-gating instead of invariant-checking (finding #3)** — `no-silent-null-catch` required the catch body to be *exactly* one statement before inspecting it, so prepending any second statement (a legitimate `setLoading(false)`) trivially defeated the rule while the actual silent-degradation bug it exists to catch remained. Fixed by scanning every statement in the block for the two facts that actually matter (a nully return exists; no `reportLoaderFailure` call exists) instead of gating on the block's length.

3. **File-wide substring matching instead of scoped identifier tracking (finding #4)** — `enforce-reduced-motion-fallback`'s opt-out check was `fileText.includes("useReducedMotion")`, which matched inside unrelated identifiers/comments and, even on a genuine match, exempted every motion element in the file rather than just the one the reference actually gates. Fixed by tracking real `Identifier` references scoped to each element's outermost enclosing component function.

4. **Pattern matching with no attribute-context awareness (finding #5)** — `no-hardcoded-colors` flagged any hex-shaped string regardless of where it appeared, so a URL fragment (`href="#deadbeef"`) or a SHA-prefixed label tripped the same report as a real color with a misleading fix suggestion. Fixed by skipping literals whose value is the value of a JSX attribute from a denylist of attributes that are never CSS colors.

## Verification table (before/after counters)

| Check | Before wave | After wave |
|---|---|---|
| TypeScript errors | 0 | 0 |
| Tests passing | 352/352 (36 files) | 352/352 (36 files) |
| `npx eslint .` (full repo) | baseline clean | still 0 violations after every commit — each tightened rule verified against the whole codebase, not just its own test cases (these rules have no dedicated test file) |

## Cumulative status (across all waves so far)

- **Wave 1**: 5 findings closed — Theme A, Review-Gate Race Conditions & Data Trust.
- **Wave 2**: 9 findings closed — Theme B, Silent Numeric Failures.
- **Wave 3**: 4 findings closed — Theme C, Money/Graph Data-Integrity Mismatches.
- **Wave 4**: 5 findings closed — Theme D (part 1), Ingestion Normalization Hardening.
- **Wave 5**: 3 findings closed + 1 verified-not-applicable — Theme D (part 2), PGlite Backend Robustness.
- **Wave 6 (this wave)**: 5 findings closed (1 Critical, 2 High, 2 Medium) — Theme E, Custom ESLint Rule False Negatives.
- **Running total**: 31/125 findings closed, 1 verified false-positive.
- Remaining: ~93 findings across themes F–J (UI polish, graph/canvas robustness, shared primitives, legislative-data correctness, test coverage).

## Patterns established (additions to the catalogue, items 14-15)

14. **A lint rule's name is a promise about coverage that the implementation must be independently verified against** — every one of the five findings in this file was a rule whose docstring/messages described a broader invariant ("no silent catch," "no server import in client") than its actual AST visitor covered. When writing or reviewing a custom lint rule, explicitly enumerate every syntactic form the target pattern can take (sync/async, declaration/expression, statement/callback) and check the visitor list against that enumeration — don't assume the "obvious" form is the only form.
15. **Custom lint rules need the same testing discipline as application code, and usually don't get it** — none of these five rules had a dedicated test file (confirmed via `find eslint-rules -iname "*test*"` — zero results), so every one of these bugs shipped silently and would have kept shipping indefinitely without this scan. A `RuleTester`-based test file per custom rule (even 3-4 cases: one true positive, one true negative, one the fix specifically addresses) would have caught all five findings in this wave before merge.

## What remains

Themes F–J (UI polish across dashboards/profiles, graph/canvas interaction robustness, shared primitives & app-bootstrap hardening, LawWatch/VoteTrack legislative-data correctness, test/tooling coverage gaps) are all still open — see `INDEX.md` for the full per-theme breakdown.
