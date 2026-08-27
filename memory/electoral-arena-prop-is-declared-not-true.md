---
name: electoral-arena-prop-is-declared-not-true
description: company.electoral_arena (pass 74) is the RVZ self-declared category — 1 296 obce say "příspěvková organizace kraje"; join the registry before trusting it
metadata:
  type: project
---

`company.electoral_arena` on authority nodes (tender pass 74) maps RVZ's
`kategorie_zadavatele` verbatim, and the field is self-declared: measured
2026-08-27, **1 296 of the 6 254 registry obce declare „Příspěvková organizace
kraje"** (Havířov among them), 129 declare „Kraj", 70 „Česká republika";
Středočeský kraj declares itself `komunalni`, Jihočeský `statni`.

**Why:** the election mirror windows findings by the ballot's term and cites
the arena baseline — trusting the prop would run Havířov under the krajské
window and baseline. `features/volby/tenderLayer.ts` corrects: obec IČO (from
`features/budget/mirrorData.ts` registry) → `komunalni`, crosswalk kraj IČO
(`lib/analysis/volby/kraje.ts`) → `krajske`, else as declared; 1 518 moved,
`arenaDeclared` kept, count in provenance.

**How to apply:** any consumer of `electoral_arena` — the batch-012 census
table included — should say whether it is quoting the declared or the
registry-corrected arena; the komunální arena is 3 036 authorities / 21 091
lots corrected, not 1 521 / 7 506. See [[ico-node-id-canonical-form]].
