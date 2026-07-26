# Sample Data Fallback — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. Fallback module can crash at import time via an eager top-level throw
- **Lens**: Bug
- **Severity**: Critical
- **Category**: latent-failure / fail-open-violation
- **File**: lib/civic/leaderboard.ts:71-85 (throw), :211 (eager top-level call)
- **Scenario**: `targetScore(rank)` iterates a hardcoded `bands` array (`[4,73]`, `[75,192]`, `[194,200]`) and throws `Error("rank ${rank} není ve výplňovém pásmu")` for any rank not covered. `export const LEADERBOARD = buildLeaderboard();` runs this for all 200 ranks **at module evaluation time** (import time), not lazily inside a request handler. If the sample anchor set in `data.ts` (`MPS`, currently ranks 1, 2, 3, 74, 193) is ever edited — e.g. a new sample MP is added at rank 50, or an existing anchor's `rank` is bumped by one — without updating the three band boundaries in lockstep, every import of `lib/civic/leaderboard.ts` throws synchronously.
- **Root cause**: The band boundaries are a second, hand-maintained encoding of the same anchor positions already declared in `MPS`. Nothing derives the bands from `ANCHOR_BY_RANK` automatically, and the failure mode for a mismatch is a hard throw rather than a clamp/skip.
- **Impact**: This module exists specifically to be *the graceful fallback that never breaks the page* when the real graph loader fails. A throw here doesn't degrade gracefully — it takes down every page that imports `LEADERBOARD` (dashboard, landing, votetrack aggregates) at build/first-import time, i.e. exactly when the app is already relying on the fallback because the primary data path is unavailable. Two independent failures (real DB down + stale fallback data) compound into a total outage instead of a mock dashboard.
- **Fix sketch**: Derive band boundaries programmatically from `ANCHOR_BY_RANK` (sort anchor ranks, build bands for the gaps automatically) so the two data structures cannot drift apart, or make `targetScore` degrade to a clamped nearest-band value instead of throwing. At minimum, wrap `buildLeaderboard()`'s call site in a try/catch with a hardcoded static fallback array so a bad edit can't crash the whole fallback layer.

## 2. Party-discipline math assumes every party has a `byParty` entry for every roll call — no guard, throws on drift
- **Lens**: Bug
- **Severity**: High
- **Category**: unguarded-lookup / silent-failure (crash-on-drift)
- **File**: lib/civic/votes.ts:35-40 (`disciplineByParty`), :43-54 (`chamberSplit`)
- **Scenario**: `disciplineByParty` does `rollCalls.map((rc) => Math.round(partyDiscipline(rc.byParty[p.code]) * 1000) / 10)` for every `p` in `PARTIES`, and `chamberSplit` does `rc.byParty[p.code]` the same way. Both assume `rc.byParty` has a key for every code in `PARTIES`. Today's 4 fixture `ROLL_CALLS` happen to enumerate all 7 party codes, but there is no type-level or runtime enforcement of that invariant. Adding an 8th party to `PARTIES` (a realistic future edit for a mock that says "200 seats 9. období"), or adding a `RollCall` fixture that omits a party with 0 seats voting, makes `rc.byParty[p.code]` return `undefined`, and `partyDiscipline(undefined)` throws (`pv.pro` on `undefined`).
- **Root cause**: `RollCall.byParty` is typed as `Record<string, PartyVotes>` (an open map), but every consumer treats it as if it were guaranteed total over `PARTIES` — the type doesn't capture that guarantee and nothing validates it.
- **Impact**: A single incomplete fixture (easy to introduce since nothing complains at authoring time) crashes the VoteTrack discipline board and any dashboard tile that calls `disciplineByParty`/`chamberSplit`, in a module whose entire purpose is to be dependable filler data.
- **Fix sketch**: Default missing entries to an all-zero `PartyVotes` (`rc.byParty[p.code] ?? { pro: 0, proti: 0, zdrzel: 0, omluven: 0 }`) before calling `partyDiscipline`, and/or add a dev-time assertion (in a test, not runtime) that every `RollCall.byParty` key set equals `PARTIES.map(p => p.code)`.

