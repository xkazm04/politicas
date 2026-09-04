# G7 — the municipality as one graph subject; obec-keyed deník (wave 2)

Cards: deck #20 (municipality as a graph subject shared by /rozpocty, /volby,
/penize), #19 (obec-keyed deník). Registry: state-budget-analysis /
municipal-money-trail (clauses 1–4, "live state over frozen batch");
accountability-publishing-ethics / accountless-notification-privacy; laws
one-definition-one-import, missing-is-not-zero, every-cap-ships-its-population.

Builds on wave 1: G5's stamped writers. Uses the tender layer as it is.

## Ruling to record first

Node kind vs subtype: this wave uses a `municipality:<ico>` NODE KIND (append to
`KG_NODE_KINDS` in `lib/analysis/kg-verdict.ts`), id = canonical 8-digit IČO
(`companyId.ts`; `memory/ico-node-id-canonical-form.md`). Record the ruling and
its reason in `docs/data-analysis/graph-schema.md` before writing code.

## Goal of this wave's slice

1. `municipality` nodes for ALL obce from the existing packed registry
   (`features/volby` registry + `lib/analysis/public-body.ts` forms 801/811/804),
   props: name, kraj, population per period; yearly FINM/SIMU budget props for
   the 132 towns already harvested this wave (the full 6 254-obce budget ingest is
   carry-over — measured per `docs/data-analysis/budget-sources.md`). Writer
   `scripts/case-loops/tender/persist-municipalities.ts` (dry-run default,
   `persist-batch.ts` idiom, provenance stamped).
2. Edges: `party_to` municipality → contract from contract node `parties` /
   `publisher` (already in the graph, no network); `procures` stays as is;
   `founded`/`owns_stake` municipality → příspěvková organizace / city company
   from ARES VR for the tender authority set (`ownership-from-vr.ts` generalised;
   throttled; dry-run default). `nejasne` authorities resolve through the
   disclosed one-hop edge and stay SEPARATE from the town's own figure ("zřizuje /
   vlastní" — a link, never a summed number).
3. `/rozpocty`: `features/budget/getTownData.ts` server loader reads the
   municipality node (`kgNeighbours` for `party_to` + `procures`, then
   `readCompanySupplies`), `supplierTrail.ts` keeps its pure derivation but
   consumes graph rows and IMPORTS `moneyReachesCompany` (deleting its private
   two-party direction rule); `municipalSuppliers.generated.ts` and its generator
   are retired; the route gains the honest `DataUnavailable` path the record
   mandates. Peer groups (`peerGroups.ts`) widen only when the population is
   genuinely thin — recompute `MIN_PEERS` behaviour over the loaded population and
   print the sample per median (already the rule).
4. `/volby`: `tenderLayer.ts` arena correction reads the node; `/volby/obec/[ico]`
   and `/rozpocty/[ico]` link each other and cite one claim subject
   (`municipality:<ico>`); `MONEY_METRIC` gains `smlouvy-obce` (one `// [G7]`
   routing branch in `liveFigures.ts`; G8 reconciles).
5. Deník: a fifth layer — `tenderWin` (registry fact: "obec X uzavřela zakázku s
   firmou Y, rozhodnuto D", source = the tender node's own URL; entities `obec:<ičo>`
   + `firma:<ičo>`) and `authorityFinding` (derived figure: rule id + verbatim rule
   sentence from `/metodika#volby-<ref>`, dated `decidedOn`, no person name).
   `obec:` re-enters `deriveDenik` keys; `followCodec.entityHref` → `/volby/obec/<ičo>`;
   `FollowButton` on the obec page; a `/volby/feed.{xml,json}` family through the
   ONE codec (`feedCodecs.ts`) listed in `feedIndex.ts`; `limits.tendersUndated`
   counted and rendered. Memoised tender fold (cite its cost: 3,8 s cold /
   134–242 ms warm).
6. Symmetry test: every authority in the fold with a dated win can produce a row;
   findings render P1 "čistý radar" with the same weight as N1–N4.

Out of this wave: FINM bulk for all 6 254 obce; `founded` edges beyond the
authority set; `/volby/kraj` aggregation over municipality nodes. Carry-over.

## Owned paths

- `lib/analysis/kg-verdict.ts` (append kind + rels), `lib/kg/prop-registry.json`
  (`municipality` node block; `party_to`, `founded` edge blocks), `lib/analysis/public-body.ts`,
  `lib/analysis/companyId.ts` (read only).
- `scripts/case-loops/tender/**` (new persisters), `scripts/case-loops/money/ownership-from-vr.ts`
  (generalisation only).
- `features/budget/**`, `features/volby/**` (tenderLayer, obec page, kraj links,
  feed routes), `features/denik/**`, `features/schranka/{followCodec,kindVocabulary,…}.ts`
  (obec key + kinds), `features/data-releases/feedIndex.ts` (+ its test),
  `app/rozpocty/**`, `app/volby/**` (feed routes), `lib/analysis/volby/**`.
- `messages/{cs,en}.json`: `rozpocty.*`, `volby.*`, `denik.*`, `schranka.*`.
- Docs owed: `docs/routes/{rozpocty,volby,denik,schranka,data}.md`,
  `docs/data-analysis/graph-schema.md`, `docs/data-analysis/case-tender/STATE.md`
  (open item 1 status).

## Hot-file policy

- `kg-verdict.ts` arrays: append at the END; G9 appends `subsidy`/`donates_to` too
  — different literals, trivial merge.
- `prop-registry.json`: alphabetical inserts of NEW blocks only.
- `features/denik/deriveDenik.ts` `KIND_ORDER`: append your kinds after
  `organRole`; G16 (wave 4) appends after yours.
- `liveFigures.ts`: one `// [G7]` branch only.

## Honesty rules

- Clause 1 of municipal-money-trail: a body's money is never summed upward into
  the town's figure; the hop renders as a link with counts.
- Every cap ships its population (`DAYS_SHOWN`, `FEED_ENTRIES`, tender fold caps).
- `/rozpocty` becomes store-dependent: the fallback is `DataUnavailable`, never
  the retired batch.
- No person name in an authority finding.

## Build order

0 ruling → 1 nodes (dry-run) → 2 edges → 3 /rozpocty → 4 /volby links + claim →
5 deník layer + follow + feed → 6 symmetry test → docs.

## Report

README shape, plus: municipality nodes minted on the fixture, `nejasne` resolved
(0 → n of 1 575 expected on live; fixture numbers here), trail staleness rule
retired (yes/no), obec follows that deliver ≥1 row on the fixture, carry-over.
