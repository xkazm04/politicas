---
status: first-step-landed
landed_on: branch intake/tacs-1022-term-depth (local, not pushed; master carries the corrected comments and this plan)
registry_technique: civic-intelligence/parliamentary-data-modeling/term-and-chamber-scoping
size: ~5 files, ~60 lines, plus one contribution recompute and a prose re-scan
---

# Term-scoped membership reads stop one level below the chamber

## The defect

`listMemberships({ termCode })` (lib/db/pglite/repositories/graph.ts) puts a
membership in the term when its organ IS the chamber or has the chamber as its
direct parent. psp.cz hangs organs deeper than that: a podvýbor under its
výbor, an interparliamentary group under the MPU, a working group under a
committee. Those rows are in the store (the ingest upserts every zarazeni
row) and are invisible to every term-scoped read.

The gap was then read as a fact. Batch 006 measured "0 PSP10 memberships
reference any of the 430 Podvýbor organs" through this read, and three
comments (lib/analysis/contribution.ts, lib/analysis/committee-claims.ts,
scripts/case-loops/effort/extract-dossiers.ts) carried that zero as the
reason subcommittees are never counted. The committee-claims prose gate
excludes "podvýbor" on the same basis.

## Measured (public poslanci.zip, 2026-10-22)

Replay of the shipped predicate (arm A) against ancestry at any depth (arm B)
over the whole dump:

| term | A rows | B rows | only in B | persons | organs |
| --- | --- | --- | --- | --- | --- |
| PSP10 | 1,345 | 3,260 | 1,915 (781 podvýbor, 1,134 MPU groups) | 201 | 120 |
| PSP9 | 1,363 | 3,216 | 1,853 | 197 | 136 |
| PSP4-PSP8 | | | 1,140-1,961 each | | |
| PSP1-PSP3 | equal | equal | 0 | | |

- Floor: no row is in A and not in B for any term (onlyA = 0 everywhere). No
  PSP<n> abbreviation collides with another organ, so the scalar subquery in
  arm A never errored. The fix adds rows and never removes one.
- Score impact if committee_count is recomputed through arm B, under the
  current formula (Podvýbor is in COMMITTEE_ORGAN_TYPES, distinct bodies,
  saturation 3, weight 20): committee_count changes for 173 of 207 PSP10 MPs;
  the committee component moves for 51 MPs, +361.3 points in total. MPU groups
  are not committee types and move nothing.
- Fixture A/B (graph.test.ts, new last test): arm A 8/9, the new test fails
  without the podvýbor row; arm B 9/9. lib/db, lib/analysis, features/profile
  and features/volby suites 846/846 green under B.

## The decision this needs (owner)

The read fix is correct by itself: "restrict to one electoral term" should
mean the term's whole organ tree. What it changes downstream is a scoring
choice, so it is not shipped to master:

1. Do subcommittee seats count toward committee breadth? The formula already
   says yes (Podvýbor in COMMITTEE_ORGAN_TYPES). If yes, bump
   CONTRIBUTION_FORMULA_REF, recompute, and re-run the committee-claims scan
   with the "podvýbor" exclusion removed (prose that said "sedmi podvýborů"
   is then a claim about the prop). If no, remove Podvýbor from
   COMMITTEE_ORGAN_TYPES in the same change as the read fix, and the scores
   do not move.
2. The profile renders committee seats through isCommitteeSeat, so with the
   read fix and no formula change, profile pages list podvýbor seats that the
   stored score does not count. Decide 1 before merging the branch.

## Steps

1. Read fix + fixture test: done on branch intake/tacs-1022-term-depth.
2. Decision 1 above, in the same change as the merge.
3. Contribution recompute (scripts/data-analysis/kg-contribution-recompute.ts)
   against the store; expect the counts above within the dump-vs-store gap.
4. committee-claims scan and dossier extract re-run.
5. Remove the CORRECTION notes this plan added once 2-4 land.
