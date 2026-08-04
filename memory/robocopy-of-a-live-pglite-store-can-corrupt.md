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

**How to apply:** after copying a store for a worktree, verify it opens before briefing
anyone (cheapest: `NODE_OPTIONS="--conditions=react-server" npx tsx` a one-line
`storeReady()` probe, or run any `da:*` metric script against it). If a builder reports
"store won't open", suspect the copy first; if a builder reports "not verified against real
data", run the smoke on the main store BEFORE calling the work shipped. Related:
[[isolated-dev-server-needs-a-worktree]], [[vitest-pglite-needs-tamed-workers]].
