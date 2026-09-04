# G19 — wave-1 carry-overs, one builder (wave 4)

Not a card: the items waves 1–3 reported as remaining that no later group owns.
Take them in this order; each is its own commit; stop at the first that grows
past its seam and report it.

1. **`/graf/p` then-side replay** (G1 → G4 file). `graphLoader.ts`: factor
   `buildTrails` / `buildPathAdjacency` / `getNodeDetail` into `(reads:
   KgAsOfReads) => …` builders; live callers pass the store, replay callers pass
   `store.asOf(issuedAt)`; replay results never memoised. `getPermalinkData`:
   when `issuedAt` is present and `fresh` is false, `then = resolveView(state,
   asOf(issuedAt))`; `view.diff` from G1's `diffViews()` stops being `null`;
   JSON-LD `hasPart` for the then-side with `validThrough`; OG "změněno od
   <date>". Bound the replay by `KG_READ_CAP` with the truncation warning.
2. **schránka read wiring** (G1): `getRecomputeFact.ts` reads
   `store.asOfNode(personId, beforeCurrentPass)` per followed MP → `priorScoreFromProps`,
   gated on `uniformPrior(...)`, passed as `recomputeDelta`'s 4th argument.
3. **`/denik` `recompute` rows** dated `superseded_at` (G1), same `KIND_ORDER`
   append rule (after G16's kinds).
4. **`/admin` decision buttons + server action** through `setReviewState` (G2),
   two-phase confirm, existing token gates; `tripwire` and `lead` subject kinds
   get a durable subject (`tripwireCandidateId`; lead file id) and a dismissal is
   invalidated when the candidate's evidence fingerprint changes (`loopState.ts`
   ack rule).
5. **Sentinel `graph-provenance-uniformity` refinement + `path-rule-ref`** (G4):
   mixed-within-rel is the alarm, mixed-across informational; the store's stamped
   rule vs `PATH_RULE_REF`.
6. **Step 7 of G3** — ONLY if a PSP10 floor-crosser now exists (probe first):
   `rebellion()`/`partyCohesion()`/`kg-compute` under the replay gate with the
   before/after table; otherwise record the probe and stop.

## Owned paths

`features/graph/{graphLoader,getPermalinkData,PermalinkPage,permalink}.ts(x)`,
`app/graf/p/**`, `features/schranka/getRecomputeFact.ts`, `features/denik/**`
(recompute kind only), `features/admin/**`, `lib/db/pglite/repositories/review.ts`
(tripwire/lead branches), `lib/testing/sentinel/**` (append), `lib/analysis/kg.ts`
+ `scripts/data-analysis/kg-compute.ts` (item 6 only), docs for each route touched.

## Report

README shape; per item shipped / partial / not started with the reason.
