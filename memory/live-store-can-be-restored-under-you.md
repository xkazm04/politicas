---
name: live-store-can-be-restored-under-you
description: A concurrent session can restore ./.pglite from a stale named backup, silently wiping later passes — probe pass provenance before writing, keep every write as a committed replayable payload, refresh the named backup after each persist.
metadata:
  type: project
---

At 2026-08-05 00:09 a concurrent session restored `./.pglite` from
`.pglite-backup-20260804-pass42` (most likely a wedged-store rescue — see
[[robocopy-of-a-live-pglite-store-can-corrupt]]), silently wiping law passes 43–47 (54 verdict
writes, 5 law nodes, 5 edges, a re-triage's underlying state). No error anywhere; the surfaces
kept rendering — just less.

**How it was caught:** the batch's manifestation probe (run the loaders, count what renders)
showed 59 forensic blocks → 27. Store timestamps + `forensic_provenance.pass` histograms dated
the snapshot precisely.

**Why recovery took minutes, not days:** every graph write in the loop exists as a committed,
gated payload (`kg-forensics --write --verdicts=<file> --pass=N`; the census-completion apply
script). Replaying passes 45→46→47 restored the exact end state — and the persist gate even
rejected one stale-text entry from an outdated combined payload until it was regenerated,
proving the gate holds on replays too.

**How to apply:**
1. At batch start (and before any live write), probe `forensic_provenance.pass` (or the
   relevant track's provenance) on the live store and compare with the ledger's expectation —
   a missing pass means someone restored a backup under you.
2. Never make a live write that is not reproducible from a committed payload + a gated script.
3. After each batch's persist, refresh a named backup (`.pglite-backup-<date>-pass<N>`) so the
   next rescue restores a CURRENT state instead of time-traveling.
4. A restore also resurrects pre-correction content (the old verdicts' unswept props returned
   and the render gate had to withhold them) — after any restore, diff the affected props
   against the latest sweep, don't assume corrections survived.
