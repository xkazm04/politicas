---
name: current-mandate-holder-signal
description: the only "currently sits" signal for PSP10 is membership on chamber organ 174 with to_at IS NULL (exactly 200 persons); mandate rows carry no dates
metadata:
  type: project
---

207 PSP10 `mandate` rows = 207 distinct persons for 200 seats, and
`mandate_from`/`mandate_to` are **null on all 1 332 PSP10 membership rows**, so
"who holds the seat today" cannot be read off mandates. The signal that works:
`membership.organ_psp_id = 174` (the PSP10 chamber organ) **with `to_at IS
NULL`** — 228 chamber rows, 221 open, exactly **200 persons** open, 7 closed-only
(the replaced MPs). Verified 2026-08-27 on the live store.

**Why:** any per-list or per-seat roll-up that sums over mandates double-counts
the 7 replaced seats; a per-person dedupe keeps all 207.

**How to apply:** `features/volby/volbyLoader.ts` `chamberForVolby()` is the
worked example (and discloses a fallback in provenance); reuse it rather than
re-deriving. Related: [[profile-route-takes-pspid]].
