# Tender batch 011 — the monthly increment becomes one command (that refuses to finish the job)

Case ④ needles · 2026-08-24 · no graph writes (steady-state tooling batch; the
next graph write is pass 74 when VZ-08-2026 lands).

## 1. What the server probe established

- **Month files are written once.** Last-Modified: VZ-06-2026 = Jul 1,
  VZ-07-2026 = Aug 2; local bytes identical to the server's. Files appear on
  the 1st–5th of the following month and never change after — updates to old
  procedures ride INSIDE newer month files (the snapshot re-publication b003
  dedupes). Corollary, verified by dry-run: VZ-12-2024 *alone* contains **zero
  wins** — its lots' winners arrived in later files. The chronological
  all-months replay is not a convenience; it is the only correct read.
- VZ-08-2026: 404 today (expected ~2026-09-01…05). The corpus is current.

## 2. `increment.ts` (npm run `da:tender-increment`)

Idempotent, safe any day: finds the newest local month, probes every month up
to the calendar month, streams new zips to disk (never through a V8 string),
runs the CPV filter, and prints the exact persist → reflag → recircle →
recompose chain with the full month list.

**What it refuses to do: persist or reflag by itself.** The flag and circle
persists sit behind the kernel's hand-read gate; a one-command chain that
auto-commits signals would delete the loop's strongest safety habit (three
flags rewritten and one statistic killed by hand-reads in ten batches). The
orchestrator ends where the reading begins.

## 3. The disk-vs-store drift guard

A downloaded month is not an ingested month. `persist-month.ts --commit` now
writes a machine-readable receipt (`persisted.json`: months, pass, lots,
edges, committedAt), and `increment.ts` compares disk against it — a month
sitting in `data/raw/isvz/` unpersisted prints **STORE IS BEHIND DISK**
instead of „current". Receipt backfilled with the pass-70 facts; written
automatically from the next commit on.

## 4. Windows teardown gotcha (fixed)

`fetch` keep-alive sockets + `process.exit()` trip a libuv assertion on
Windows (`!(handle->flags & UV_HANDLE_CLOSING)`, src\win\async.c). The
orchestrator lets the event loop drain and exits naturally; errors set
`process.exitCode` instead.

## 5. Next

When VZ-08-2026 appears: `npm run da:tender-increment` → hand-read → passes
74–76 per the printed chain. Until then the open items are the needle product
surface and campaign 2 (CPV 72).
