---
name: case-loop-scripts-must-exit
description: A tsx script that opens PGlite never exits on its own — it prints and hangs, orphans pile up holding the data dir, and the symptom mimics a product performance defect.
metadata:
  type: feedback
---

A `scripts/case-loops/**` script that calls `getStore()` / `loadMoneyLayer()` keeps the
Node event loop open after its work is done. It prints its answer and then **hangs
forever**. Every timed-out-and-killed run leaves an orphaned node process still holding
`./.pglite`, and they accumulate: money batch 014 stacked five of them over an hour, after
which each new read crawled.

**Why it matters more than the annoyance:** the symptom is indistinguishable from a slow
loader. I got as far as writing a steering item into the case ledger claiming
`getMoneyData()` could not complete in 600 s on the live store. It completes in seconds —
`loadMoneyLayer` (the whole 153 731-edge read and fold) is ~4 s. A ghost performance defect
in a ledger costs the next batch a day.

**How to apply:**
- End every store-opening case-loop script with `main().then(() => process.exit(0));`.
- NOT `main(); process.exit(0);` — that exits before the promise resolves, printing
  nothing and exiting 0, which looks like a script that ran and found nothing.
- Top-level `await main()` fails: tsx transforms these to CJS ("Top-level await is
  currently not supported with the cjs output format").
- When reads mysteriously slow down, check for orphans before blaming the loader:
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine
  -like '*case-loops*' }`, then `Stop-Process -Force`. A stale `.pglite/postmaster.pid`
  shows pid `-42` (PGlite's synthetic marker) and is rewritten at each open, so it is not
  by itself evidence of a live holder.

Related: [[held-store-mimics-corruption]], [[live-store-can-be-restored-under-you]].
