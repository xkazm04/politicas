---
date: 2026-09-01
run_id: ex-9a41
area: budget-mirror (widened once into money-budget-routes)
files_sampled: 17
category_filter: any
total_items: 9
auto_accepted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
triaged: []
accepted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
declined: []
deferred: []
commits: [6164d03, cd85580, 5cd9612, e73c900, 29e04d6, 22f03d6, 2303040]
widened: true
registry: declared, unmapped (no registry-map pair for budget-mirror; resolved via the civic-intelligence index)
visual_verification: none — port 3000 belonged to another project; no politicas dev server was started
---

# budget-mirror sweep - 2026-09-01

First explorer run in this repo (vault bootstrapped at `docs/explorer/`). Every context
was unvisited; `budget-mirror` was chosen over the tiniest contexts (3–4 config files) as
a reader-facing, data-heavy area untouched by recent commits. Widened once into
`money-budget-routes` (the nine thin route files) after the area yielded seven items.

A tenth candidate — `sideCount` in `deriveMunicipalSupplierRows` double-counting a publisher
that also appears among parties — was killed at the premise gate: the ingest builds
`[rec.subjekt, ...rec.smluvniStrany]`, so the publisher is not in `parties`.

## Items

### [1] MP-tied counterparties vanish into the top-12 fold  ✅ accepted -> 2303040
**Category / Severity / Effort:** data / high / s
**Anchor:** `features/budget/MoneyTrailSection.tsx:107`
**Standard:** state-budget-analysis/municipal-money-trail (surfacing firm-to-politician ties next to a town's suppliers; a partial record is a partial record)
**Evidence:** `rowTies` was computed only for `topRows`. Measured against the store: Brno (44992785) has 17 counterparties, 13 tied, four tied ones at ranks 13–16 (RAILREKLAM, ČSOB Pojišťovna, Vzdělávací centrum pro veřejnou správu, Univerzita Palackého) folded into „a dalších 5 protistran" with no mention.
**Fix shape:** `liftTiedRows` (pure, tested) keeps the twelve largest AND every tied row in volume order; new fold copy `budget.restRowTiesLifted` (cs + en) states the lifted count and that no folded row has a tie; without the live layer nothing lifts and the old sentence stays. NOT visually verified.

### [2] Search ranking lost its population order in the tiebreak commit  ✅ accepted -> 22f03d6
**Category / Severity / Effort:** bug / medium / xs
**Anchor:** `features/budget/mirrorData.ts:214`
**Standard:** none
**Evidence:** 26d695a appended `ic` straight after the score; within a tier the order became IČO order — "pra" returned Pravonín (572) before Prachatice (11 119) while the doc comment and `TownPicker`'s header promised population order.
**Fix shape:** comparator states population desc, then `ic`; the test feeds the registry reversed.

### [3] Generator never passes its own read date as the year bound  ✅ accepted -> 29e04d6
**Category / Severity / Effort:** bug / medium / xs
**Anchor:** `features/budget/tools/generate-municipal-suppliers.ts:45`
**Standard:** state-budget-analysis/municipal-money-trail (time and defect discipline: dates after the day the register was read)
**Evidence:** `computedAt` was derived after the derive call and never passed as `retrievedOn`, so a regeneration would bound years by the checked-in batch's date.
**Fix shape:** the provenance read precedes the derive; `retrievedOn` travels with it.

### [4] Three places claim ~360 prerendered town pages; the build has 0  ✅ accepted -> cd85580
**Category / Severity / Effort:** quality / medium / xs
**Anchor:** `features/budget/municipalRoutes.ts:15` (+ `app/rozpocty/[ico]/page.tsx:17`, `docs/routes/rozpocty.md:7`)
**Standard:** none (memory: revalidate-is-inert-every-route-is-dynamic)
**Evidence:** `.next/prerender-manifest.json` (2026-08-27 build) lists 0 `/rozpocty` paths; the locale cookie renders every route dynamically.
**Fix shape:** comments and the route doc say what runs; `generateStaticParams` kept as the declared ceiling.

### [5] Ties fallback IČO not normalised before the join  ✅ accepted -> e73c900
**Category / Severity / Effort:** bug / low / xs
**Anchor:** `features/budget/getSupplierTies.ts:49`
**Standard:** state-budget-analysis/municipal-money-trail (clause 1 identifier hygiene: fixed width, leading zeros restored)
**Evidence:** `props.ico` was used verbatim; an unpadded value is a silent "no tie". 0 rows change today.
**Fix shape:** `normalizeIco` on the fallback.

### [6] Band labels declared twice, only one rendered, no parity  ✅ accepted -> 5cd9612
**Category / Severity / Effort:** quality / low / xs
**Anchor:** `features/budget/peerGroups.ts:17`
**Standard:** state-budget-analysis/peer-group-construction (law one-definition-one-import)
**Fix shape:** a parity test pins cs `band{i}` to `POPULATION_BANDS[i].label` and the catalog band count.

### [7] `PeerGroup.peers` doc says "sorted by debt"; it is registry order  ✅ accepted -> 5cd9612
**Category / Severity / Effort:** quality / low / xs
**Anchor:** `features/budget/peerGroups.ts:43`
**Standard:** none
**Fix shape:** comment corrected; a test asserts registry order.

### [8] Peer medians' year basis unpinned against the town's label  ✅ accepted -> 5cd9612
**Category / Severity / Effort:** dx / low / xs
**Anchor:** `features/budget/peerGroups.ts:110`
**Standard:** none
**Evidence:** `MetricDuo` labels both bars with the town's latest year; the medians are over the last snapshot year. Equal today (132/132 report 2025), guarded by nothing.
**Fix shape:** a test against the checked-in batch; a failure is named as a label defect. The structural alternative (medians at the town's year) is a judgement call left open.

### [9] `revalidate` comment credits a mechanism the app opts out of  ✅ accepted -> 6164d03
**Category / Severity / Effort:** quality / low / xs
**Anchor:** `app/penize/firma/[ico]/page.tsx:8`
**Standard:** none
**Fix shape:** the comment names the real mechanism (per-request `todayIso`) and keeps the constant as the declared ceiling.

## Not surfaced (measured, no defect today)
- `peerMedians.sampleSize` is the debt sample only; capex/saldo samples are identical today (0 diffs across 132 towns).
- `SUPPLIERS_PAID_CONTRACTS` is exported by the generated batch and unused — a harmless batch stat.

## Cross-references
- Adjacent areas not yet swept: money-cases-review, money-ledger-graph, kg-analysis (same group); everything else — first run.
- Related preferences: [[docs/explorer/preferences]]
