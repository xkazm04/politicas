# Q-law-8 amends-regen — Opus audit (batch-004, read-only)

Auditor: Opus, maximum reasoning depth. Read-only; ran on a throwaway copy
(`.pglite-copy-law-audit`, deleted after). No payload file was edited.

**Verdict: CONDITIONAL PASS** — the edge set is complete, reproducible and unfabricated;
one concrete defect (a silently dropped live edge) must be resolved before the orchestrator
applies the topology change.

## What was verified (independently, not from the narrative)

| Check | Method | Result |
|---|---|---|
| Payload internal consistency | recomputed every `stats` field from `edges` + `perBillLog` | exact: 281 edges, 570 citations = 281 resolved + 289 unresolved, 188 distinct missing statutes, Σ`citingBillCount` = 289 |
| Completeness vs census | 53 census_full bills' `citationCount` vs `amended_laws_full`; proposal vs `amends-census.json` `realLaws` | 53/53 identical, 0 mismatches; all 53 census rows with `undercount > 0` are covered |
| Spot-checks (14 bills: 4, 7, 16, 24, 64, 65, 67, 77, 88, 90, 102, 111, 187, 207) | each edge ref ∈ proposal ∈ census realLaws | 14/14 clean |
| tisk 64 | 148 citations, 35 resolve to law nodes → 35 edges, 113 unresolved | correct (only 101 law nodes exist — 148 edges was never possible) |
| tisk 87 | census skip (no-pdf) → `no_data`, 0 citations, 0 live edges lost | honestly logged in `billsWithNoDataList` with `censusSkipped: true` |
| No fabrication (source) | re-derived the census extraction from the cached PDFs (`.data/law-collision-cache`) with an independent reimplementation for 15 bills | 15/15 byte-identical statute sets (tisk 64: 148 = 148, tisk 67: 42 = 42). Naive body-wide counting would have given 1398 citations for tisk 64 — the per-`Čl.` first-citation rule (P48) is doing real work |
| No fabrication (semantics) | for all 442 statute-contributions across the 53 census bills, checked the contributing `Čl.` block contains an amending verb (`se mění` / `zrušuje` / `zní:` / `vkládá` / `nahrazuje` / `doplňuje`) | 442/442 have amending evidence — 0 transitional/effectivity false positives |
| Missing-law-node census | tested all 188 against exact ref, `Sb.`-stripped normalization, node label, and node id patterns; brute-searched the whole 2989-node graph for 7 samples | 0 false positives — the 188 are genuinely absent (101 law nodes total; `ref` format is uniformly bare `N/RRRR`) |
| Churn re-ranking | recomputed before/after counts from live `kg_edge` and `payload.edges` | reproduced exactly (see below) |
| Collision candidate groups | recomputed laws with ≥2 amending bills | **29 → 75** confirmed; ≥3-bill statutes 10 → 42; bill-pairs sharing a statute 88 → 436 |
| Validator | ran `PGLITE_PATH=./.pglite-copy-law-audit npx tsx scripts/case-loops/law/validate-amends-regen.ts` | PASS — 281 edges, 0 errors, 0 warnings |

## Defect 1 (must fix before apply) — one live edge is silently dropped

The regen set is a **replacement**, and for census_full bills it uses `amended_laws_full`
*instead of* (not in union with) the recorded/title-derived list. In exactly one case that
loses a real edge:

- **tisk 88 (`bill:tisk:43198`) → `360/2025`** — currently a live `amends` edge. Its census
  `realLaws` = `["108/2006","110/2006","151/2025","152/2025"]` while `recordedLaws` =
  `["110/2006","151/2025","360/2025"]`; the body extraction did not find 360/2025, so the
  regenerated set has no edge for it.
- Consequence: **law node `360/2025` ends with ZERO `amends` edges** (regen touches 100 of
  101 law nodes; before: 101).
- Neither `batch-004-amends-regen.json` nor `-impact.md` reports this: the headline is
  "Δ+131", the true churn is **+132 added, −1 dropped**. That is a (small) silent truncation
  against the kernel guardrail.
- Fix: either apply the regen as a **union** with existing edges / `amended_laws`, or state
  the drop explicitly and justify it. Recommended: union — the drop is a body-parse miss,
  not evidence that the edge is wrong.

Related (same count-vs-set root cause, no edge impact): the proposal's `undercount` field is
a count difference, not a set difference, so tisk 88 shows `undercount: 1` while the set
change is +4/−1.

## Defect 2 (gap, benign here) — the `undercount > 0` trigger is count-based

