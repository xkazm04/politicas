# G14 — statute version graph; whole-corpus collisions (wave 3)

Cards: deck #39 (e-Sbírka znění as nodes, real before/after on /zakony), #47
(statute collisions computed for the whole corpus, close-reads as the overlay).
Registry: legislative-change-tracking / amendment-instruction-grammar,
bill-fate-dating, statute-collision-clustering; civic-knowledge-graphs /
civic-entity-ontology; laws provenance-or-nothing, lead-not-finding,
every-cap-ships-its-population.

Builds on: G3 (`decides` edge, bill roll calls on the dossier), G5 (stamped
writers). You own `features/lawwatch/**` this wave except the NACE cell G9 added.

## Goal of this wave's slice

### A. Statute version graph (#39)

1. Amend `KG_NODE_KINDS`/`KG_EDGE_RELS` (append) with `law_version`, `has_version`,
   `enacted_as`; register props (`ucinnost_od`, `ucinnost_do`, `typ_zneni`,
   `fragment_count`, `eli`) in `prop-registry.json` + `graph-schema.md`;
   `CASE_OWNED_NODE_KINDS` in `kg-promote.ts` refuses the new kind by construction.
2. Promote `scripts/case-loops/law/esbirka-sparql-diff.ts` into
   `lib/ingest/sources/esbirka.ts` (adapter, IRI shape asserted on every fetch,
   cached under `.data/esbirka/fragments/`) and a pure `lib/analysis/law-diff.ts`
   (fragment-set diff `op: added|removed|changed`, verbatim before/after, tested
   on fixtures) — ONE definition, imported by the loader and the forensic gate.
3. Generalise `esbirka-versions.ts` from the 9-law `TARGETS` to every `law` node
   (293), streaming dataset 001 once; write `law_version` nodes + `has_version`
   edges through `apply-batch.ts` (dry-run default; the coordinator runs the live
   pass).
4. Link bills: for each bill with `fate_sb`, resolve the amending act's version
   and emit `enacted_as`; count and disclose bills whose fate is not yet in Sbírka.
5. `/zakony/predpis/[ref]`: dated version rail; `/zakony/[cislo]`: "co se v zákoně
   skutečně změnilo" block reading the cached diff via the loader pattern, a
   `SourceNote` per hunk citing both fragment IRIs; the missing side renders as
   `null`, never synthesized; run the whole-artifact digit-multiset invariant on
   every hunk (fragment HTML strip must not eat digits).
6. `law-verdict.ts` + `gate-verdicts.ts`: cited § fragments must exist in the
   version the verdict names (second closed set); re-run the stack over the stored
   verdicts on the fixture and report the count that would fail.

### B. Whole-corpus collisions (#47)

7. Register `amends.instructions` (`[{article, paragraph, verb: replace|insert|
   repeal|renumber, span}]`) + `instructions_provenance`; extend `amends-census.ts`
   to emit the grammar output per edge; validate on the 6 audit-confirmed false
   edges of batch 006 (must emit no instruction).
8. `features/lawwatch/deriveCollisions.ts` (pure): every same-(statute, §) pair
   with ≥2 pending instructions, N-way clusters, full population counted
   (`candidatePairs`, `clusters`, `closeRead`, `withheld`); omnibus partition and
   incidental-mention exclusion from `collision-check.ts`'s partitioner, moved into
   `lib/` and imported by the script.
9. `getCollisionData.ts` composes deterministic clusters + the close-read overlay
   (`classification` + Czech reasoning where it exists, `pending_review`, never
   the population); `/zakony/kolize` prints "close-read K of M candidate pairs";
   feeds gain the population line; the radar dates deterministic entries by pass
   and overlay entries by `generatedAt`.
10. Statute dossier: instruction trail per § from the edge props, replacing the
    disk-only `paragraphDiffs` read (`getLawData.ts:233`).

## Owned paths

- `lib/analysis/kg-verdict.ts` (append), `lib/kg/prop-registry.json` (blocks),
  `lib/analysis/{law-diff,law-verdict,amends-grammar}.ts` (+ tests), `lib/ingest/sources/esbirka.ts` (new).
- `scripts/case-loops/law/**` (`esbirka-versions.ts`, `amends-census.ts`,
  `collision-check.ts` importer, `gate-verdicts.ts`), `scripts/data-analysis/kg-promote.ts`
  (`CASE_OWNED_NODE_KINDS` only), `scripts/data-analysis/kg-legislation-ingest.ts`
  (only if `fate_sb` reading needs it).
- `features/lawwatch/**` (loaders, `deriveCollisions.ts` new, `StatuteDossierPage`,
  `BillDetail` block, `CollisionsPage`, `deriveRadar.ts`).
- `messages/{cs,en}.json`: `zakony.*`.
- Docs owed: `docs/routes/zakony.md`, `docs/data-analysis/{graph-schema,graph-log,frontier}.md`
  (Q-law-4), `docs/case-loops.md` (law loop section).

## Hot-file policy

- `kg-verdict.ts` arrays: append at the END.
- `features/lawwatch/components/BillDetail.tsx`: G3 added the roll-calls block in
  wave 1; add your block below it.

## Honesty rules

- A hunk exists only with two fragment IRIs; the missing side is `null`.
- The population (M) is deterministic and printed; the LLM output is an overlay.
- The grammar's known undercount on `ČÁST`-organised omnibus bills is printed as
  a stated undercount, never treated as closure.

## Build order

A1 → A2 → A3 → A4 → A5 → A6 → B7 → B8 → B9 → B10 → docs.

## Report

README shape, plus: `law_version` count on the fixture, `enacted_as` resolved vs
`fate_sb` split, verdicts failing the fragment set on the fixture, candidate pairs
M vs close-read K on the fixture, carry-over.
