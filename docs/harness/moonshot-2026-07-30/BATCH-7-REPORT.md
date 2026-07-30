# Batch 7 — Second Surfaces — Report (CAMPAIGN FINALE)

> 5/5 features shipped, 5 atomic commits. Gates: tsc 0 · lint 0 errors (30 doctrine warnings, unchanged since their introduction) · tests 1183 → **1299/1299** (113 files, clean run) · `next build` green.
> **CAMPAIGN COMPLETE: 35/35 accepted moonshots shipped across 7 batches.**

## Commits

| Item | Commit | Scope | New tests |
|---|---|---|---|
| 7C Newsroom Evidence Terminal | `e6e6afc` | features/labs/rentgen, app/rentgen | 17 |
| 7E Live-Graph Sentinel | `a11574e` | lib/testing/sentinel, scripts/sentinel, workflow proposal | 10 |
| 7D Forenzní režim | `14115f7` | features/shared/forensic, graf integration, globals layer | 65 |
| 7A Občanská schránka + nav | `9e42184` | features/shell, features/schranka, app/schranka | 34 |
| 7B Referendum o metodice | `52b83aa` | features/landing/referendum, app/referendum+embed, weights repo | 25 |

## What shipped

1. **Občanská schránka** — the shell is a personal civic inbox: localStorage follows with a route-derived "Sledovat" affordance, `/schranka` since-last-visit deltas (provenance-stamped, nothing stored server-side), sidebar news badge — **plus the nav reorganization**: a "Záznam" cluster (denik/dukazy/data/atlas/overeni/referendum), kraj/kompas/strety/predpis surfaced, mobile parity fixed, and a completeness test that scans the filesystem against an explicit unlisted-routes allowlist.
2. **Referendum o metodice** — landing presets + `/referendum` weight-setting (zero codec fork from Otevřený index, identity test-pinned), OG fingerprint share cards, script-free `/embed/zebricek` widget, and an anonymous k≥20 "jak váží Česko" median beside the published methodology.
3. **Newsroom Evidence Terminal** — `/rentgen` lives again over the real verified graph with a provenance tail-log; every element links to its citation surface; store-down renders a labeled "ilustrativní režim", never fake receipts.
4. **Forenzní režim** — `?rezim=forenzni` flips a WCAG-checked inverted-paper token layer and behaviorally transforms `/graf`: verified-only default with counted disclosure (requested trails never filtered), inline provenance, hover review-states. Permalinks stay mode-free for hash integrity.
5. **Live-Graph Sentinel** — `npm run sentinel`: 7 invariants against a safe copy of the real store. **Its first live run found real problems**: 179 orphan `about→theme` edges and one source stale at 7.4d vs a 1d cadence (5/7 invariants pass). `.github/workflows/sentinel.yml` added as a nightly proposal (no existing workflows touched).

## Campaign totals (batches 1–7)

- **35/35 moonshots shipped** in 35 feature commits + 7 docs commits + 2 fix-forwards, all on `vibeman/moonshot-exec-2026-07-30`.
- Tests **630 → 1299** (+669), tsc 0 throughout, lint 0 errors throughout (30 disclosed doctrine warnings = the planned inventory).
- ~16 new public routes; 2 extractable packages; 1 flywheel: tripwires → human review → strety/pakety → deník důkazů → change events → deník republiky → permalinks/exhibits/receipts → /overeni.

## Open follow-ups (for future sessions)

1. **Sentinel findings**: 179 orphan `about→theme` edges + pumper-psp-opendata staleness — real data-quality work.
2. Review throughput: 211 ties pending human verification (the deliberate bottleneck; tripwires now rank the queue).
3. Consolidations: ref-codec (×4 families), ClaimReview builders (2A/2E), /svedectvi → lib/claims registry.
4. Doctrine warning burn-down (30); statute-dossier vote links (cheaper bod_schuze path); MONITOR full 6,254-sweep offline job; sentinel workflow adoption decision.
