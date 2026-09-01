---
date: 2026-09-01
run_id: ex-7c22
area: budget-mirror (second pass, --triage-all; two items in money-budget-routes + mp-rankings-routes)
files_sampled: 19 (17 carried from run ex-9a41 + SectionHeading + poslanec route)
category_filter: any
total_items: 7
auto_accepted: []           # --triage-all: nothing built unasked
triaged: [1, 2, 3, 4, 5, 6, 7]
accepted: [1, 2, 3, 4, 5, 6, 7]
declined: []
deferred: []
commits: [8cc95cf, a0a5dee, e4de8ac, 84ded7c, 2d11dae, 785faf0, 2b836c9]
widened: true
registry: declared, unmapped (civic-intelligence index: state-budget-analysis, public-money-attribution)
visual_verification: none — no politicas dev server; items 3, 5, 6 are the ones a browser would settle
---

# budget-mirror sweep 2 (--triage-all) - 2026-09-01

Same-day second pass after the user asked for every item to be triaged. Dedupe against
`2026-09-01-budget-mirror.md`; the seven items below are what that run measured but did
not surface, plus the two route-level findings. Two more candidates were measured and
dropped: duplicate MP keys in a tie list (0 across 135 ties) and a bar-ceiling drift
between §01 and §03 (identical today, and item 1 now keys both to the same index).

The user accepted all seven. One commit was refused once because another session had
pre-staged `lib/analysis/language-gate.{ts,test.ts}` into the shared index; the
stat-check caught it, `git restore --staged` released the two files, and the commit
went through with only its own three paths. Those foreign edits stay in the working
tree, untouched.

## Items

### [1] Peer medians sit on the batch's last year, the label prints the town's  ✅ accepted -> 785faf0
**Category / Severity / Effort:** data / medium / m
**Anchor:** `features/budget/peerGroups.ts:110`
**Standard:** state-budget-analysis/median-over-mean-for-peers
**Evidence:** `MetricDuo` prints the town's last reported year over both bars; `peerMedians` took `arr[arr.length-1]`. Equal only because 132/132 report 2025.
**Fix shape:** `peerMedians(..., atIndex)`; the page passes `SNAPSHOT_YEARS.indexOf(latest.year)` and the bar ceilings use the same index. No number moves today; contract tested synthetically, today-equal fact kept as an informative pin.

### [2] "N smluv" counts contract×counterparty pairs  ✅ accepted -> 2d11dae
**Category / Severity / Effort:** data / low / s
**Anchor:** `features/budget/supplierTrail.ts:432`
**Standard:** state-budget-analysis/municipal-money-trail (clause 4)
**Evidence:** Σ per-row counts 11 741 vs 11 582 municipal contracts (+1,4 %); the batch carries no contract ids.
**Fix shape:** card copy „smluvních vztahů (smlouva × protistrana)" in cs + en, pinned by `messages.test.ts`; field doc carries the measurement.

### [3] Switching town in-page leaves the tab title on the old town  ✅ accepted -> 2b836c9
**Category / Severity / Effort:** ui / low / m
**Anchor:** `features/budget/BudgetMirrorPage.tsx:149`
**Standard:** none
**Fix shape:** `select()` sets `document.title` from `meta.budgetIcoTitle`, the key `generateMetadata` uses. NOT verified in a browser.

### [4] Money routes accept `1e3`, `0x10`, ` 5` as an MP id  ✅ accepted -> e4de8ac
**Category / Severity / Effort:** bug / low / xs
**Anchor:** `app/penize/[pspId]/page.tsx:26` (+ paket, + `/poslanec/[id]`)
**Standard:** none
**Fix shape:** `/^\d+$/` on all three routes; every in-app link builds a plain integer, so no caller changes meaning.

### [5] §03 and §04 tables have no accessible name  ✅ accepted -> 84ded7c
**Category / Severity / Effort:** a11y / low / s
**Anchor:** `features/shared/components/SectionHeading.tsx:25`
**Standard:** none
**Fix shape:** optional `id` on the catalog primitive's h2 (38 call sites unchanged); `aria-labelledby` on both tables.

### [6] "…" while the graph link resolves, no `aria-busy`  ✅ accepted -> a0a5dee
**Category / Severity / Effort:** a11y / low / xs
**Anchor:** `features/budget/MoneyTrailSection.tsx:77`
**Standard:** none
**Fix shape:** label stays; `aria-busy` beside `disabled`.

### [7] `peerRule` prints the debt sample size for all three medians  ✅ accepted -> 8cc95cf
**Category / Severity / Effort:** dx / low / xs
**Anchor:** `features/budget/BudgetMirrorPage.tsx:326`
**Standard:** none
**Fix shape:** test on the real batch asserting capex/saldo sample sizes equal the debt sample (0 diffs today), naming the fix if it ever fails.

## Cross-references
- Previous run: [[docs/explorer/sweeps/2026-09-01-budget-mirror]]
- Adjacent areas not yet swept: money-cases-review, money-ledger-graph, kg-analysis.
