# Architect Coverage

Heatmap of themes and areas scanned, with last-scan date.

## Themes

### data-loading-boundary
- Last scanned: 2026-07-26
- Last scan: [[scans/2026-07-26-data-loading-boundary]]
- Findings (last scans): [8]
- Findings actioned: [7 of 8 — shipped: silent-degradation, props-union-narrowing,
  memoised-rejection, money-tie-mapper. In-progress (remainders deferred/blocked):
  server-only-boundary, loader-test-coverage, ingest-readiness. Untouched: 1
  (fallback-state-contract — blocked on concurrently-dirty client pages).]
- Yield density: 7/8 — unusually high; the theme was chosen well and most findings
  were small, mechanical, and independently shippable. A single blocked finding
  (the effort-l UX one) is the honest remainder.
- Notes: 4 angles (usage map, type/contract, failure modes, test coverage); smell 3–4/5.
  Repository layer clean (1/5); the seam above it is the drag. Re-scan after the
  backlog drains or when `/dashboard`+`/rozpocty` get wired.

## Areas
_No area-mode scans yet._
