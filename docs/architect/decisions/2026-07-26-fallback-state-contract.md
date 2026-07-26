---
date: 2026-07-26
slug: fallback-state-contract
status: proposed
type: weak-pattern
reach: "16 pages / 5 divergent null-handling idioms / 6 client components welded to mock imports"
risk: 3
effort: l
payoff: 5
related_scan: "[[Architect/scans/2026-07-26-data-loading-boundary]]"
---

# One fallback-state contract: labelled mock, honest empty, or DataUnavailable

## Context
Five coexisting idioms for `loader === null`: labelled mock banner (only
`LawWatchPage.tsx:219-221`), **unlabelled** mock (`FollowTheMoneyPage.tsx:64-88` renders a
fabricated "2,1 mld Kč" under a `SourceNote` citing the real contracts registry —
`messages/cs.json:109,674` — the brand rule inverted), honest empty state
(`CivicScorePage.tsx:79`), `DataUnavailable` with null-vs-404 disambiguation (only
`app/poslanec/[id]/page.tsx:39-46` and `app/zakony/[cislo]/page.tsx:32-37`), and silent
disappearance (`VoteTrackPage.tsx:98`). Worst case: `MpCaseFilePage.tsx:50-53` asserts
"graf nemá žádnou materializovanou vazbu" when the actual cause may be a DB failure — a
false factual claim on the app's highest-stakes surface. Separately, VoteTrack and
LawWatch drive their main UI from mock `ROLL_CALLS`/`LAW_CHANGES` even when real data
loaded — mock as content, not fallback.

## Decision
Codify a three-state contract: real data → render; store unavailable → `DataUnavailable`
(or a mock explicitly bannered as sample, LawWatch-style); entity absent → `notFound()`.
Every mock render carries the banner. Fix `MpCaseFilePage` and `/penize/[pspId]` to
disambiguate like `/poslanec/[id]`. Audit the 6 mock-welded client components.

## Rollout
1. Money: banner on all mock tiles/ledger/graph; fix the SourceNote citation on mock numbers.
2. `/penize/[pspId]`: null-vs-absent disambiguation via a second cheap query.
3. VoteTrack: label or remove the mock master UI when themeData is real.
4. Docs: add the contract to CLAUDE.md / DESIGN.md.

## Acceptance criteria
- No fabricated number renders citing a real registry without a sample-data banner.
- No page can claim "no ties exist" when the store was merely unavailable.
