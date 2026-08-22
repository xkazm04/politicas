---
name: robocopy-of-a-live-pglite-store-can-corrupt
description: A robocopy of .pglite taken while another process holds the store can produce a copy that aborts on open (RuntimeError Aborted()) — verify the copy opens before briefing a builder on it, and treat "my store won't open" as data, not code.
metadata:
  type: project
---

Round 5 (2026-08-04): a worktree's `.pglite` copy — robocopied from the main store while
concurrent sessions were live — failed every open with `RuntimeError: Aborted()` from the
PGlite WASM build. An existing repo script (`da:kg-metrics`) failed identically on that copy,
proving it was the data, not the new code. The main store and three other copies made the
same day were fine.

**Why:** the store is single-connection and actively written by concurrent sessions; a file
copy can catch a write mid-flight. A builder on a corrupt copy loses ALL live verification
for its whole session and can only reason from read shapes.

**Round-6 addendum (same day):** the deeper failure was found — the MAIN store itself can be
damaged by orphaned writers: 11 zombie `next start` servers from a dead builder session ran
for days out of deleted worktrees, and the store went from sentinel-green to
aborting-every-open within 30 minutes. Diagnosis order that worked: probe a COPY → probe the
BACKUP (opens = code is fine) → check postmaster.pid (PGlite writes a fake pid, useless) →
enumerate node processes by command line → kill only what you can attribute → if it still
aborts with zero holders, the store is damaged; restore from backup and REPLAY the
provenance-stamped writes (the recompute's replay gate makes this safe). Always `Stop-Process`
orphaned worktree servers BEFORE deleting worktrees.

**2026-08-22 addendum — the prediction held, and killing the holders does NOT heal it.**
Four orphaned `next start`/`next dev` servers from 2026-08-13 held the main store for
nine days; it aborted every open, from bare PGlite with no app code, on a COPY, and with
an 8 GB heap. Stopping the holders did not recover it — a damaged dir stays damaged, so
budget for the restore rather than hoping. Two things made the restore cheap and provable:
`docs/data-analysis/graph-log.md`'s last pass number matched the newest backup's name
(nothing to replay), and `review_audit`/`change_event` were both 0 rows (no human decision
and no non-derived write post-dated it). Verify the restore with `npm run sentinel`, not by
eye: 9/11 PASS with `freshness` violating is the expected shape for a corpus older than its
cadence. Orphans also block `npm ci` (EPERM on a held native `.node`), so a wedged
dependency install is a symptom of the same cause.

**How to apply:** after copying a store for a worktree, verify it opens before briefing
anyone (cheapest: `NODE_OPTIONS="--conditions=react-server" npx tsx` a one-line
`storeReady()` probe, or run any `da:*` metric script against it). If a builder reports
"store won't open", suspect the copy first; if a builder reports "not verified against real
data", run the smoke on the main store BEFORE calling the work shipped. Related:
[[isolated-dev-server-needs-a-worktree]], [[vitest-pglite-needs-tamed-workers]].