Bills whose census `realLaws` differ from `recordedLaws` but have `undercount ≤ 0` never
enter the proposal, so their body-extracted citations are ignored in favour of the title
fallback. Three bills are affected — **tisk 219** (recorded `301/1992`, real `354/2019`),
**tisk 222** (recorded `134/2016`, real `9/2002`), **tisk 243** (recorded `223/2016`, real
`240/2000`). None of the missed statutes has a law node, so **zero edges are lost today**,
but the trigger should be set-difference-based next time. These three (plus tisks 36, 42,
107, 124, 153 with `undercount = -1`) are also a data-quality lead: title and body
extraction disagree *completely* about what the bill amends.

## Validator blind spot

`validate-amends-regen.ts` checks id-membership, duplicates and no-fabrication — all
forward-facing. It never compares the regen set against the **existing** `amends` edges, so
an edge deletion (Defect 1) passes silently. Add a "no live edge dropped without an explicit
allowlist" check before this becomes a topology-change habit.

## Blast radius — legitimate, not a bug

- 85 title_fallback bills: **0** topology change (their 115 edges are identical live and
  regenerated). The entire Δ lives in the 53 census bills, which go **35 → 166 edges**.
- That matches batch-003's measured undercount (government mean 4.80): 570 citations
  considered, 289 have no law node, 281 resolve. 166/53 ≈ 3.1 edges per census bill vs 0.66
  before.
- 29 → 75 collision candidate groups is the arithmetic consequence of the same change and
  reproduces exactly.

## Churn claim — holds

Recomputed from edges: after = 40/2009 **12**, 586/1992 **9**, 256/2004 **7**, then a
seven-way tie at 6 (117/1995, 134/2016, 187/2006, 2/1969, 243/2000, 427/2011, 89/2012) —
3 + 7 = exactly 10, so the top-10 cut is unambiguous (next group is 7 statutes at 5).
Before: 586/1992 7, 40/2009 6, then 427/2011 / 117/1995 / 256/2004 at 4 and exactly five at
3 — also an unambiguous cut. New entrants = **134/2016, 2/1969, 89/2012** (three, as
claimed); dropouts = 1/1993, 128/2000, 491/2001. The #1 flip (40/2009 over 586/1992) is real.
Caveat: rows 4–10 of the impact table imply an ordering inside a 7-way tie that does not
exist — render them as tied.

## Transparency note (not a defect)

The flagship case is only partly realized: tisk 64 contributes **35** edges from 148
citations (113 statutes have no law node). The aggregate is disclosed (289 unresolved) but
the per-bill figure is not; any narrative that pairs "tisk 64 = 148 vs 1" with the regen
should say 35 edges, not 148.

## Defect 1 fixed (follow-up, same batch)

`amends-regen.ts` now unions the census `amended_laws_full` list with the bill's live
title-derived `amended_laws` prop for the 53 census_full bills, instead of replacing one
with the other. Per-edge `source` tagging is preserved (`census_full` for refs found in the
body extraction, `title_fallback` for refs found only via the title-derived prop), so the
existing validator provenance check (no fabrication) still applies without modification.

Re-ran against a fresh copy (`.pglite-copy-law-fix`, deleted after):

- **tisk 88 (`bill:tisk:43198`) → `360/2025`** is now present in the regenerated edge set,
  tagged `source: "title_fallback"`. Law node `360/2025` no longer ends with zero edges.
- Confirmed by direct diff against `amended-laws-full-proposal.json`: across all 53
  census_full bills, tisk 88 is the **only** case where `recordedLaws` contains a ref absent
  from `amended_laws_full` — the union adds exactly **one** edge overall, no other bill is
  affected.
- Edge count: **281 → 282** (true churn now "+132 added, 0 dropped", not "+131" / "−1
  silent drop").
- Churn top-10 and collision-group counts (75 laws with ≥2 amending bills, 42 with ≥3, 436
  bill-pairs sharing a statute) are **unchanged** from the audit — 360/2025 has only 1
  amending bill after the fix, so it doesn't cross the ≥2 threshold into a new collision
  group.
- Validator (`validate-amends-regen.ts` run against `.pglite-copy-law-fix`): **PASS** — 282
  edges checked, 0 errors, 0 warnings.
- Defect 2 (the 3 undercount≤0 bills — tisk 219/222/243) is left as-is per the audit's own
  assessment (0 edge impact today) but is now explicitly logged in the payload under a new
  `caveats.defect2UndercountZeroOrNegative` field, rather than being an implicit gap.

Files touched: `scripts/case-loops/law/amends-regen.ts`,
`docs/data-analysis/case-law/payloads/batch-004-amends-regen.json`,
`docs/data-analysis/case-law/payloads/batch-004-amends-regen-impact.md` (regenerated, both
edge count and churn table already reflect the fix), this audit file (appended).
