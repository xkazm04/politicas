# Explorer Coverage

Heatmap of areas explored. Used by Phase 2 to pick the staleest, highest-yield area.

## Areas

### budget-mirror

- Last visited: 2026-09-01 (two passes)
- Last run: [[docs/explorer/sweeps/2026-09-01-budget-mirror-2]] (previous: [[docs/explorer/sweeps/2026-09-01-budget-mirror]])
- Items surfaced (last 3 runs): [7, 9]
- Items accepted (last 3 runs): [7, 9]
- Yield density: 1.00 (run 1 all auto band; run 2 --triage-all, user accepted all seven)
- Notes: area is now swept twice in one day; the second pass ran low-severity. Next visit should wait for a new data batch or a UI change. Not visually verified in either pass — no politicas dev server.

### money-budget-routes

- Last visited: 2026-09-01 (as widening of budget-mirror, both passes)
- Last run: [[docs/explorer/sweeps/2026-09-01-budget-mirror-2]]
- Items surfaced (last 3 runs): [1, 2]
- Items accepted (last 3 runs): [1, 2]
- Yield density: 1.00
- Notes: routes are thin; findings were mechanism claims in comments and id parsing.

### mp-rankings-routes

- Last visited: 2026-09-01 (one file, `/poslanec/[id]`, touched by the id-parsing item of the budget-mirror pass)
- Last run: [[docs/explorer/sweeps/2026-09-01-budget-mirror-2]]
- Items surfaced (last 3 runs): [1]
- Items accepted (last 3 runs): [1]
- Yield density: 1.00
- Notes: not a real sweep of the context — only the route's id parsing was read.
