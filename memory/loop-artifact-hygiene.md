---
name: loop-artifact-hygiene
description: How the case loops keep their artifacts lean after the 2026-08-22 review — STATE.md is the resume point, db:backup keeps 2 checkpointed copies, probes go to archive/, raw data to data/raw/, and persist-batch gates jsonb keys.
metadata:
  type: project
---

Measured on 2026-08-22: **22 GB of `.pglite-backup-*`** (14 full copies, one per pass,
41 % un-checkpointed WAL each), a **100 MB raw harvest inside `docs/`**, a **1 146-line
ledger** read at every resume, **139 batch-suffixed scripts** of which ~75 were dead, and
**no schema at all for jsonb prop keys** (183 node + 73 edge keys, every batch inventing
more).

**Why it matters:** every write the loops make is a committed, replayable payload
(`persist-batch.ts --pass=<n>`), so a backup chain is redundant by construction —
"restore last good + replay one JSON" recovered a corrupted store the same day with zero
loss. Keeping 14 copies bought nothing; reading 80 KB of history to resume cost every
session; unregistered keys meant a writer typo was invisible until a surface rendered
nothing.

**How to apply:**
- Resume a case from `docs/data-analysis/case-<x>/STATE.md` (short, regenerated per
  batch; `openItems` mirrored from `ledger.json`). `ledger.md` is history. A batch is not
  done until STATE.md is updated.
- Back up with **`npm run db:backup [--label=passNN]`** — CHECKPOINT, copy, prune to 2.
  Never bare `cp -r` for a backup (copies for *analysis* still use
  `PGLITE_PATH=./.pglite-copy-<case>`).
- New scripts: durable tools at `scripts/case-loops/<case>/` top level (no batch suffix,
  listed in its `README.md`); one-shot probes are born in `archive/`.
- Raw source harvests → `data/raw/` (gitignored), not `docs/`.
- A payload key must be in `lib/kg/prop-registry.json` (+ a line in `graph-schema.md`)
  or `persist-batch.ts` refuses it; `npm run da:props-check` diffs the live store.
- Decided NOT to move `vote_ballot` out of the serving store: `/hlasovani`, `/poslanec`
  and the money collisions read it live.

Related: [[case-loop-scripts-must-exit]], [[live-store-can-be-restored-under-you]],
[[held-store-mimics-corruption]].
