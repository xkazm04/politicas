# G4 — graph explorer: three-state gate, derivation stamp, neighbourhoods (wave 1)

Cards: deck #36 (rejected ≠ verified), #28 (path-rule ref + provenance aggregate),
#41 (the procurement layer reaches the canvas). Registry: civic-knowledge-graphs /
per-claim-provenance-stamping, evidence-path-finding, forensic-view-filtering;
claim-verification-and-provenance / gate-state-as-modifier, derivation-comparison.

## Goal of this wave's slice

### A. Three-state gate (#36) — first, it is the defect

1. `GraphEdge`/`PathEdge`/`PathHop`/`PathLedgerRow` gain `gate: GateStatus | null`
   (null = ungated deterministic relation, per `GATED_RELS` in
   `features/shared/provenance/receipt.ts` — IMPORT `gateFromEdge`, do not restate)
   and `provenance: {pass, method, ref} | null` (via `toProvenance`). `pending`
   becomes a derived accessor kept for the stage.
2. `buildAdjacency` excludes `rejected` hops from evidential traversal and returns
   `excludedRejected`; `FindPathsResult`/`PathQueryResult` ship it; the printed rule
   (`TrailFinder` ruleNote, `permalink.rule`) states "N zamítnutých vazeb se
   nepoužívá".
3. `forensicEdges`: three buckets (verified / pending hidden-and-counted /
   rejected hidden-and-counted); hover card rows gain a `rejected` column.
4. `GraphStage`: a third stroke for rejected inside a requested lens (curated
   trails are built from `linked` edges without filtering — a rejected hop in a
   trail must render, marked).
5. `permalink.ts` `edgeClaim`: `review_state` = the literal token, plus
   `provenance_ref`, `provenance_pass`, `claim_url` (`/zdroj/<edgeClaimRef>`);
   `permalinkCardModel.review` splits `pendingEdges` / `rejectedEdges`; OG prints
   both. This changes `content` for gated views → every issued `g.` ref reads as
   `moved` once; announce it as a derivation bump in `docs/routes/graf-permalink.md`
   (coordinate with G1, who is adding the `g2.` shape: add your fields, do not
   restructure the codec).
6. Fixtures: a `rejected` edge in `trailPath.test.ts` and `forensicView.test.ts`
   that fail today.

### B. Derivation stamp (#28)

7. `PATH_RULE_REF = "evidence-path/v1"` exported beside the constants in
   `trailPath.ts`, test-pinned to the constants (changing one without the other
   fails). `content` for `cesta` gains `{ruleRef, excludedRels, hubDegree, maxCost}`.
8. `lib/kg/graphProvenance.ts` (pure): `summarizeGraphProvenance(edges)` → per-rel
   `{state: uniform|mixed|absent, pass, ref, method, variants, coverage}`, reusing
   the shape of `features/civicscore/provenance.ts` (import nothing from features;
   mirror the shape). `buildIndex` computes it once; `GraphSeed`, `Trail`,
   `PathQueryResult` carry it; the `/graf` header prints the per-relation table
   with a `SourceNote`.

### C. Neighbourhoods (#41) — only after A and B are green

9. `getNeighbourhood(id, {rels, limit})` over `kgNeighbours` (ordered by
   `byListOrder`, cap + `shown/total` per rel — `every cap ships its population`),
   never memoised. `graphActions.neighbourhoodAction(id)`; `parseViewState` admits
   `okoli`; `resolveView` resolves it; `hashViewContent` over `{anchor, edges}`.
10. `VariantMapa`/`GraphStage`: an overlay positions layer; off-map path nodes get
    positions from their anchor's neighbourhood so a lens never lights a node it
    cannot place; `StageOverlays` prints "N kroků mimo mapu, dokresleno na
    vyžádání"; `NodeInspector.onExpand` wired.
11. `PermalinkPage` `OkoliExhibit` + OG "N z M vazeb"; `docs/routes/graf.md`.

Out of this wave: `/overeni` `grafVerdict` gate modifier (G1 owns `verdict.ts`
this wave — report the exact change you need), `/dashboard` state slice table,
sentinel `graph-provenance-uniformity` / `path-rule-ref` checks (report as
carry-over with the check shapes), cross-links from `/penize/firma`.

## Owned paths

- `features/graph/**` EXCEPT `permalink.ts`, `getPermalinkData.ts`,
  `PermalinkPage.tsx` where G1 works: in those three files you may ADD the fields
  and the `okoli` branch in clearly delimited blocks (`// [G4]`), touching no
  existing line of the `g.`/`g2.` codec. If a shared line is unavoidable, stop and
  report it.
- `lib/kg/graphProvenance.ts` (new) + test.
- `app/graf/**` search-param plumbing for `okoli`.
- `messages/{cs,en}.json`: `graf.*` keys.
- Docs owed: `docs/routes/graf.md`, `docs/routes/graf-permalink.md` (append a dated
  entry; G1 appends its own — both append, no rewrite).

## Hot-file policy

- `features/graph/graphLoader.ts` is yours entirely.
- Do not import from `features/shared/provenance/receipt.ts` anything but
  `gateFromEdge`, `toProvenance`, `GATED_RELS` — their signatures are stable; G1
  adds to that module, it does not change these.
- `lib/db` untouched; `kgNeighbours` is called as it exists.

## Honesty rules

- A refused claim is not a documented connection: rejected never ranks, never
  exports as verified.
- Hub fan-out: the overlay never grows past a printed node budget; the cap and its
  population ship on every response.
- Rounded SVG coordinates (hydration memo), tokens only, `SourceNote` on every
  figure.

## Build order

A1–A6 (commit per numbered step where sensible) → B7–B8 → C9–C11 → docs.

## Report

As the README, plus: fixture path through a rejected edge → "no documented
connection" (before: ranked as verified); JSON-LD `review_state` token
distribution on the fixtures; the exact `verdict.ts` diff G1 should apply; and the
per-rel provenance table from the test fixtures.
