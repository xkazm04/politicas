# Combined Scan Fix Wave 8 — Profile, Money, and Legislative-Data Correctness

> 6 commits, 6 findings closed.
> Baseline preserved: 0 TS errors → 0 TS errors, 355→356 tests (added 1) → 356/356, `eslint .` clean throughout.

## Commits

| # | Commit | Findings closed | Severity | Files |
|---|---|---|---|---|
| 1 | `709a99f` fix(profile): isTrendTooEarly fails closed on unknown tenure length | mp-profile-dossier.md #2 | High | `lib/analysis/tenure-copy.ts`, `lib/analysis/tenure-copy.test.ts`, `features/profile/components/TenureTrendGate.tsx` |
| 2 | `b42a3c1` fix(profile): guard against empty components array crashing the page | mp-profile-dossier.md #3 | Medium | `features/profile/ProfilePage.tsx` |
| 3 | `b1829a0` fix(profile): drop co-voter rows whose person id fails to parse | mp-profile-dossier.md #4 | Medium | `features/profile/getProfileData.ts` |
| 4 | `3bb70e3` fix(lawwatch): primaryParagraph no longer truncates multi-letter suffixes | lawwatch.md #1 | High | `features/lawwatch/getCollisionData.ts` |
| 5 | `e2ebfd1` fix(analysis): track undisclosed subsidy amounts instead of zero-folding them | scoring-verdict-copy.md #1 | High | `lib/analysis/money-feed.ts`, `lib/analysis/money-feed.test.ts` |
| 6 | `b0cfd51` fix(money): let reviewers actually record a note with their decision | money-case-files-human-review.md #4 | High | `features/money/components/VerificationConsole.tsx` |

## What was fixed (grouped by sub-pattern)

1. **A "graceful null" gate that inverted its own discipline (mp-profile #2)** — `isTrendTooEarly` returned `false` (don't suppress) for any non-numeric tenure, treating "we don't know" as "long enough" — the opposite of this codebase's fail-closed convention everywhere else. Fixed the direction and updated the previously-pinned test, which had encoded the bug as expected behavior.

2. **A single unguarded derivation on an otherwise defensive page (mp-profile #3, #4)** — `ProfilePage` degrades gracefully everywhere except one `topComponent.label` access that assumed a non-empty array, and `getProfileData` validated every other numeric field except a co-voter's parsed person id. Both brought in line with the page's existing null-handling conventions.

3. **A regex quantifier one character too narrow (lawwatch #1)** — `[a-z]?` (at most one trailing letter) truncated genuine multi-letter paragraph suffixes like "35ba" to "35b", risking false merges in the app's forensic collision-detection feature. Widened to `[a-z]*`.

4. **Zero-folding an "unknown" value into an aggregate total (scoring-verdict-copy #1)** — `subsidiesByCompany` treated a genuinely undisclosed subsidy amount the same as a real 0 CZK subsidy, understating totals with no signal. Added `undisclosedCount` tracking, mirroring Wave 1/2's recurring "distinguish absent from zero" pattern.

5. **A UI input that was designed but never built (money #4)** — the review console's type/schema/banner copy all imply reviewer notes are recorded and audited, but the actual write call hardcoded `note: null`. Added the missing textarea and threaded it through the mouse-driven decision path (the keyboard-shortcut speed path still sends no note, which is an acceptable trade-off for that path's purpose, not a regression).

## An operational note (not a scan finding)

One commit in this wave (`b0cfd51`) unintentionally included a pre-staged, unrelated file from work already in progress in this repo before this session started: a zero-content-diff filename-case rename, `.claude/skills/prototype/skill.md` → `SKILL.md`. It was already sitting in git's staging area (not something this session added) when a `git add <intended-file>` + `git commit` picked up the whole index rather than just the newly-added file. The rename has no content change and no functional effect, so it was left in place rather than rewriting history to extract it — but it means that one commit's diff includes a file outside this wave's actual scope. Verified via `git status` that no other stray staged files exist before continuing; will re-check the index state before every future commit in this campaign.

## Verification table (before/after counters)

| Check | Before wave | After wave |
|---|---|---|
| TypeScript errors | 0 | 0 |
| Tests passing | 355/355 (37 files) | 356/356 (37 files) |
| `npx eslint .` (full repo) | clean | clean after every commit |

## Cumulative status (across all waves so far)

- **Wave 1**: 5 findings closed — Theme A, Review-Gate Race Conditions & Data Trust.
- **Wave 2**: 9 findings closed — Theme B, Silent Numeric Failures.
- **Wave 3**: 4 findings closed — Theme C, Money/Graph Data-Integrity Mismatches.
- **Wave 4**: 5 findings closed — Theme D (part 1), Ingestion Normalization Hardening.
- **Wave 5**: 3 findings closed + 1 verified-not-applicable — Theme D (part 2), PGlite Backend Robustness.
- **Wave 6**: 5 findings closed — Theme E, Custom ESLint Rule False Negatives.
- **Wave 7**: 5 findings closed (1 partial) — Theme F (part 1), Landing & Navigation.
- **Wave 8 (this wave)**: 6 findings closed — Theme F (part 2) + Theme I (part 1), Profile/Money/Legislative-Data Correctness.
- **Running total**: 42/125 findings closed (41 full + 1 partial), 1 verified false-positive.
- **Deferred**: mp-profile-dossier.md #1 (full i18n rewiring of the dossier section — larger scope, needs new translation keys across cs.json/en.json and 3+ component files) and #5 (SourceNote size variant — low-value design-system polish).
- Remaining: ~79 findings across themes F (remainder)–J.

## What remains

Theme F (remainder — Velin Dashboard, CivicScore, VoteTrack, BudgetMirror UI/data findings), G (graph/canvas robustness), H (shared primitives & bootstrap remainder), I (remainder — VoteTrack/LawWatch UI findings), J (test/tooling coverage) are all still open — see `INDEX.md` for the full per-theme breakdown.