## 3. `partyDiscipline` treats "no data" (0 present voters) as "100% disciplined"
- **Lens**: Bug
- **Severity**: Medium
- **Category**: division-by-zero / vote-scoring edge case
- **File**: lib/civic/votes.ts:17-21
- **Scenario**: `partyDiscipline` computes `present = pv.pro + pv.proti + pv.zdrzel` and returns `1` when `present === 0` (e.g. a party with zero seats present — all members `omluven`, or a newly-added minor party that didn't vote at all in a given roll call). That `1.0` then feeds directly into `disciplineByParty`'s `avg` (averaged with real percentages) and into `perRc`, rendering as "100 %" next to parties that actually cast zero votes.
- **Root cause**: The function conflates two distinct conditions — "unanimous with the majority" and "no observations to compute discipline from" — under the same sentinel value, because `1` was chosen as a convenient default for `present === 0` rather than a real "n/a" signal.
- **Impact**: A fully-absent party is visually indistinguishable from a perfectly loyal one in the DisciplineBoard UI; since this is presented as fact-checking data about real MPs' behavior, showing "100% discipline" for a party that simply didn't show up is a misleading civic-transparency claim, not a harmless mock quirk.
- **Fix sketch**: Return `null` (and adjust `PartyDisciplineRow.avg`/`perRc` types to `number | null`) or a sentinel that the UI renders as "—"/"bez hlasů" rather than folding a fabricated 100% into the average.

## 4. `MP.score` is a hand-typed literal that must equal `composite(pillars)` with no runtime check
- **Lens**: Bug
- **Severity**: Medium
- **Category**: data-integrity / silent success-theater
- **File**: lib/civic/data.ts:60-129 (comment + `MPS` array), composite fn at :259-260
- **Scenario**: The comment above `MPS` explicitly warns: `score` musí odpovídat `composite(pillars)` … "rozjeté literály se na obrazovce ukážou jako dvě různá čísla" (drifted literals will show up on screen as two different numbers). Yet `score` is a plain hand-typed number field on every `MP` object, and `composite()` is never called to validate or derive it at load time — the guarantee is enforced by convention/comment only, presumably backed by a test elsewhere but not by the module itself.
- **Root cause**: The single source of truth (pillars) and its derived value (score) are stored redundantly instead of one being computed from the other, with the consistency invariant living only in a code comment.
- **Impact**: A future edit to any one pillar value (e.g. a data refresh bumping `attendance` from 94 to 90 for `novakova-p`) silently desyncs `score` from `pillars`; different parts of the UI that read `mp.score` directly vs. those that call `composite(mp.pillars)` will show two different numbers for the same MP, exactly as the comment predicts, with no error or warning at build or runtime.
- **Fix sketch**: Either drop the stored `score` field and compute it via `composite(pillars)` everywhere it's needed, or add a `console.assert`/dev-only invariant check at module load (`MPS.forEach(m => { if (composite(m.pillars) !== m.score) throw/warn })`) so drift is caught immediately instead of relying on a comment and out-of-band tests.

## 5. `CHAMBER_SUMMARY.median` uses hardcoded array indices that silently assume exactly 200 rows
- **Lens**: Bug
- **Severity**: Medium
- **Category**: latent-failure / silent-wrong-output
- **File**: lib/civic/leaderboard.ts:214-225
- **Scenario**: `CHAMBER_SUMMARY` computes `median = (sorted[99] + sorted[100]) / 2`, hardcoding the middle-pair indices for a 200-element array. `LEADERBOARD` is currently guaranteed to have exactly 200 rows (`for (let rank = 1; rank <= 200; rank++)`), but if that loop bound, the `PARTIES` seat total, or the anchor count ever changes (e.g. a future fixture update reduces the sample to reflect a real 199-seat chamber after a resignation), `sorted[99]`/`sorted[100]` remain in-bounds as long as the array has ≥101 elements, so no error is thrown — it just silently computes the wrong median for the new length.
- **Root cause**: The median formula duplicates the array-length assumption (`n=200`) as two magic numbers instead of deriving the midpoint from `scores.length` at computation time.
- **Impact**: Because this is a silent wrong-value bug (no exception, no NaN), it would not be caught by casual testing and would ship an incorrect "median composite" stat on the dashboard/landing page tiles that are explicitly documented as being "stitched by a test" to these numbers — the kind of drift the codebase's own comments (see finding #4) call out as a known risk class for this module.
- **Fix sketch**: Compute the median generically: `const mid = Math.floor(sorted.length / 2); const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;` — matches the pattern already used correctly in `getLeaderboardData.ts:289` for the real-data path, so the fallback path should reuse the same formula instead of a hardcoded pair.
