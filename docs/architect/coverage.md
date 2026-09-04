# Architect Coverage

Heatmap of themes and areas scanned, with last-scan date.

## Themes

### data-loading-boundary
- Last scanned: 2026-07-26
- Last scan: [[scans/2026-07-26-data-loading-boundary]]
- Findings (last scans): [8]
- Resume 2026-09-02: loader-test-coverage shipped ([[scans/2026-09-02-resume-loader-test-coverage]]) — the loader tests already
  existed (loaders.test.ts); the remainder was mappers parity/coercion, the getStore() lockstep test and one duplicate boot removed.
  Remaining in-progress: ingest-readiness; proposed: fallback-state-contract.
- Resume 2026-09-01: server-only-boundary shipped in full ([[scans/2026-09-01-resume-server-only-boundary]]) — the strong pattern
  "canonical loader shape" is now lint-codified. Remaining in-progress: loader-test-coverage, ingest-readiness; proposed: fallback-state-contract.
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
