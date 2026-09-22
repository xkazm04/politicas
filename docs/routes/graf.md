# /graf — Graph playground

## Current contract

**Route** — `/graf`, the full knowledge graph on a full-viewport `<canvas>`. The
page opts out of the app shell (`isBareRoute`) to own the whole window width;
chrome floats over the stage and the breadcrumb links back. Round 4 is in
progress with two variants — **A · Mapa × Trasy** (the whole-graph landscape
with trails as LENSES) vs **C · Trasy** (the same four computed answers as
standalone ledger-column typesetting). Ohnisko was rejected in round 3.

**Reads** — `graphLoader.ts` is `server-only`, and `graphIndex()` memoizes
**success only** (`memoNonNull()`): a memoized `null` served an empty `/graf`
for the whole process lifetime, and an empty canvas reads as a REAL empty graph
on the surface whose subject is what the record contains. Every degradation path
calls `reportLoaderFailure()` — `features/graph/**` is no longer exempt from
`custom/no-silent-null-catch`, and there are no suppressions. A genuinely
missing node still leaves no trace, deliberately: filing a vanished node as an
outage is how people stop noticing outages.

**Citations** — `lib/kg/sourceLinks.ts` builds what the product prints as a
CITATION beside claims about named people and firms, and it becomes the
permalink card's `isBasedOn`. Three rules from its header: a `detail` tier means
the address IS the record, never a search over it; a stored canonical URL is
READ, never reconstructed (and refused unless it is an absolute http(s) URL);
and `registry` must NAME the host actually linked, because that field is typeset
literally. `citableId` never fabricates a public number — an internal node-id
suffix is not a tisk number.

**Text** — all of it goes through GraphStage's single label engine. Sizing
ground truth: `docs/data-analysis/graph-explorer-scale.md`.

**Recorded, not fixed** — `TERM_NUMBER = 10` is hardcoded into the tisk address
while bill nodes carry no term field, so after the next term's ingest those
citations resolve to a LIVE psp.cz page about a DIFFERENT bill (not a 404). The
fix is a `term` prop at ingest.

## Dated record

`/graf` — **Graph playground** (features/graph): the full knowledge graph on
a full-viewport `<canvas>`; the page opts out of the app shell
(`isBareRoute`) to own the whole window width — chrome floats over the
stage, breadcrumb links back. **Round 4 in progress — two variants:**
A · Mapa × Trasy (the whole-graph landscape with trails as LENSES: pick a
computed trail and the map dims to context, lights the trail's nodes/edges,
flies to its extent and shows amounts — `StageLens` + `fitBounds` in
GraphStage) vs C · Trasy (the same four computed answers as standalone
ledger-column typesetting). Ohnisko rejected in round 3. All text goes
through GraphStage's single label engine. Node click opens provenance and
registry deep-links from stable ids (`lib/kg/sourceLinks.ts`). Sizing
ground truth: `docs/data-analysis/graph-explorer-scale.md`.
**The citation points at itself, and an outage stops reading as an empty
graph (2026-08-13).** `sourceLinks.ts` builds what the product prints as a
CITATION beside claims about named people and firms — and it becomes the
permalink card's schema.org `isBasedOn`. Four defects fell, three of them the
`detail`/`search` merge the module's own header forbids. **Contract nodes
STORE their canonical registry URL** (`props.sourceUrl`, the dump's own
`<odkaz>`, written by `persist-contract-harvest.ts:145`) and the builder threw
it away, so ~153 k contracts cited a query about their SUPPLIER instead of
themselves; the address is now read from the stored field, never
reconstructed (`/smlouva/<n>` is `idVerze`, the node is keyed on `idSmlouvy`
— `memory/registr-smluv-token-free-access.md`), and a stored value that is
not an absolute http(s) URL is refused rather than rendered. ARES `?ico=` and
`or.justice.cz/rejstrik-$firma?ico=` are demoted from `detail` to `search`
(**the URLs are unchanged — with no network the honest fix is to correct the
CLAIM, not invent a path**), and a `hlidacstatu.cz` address stopped being
labelled „Registr smluv": new Rule 3 in the header says `registry` must name
the host actually linked, because that field is typeset literally.
`citableId` stopped fabricating public numbers — a bill with no `props.cislo`
printed `sn. tisk 43111`, the internal node-id suffix `app/zakony/[cislo]/
page.tsx:8-10` explicitly forbids, and an organ printed `psp id <n>`
indistinguishable from a person's. **A refuted premise died with them**: the
code comment AND `memory/kg-has-no-source-urls.md` both said ingest does not
carry the notice URL onto the node; it does, on **20/20** notice nodes as
`props.postingId`, so vývěsky now cite themselves. Recorded, not fixed:
`TERM_NUMBER = 10` is hardcoded into the tisk address while bill nodes carry
no term field, so after the next term's ingest those citations return a LIVE
psp.cz page about a DIFFERENT bill — not a 404; the fix is a `term` prop at
ingest.
Beside it, `graphLoader.ts` had **zero** `reportLoaderFailure` calls across
its degradation paths while `eslint.config.mjs` excluded `features/graph/**`
from `custom/no-silent-null-catch` — the rule written to catch exactly that —
„until the in-flight round-4 rework lands", which it never did. The ADR
counted four sites; there are **nine** (four early `return null` paths logged
nothing at all). Worse than the missing log line: `graphIndex()` did
`indexPromise ??= buildIndex()`, so a **null was memoised for the whole
process lifetime** — one unlucky boot served an empty `/graf` until restart,
and an empty canvas reads as a REAL empty graph, on the surface whose subject
is what the record contains. `memoNonNull()` memoises success only (the
`open()` / moneyLoader doctrine: neither an empty read nor a failure is
cached), the exclusion is deleted with no suppressions, and
`lib/testing/loaders.test.ts` — which PINNED the gap as the contract —
asserts the new one instead. **A genuinely missing node still leaves no
trace, deliberately**: filing a vanished node as an outage is how people stop
noticing outages. `import "server-only"` joined it in the same pass, retiring
the header's false „`server-only` v projektu není" (it is in `package.json`
and `features/admin/getTripwireData.ts` imports it) — the boundary now fails
at build time, not at runtime.


## 2026-08-22 · money batch 014 — the money trail was summing contracts the register gave to someone else

`getTrails`' „Peníze kolem poslanců" built `companyMoney` by adding up **every** `supplies`
weight, so a company that merely co-signed a multi-party contract carried its full value
into the trail — the same defect money batch 014 found in `/penize`, reached independently
here. In the test fixture it turned 8 900 000 CZK into 808 900 000.

The fix is the import, not a second rule: `moneyReachesCompany` from
`features/money/reachableMoney.ts` (a plain module, no server boundary crossed) now gates
the sum, so `/graf` and `/penize` cannot print two different numbers for one company.

Worth recording that batch 013 audited this exact function — for the *untied ownership
parent* leak — and correctly cleared it. Auditing a function for one leak says nothing
about another; what caught this one was an integration fixture carrying a deliberately
outsized co-signed contract, not a second reading of the file.


## 2026-08-24 · registry conformance wave 2 — the viewport stopped deleting the subject

Four fixes on the plátno, all from the same audit against `ai-registry`'s
`canvas-graph` subject, and three of them are the same shape of defect: the
surface whose subject IS the relationships was quietly refusing to draw them.

**Hrany se ořezávaly podle KONCŮ.** `GraphStage.tsx` skipped an edge when both
endpoints fell outside the view rectangle — the registry's named anti-pattern,
because that deletes exactly the long cross-graph links a reader zooms in to
follow. The correct test is segment-versus-rect; it can only ever draw MORE
edges, never fewer. Liang–Barsky lives in `features/graph/viewCull.ts` (pure
module, 13 fixture tests); restoring the endpoint semantics turns 4 of them red.

**Kolo myši neušlo stránce.** React attaches `wheel` to the app root as a
PASSIVE listener, so `preventDefault()` inside the synthetic `onWheel` was
inert and zoom co-fired with page scroll wherever an ancestor scrolls. Moved to
a native listener on the wrap with `{ passive: false }`.

**Převod svět↔obrazovka byl napsaný pětkrát** — `draw()`'s `screen()`,
`hitTest()`'s inverse, `zoomAt`, the fit math, and a fifth silent copy in the
edge-label midpoint. Self-consistent only because it was one file; the failure
mode is the first wrinkle landing in one of them. Extracted to
`features/graph/viewTransform.ts` (`toWorld`/`toScreen`/`clampK`/`zoomAtPoint`/
`centerOn`/`fitRect`), and every site now derives from it. One deliberate
behaviour change: `fitRect` clamps `k` through `clampK`, which the old
`fitView` did not — the clamp belongs in the authority.

**Orientované hrany dostaly hrot.** `src`/`dst` and `rel` were carried and
direction was conveyed only by hover highlighting. `features/graph/arrowhead.ts`
computes the triangle at the DESTINATION node's border from the already-central
`positions` + `radiusOf` (no second copy of node geometry), each bucket
accumulates into one `Path2D` and fills once — the batching doctrine in this
file's header is intact — and below `k = 0.55` arrowheads are not collected at
all, per the zoom-aware-detail rule.

The search palette's degree figure now carries a `citation-ok:` reason rather
than a lint warning: a node's degree describes the graph currently on screen,
not a claim a reader could go and check, and the provenance of the graph is on
the surface above it.

## 2026-09-04 — the three-state gate, the derivation stamp, and the layer that could not be drawn (G4, deck #36 + #28 + #41)

**A rejected tie is not a documented connection.** `kg_edge.props.review_state`
carries three values, `rejected` is terminal and the edge stays in the graph, and
`/graf` reduced all of it to `pending: boolean`. Consequences, all measured in the
code before the fix: `toEdge` mapped a human REFUSAL to `pending: false`;
`buildAdjacency` walked it as a full-strength documentary hop; the ranking's rule 2
("fewer pending wins") let a refused path OUTRANK a pending one, because "not
waiting" was being read as "verified"; `GraphStage` drew it solid — the stroke
reserved for proof; `forensicEdges` kept it inside the "verified only" landscape;
and `hoverCardModel` counted it in the `verified` column. `GraphEdge`, `PathEdge`,
`PathHop` and `PathLedgerRow` now carry `gate: GateStatus | null` and
`provenance: {pass, method, ref} | null`. `pending` survives as a DERIVED field for
the stage, documented as not meaning "verified" — `pendingFromGate` is its single
definition. `null` means the relation does not pass the gate at all (`GATED_RELS`):
"nothing to review" is neither approval nor a queue, and the surface says so.

**The one interpretation of `review_state` is imported, never restated.**
`features/graph/edgeGate.ts` (new, pure) wraps the receipt layer's `gateFromEdge`.
It is pure rather than living in `graphLoader.ts` because `scripts/sentinel/path-oracle.ts`
must read the gate with the SAME code as the loader, and the loader is `server-only`
— the oracle's paths have to be the reader's paths, or it certifies a graph nobody sees.

**`buildAdjacency` refuses to traverse a refused claim, and counts what it refused.**
`excludedRejected` rides on `Adjacency`, `FindPathsResult` and `PathQueryResult`, so
"we found no connection" and "the only connection runs through a claim a human
refused" stop being the same empty answer. Three strokes on the stage now: solid
(verified, or an ungated derivation), dashed (pending), dotted (refused). A refused
hop inside a REQUESTED lens still renders — a requested answer with omitted steps is
a lie — but it renders marked. The forensic strip counts hidden/kept refusals apart
from pending and does not offer to draw them back in: pending is a machine's
proposal, refused is a person's decision.

**The fingerprint grew an author.** `PATH_RULE_REF = "evidence-path/v1"` +
`pathRule()`, pinned against the constants by a test that fails if either moves
alone; `content` for `cesta` gained `{ruleRef, excludedRels, hubDegree, maxCost}`.
The announced cost is in `docs/routes/graf-permalink.md`: every path citation issued
before today reads as `moved` exactly once.

**The graph publishes its provenance as a population.** `lib/kg/graphProvenance.ts`
(pure) aggregates `kg_edge.provenance` per relation into
`{state, pass, ref, method, variants, coverage}`, mirroring the leaderboard's
aggregate shape without importing it (`lib/**` must not depend on `features/**`).
The two "mixed" are deliberately not one number: mixed ACROSS relations is the
ordinary state of a graph recomputed relation by relation, while mixed WITHIN one
relation is a half recompute and is reported separately as `mixedWithinRel`. A mixed
population publishes NO single pass, and an empty `{}` never counts as a stamp —
missing is not pass 0. `buildIndex` computes it on the full-edge scan it already ran,
so it costs no extra read; the header prints the table behind a disclosure with a
`SourceNote` citing `kg_edge.provenance`.

**The procurement layer reaches the canvas — and what still cannot be drawn is
counted.** 48 647 tenders and 12 467 procurement-only companies are in the search
index and in the path adjacency but deliberately not in `MapData`, so a computed
path could route through them: the ledger printed three hops, the stage drew one
(`if (!a || !b) continue`), and the difference was recorded nowhere. That was the
requested-answer rule honoured in the ledger and broken on the stage.
`getNeighbourhood(id, {rels, limit})` reads `kgNeighbours` — never at its default
limit of 500, which sits below the mean `supplies` fan-out and drops the cheapest
edges of the busiest entity — cuts deterministically with `byListOrder` rather than
the read's non-total `weight desc`, and returns `shown/total` per relation plus
`readTruncated`, because a result whose length equals its cap is indistinguishable
from a truncated one. Positions are a hash ring around the anchor, rounded to two
decimals (the hydration memo). `VariantMapa` merges the neighbourhood as an overlay
in the SAME world (no second geometry), auto-fetches the anchors a computed path
needs so a lens never lights a node it cannot place, wires `NodeInspector.onExpand`,
and prints "N kroků mimo mapu, dokresleno na vyžádání" plus its own overlay node
budget when either bites. `okoli` is the fourth citable view kind — an append-only
address promise — fingerprinted over `{anchor, edges}`, with the cap and its
population in the JSON-LD, on the page (`OkoliExhibit`) and on the OG card.
`/graf?okoli=<id>` is the entry point from another surface.

**Carry-over.** `/overeni`'s `grafVerdict` still returns a blanket `ungated` for the
`graf` family — `verdict.ts` belonged to another builder this wave; the exact
modifier is in the wave report. The sentinel checks `graph-provenance-uniformity`
(mixed across relations informational, mixed within one relation the alarm) and
`path-rule-ref` (the store's stamped rule vs the code's constant) are not built.
`/dashboard`'s state-graph slice does not print the variant table. `/penize/firma/[ico]`
and the tender surface do not yet link into `/graf?okoli=<id>`, and `caseFileLink`
is still unused by `features/graph`. The neighbourhood overlay is deliberately ONE
level deep: a neighbourhood anchored on another overlay node would depend on
arrival order and would turn the node budget into a suggestion.

**`lib/kg/sourceLinks.ts` — three pairs closed (2026-09-05, scan-sweep).** (1) The
node-kind enum existed three times — a hand-typed union here, `KG_NODE_KINDS` in
`lib/analysis/kg-verdict`, and a third hand-typed list in the test — and the test's
list lacked `tender`, so „every kind is handled" passed over 10 of 11 kinds. The type
is now re-exported from the one enum and the test derives from it (`594408f`).
(2) `citableId` has demanded a NUMERIC psp id since 2026-08-13; `sourceLinksFor`'s
person branch still took any id suffix, so `kg:person:novak-j` minted a psp.cz
detail address that points at nothing. Both branches now share `pspNumber`.
(3) Company links and „IČO …" citations took `props.ico` verbatim; ingest carries
unpadded IČO, so ARES/OR/Hlídač received „123" for „00000123" — the same class
`8db835f` fixed on /dukazy. `lib/kg` cannot import `features/money/companyId`, so the
padding lives here and `sourceLinks.test.ts` holds the two functions to one shape over
seven samples. Real `psp:person:<n>` ids and already-canonical IČO produce
byte-identical links; only the guessed and unpadded cases changed.

**The graph catalogs are derived from the KG enums, not hand-synced (2026-09-06,
scan-sweep, parity-auditor).** `graph.kinds` lacked `tender` and `graph.rels` lacked
the procurement layer (`procures`, `bids_on`, `wins`) and five later relations
(`concerns`, `rapporteur`, `spoke_on`, `proposes_amendment`, `decides`), while the
canvas, the search index and the neighbourhood already carried them — a company's
`okoli` printed `graph.rels.wins` and the legend `graph.kinds.tender`, next-intl's
missing-key string typeset as a label. The pure-module mirrors in `permalink.ts`
(`KIND_LABELS`, `REL_LABELS`) had the same holes. `catalogParity.test.ts` now derives
the required key set from `KG_NODE_KINDS` / `KG_EDGE_RELS` for both locales and both
mirrors; 1 kind + 8 relations were added (0 → 9 missing labels closed).

**`buildTrails` reads companies through `KG_READ_CAP` (2026-09-06, scan-sweep,
bounty-hunter).** The trail loader listed `company` nodes with a literal `10_000` —
the very ad-hoc limit `lib/db/readCap.ts` names as the class of bug it ends — while
the graph carries ~16k company nodes since Case ④. A company outside the first ten
thousand had no `companyMoney` entry, so `?? 0` made its contracts vanish from
„Peníze kolem poslanců" and „Výbory a peníze" without a trace. Five sibling loaders
already read companies with the cap; `loaderSource.test.ts` pins that no whole-relation
read in the graph loader carries a literal limit (1 → 0 literal-capped reads).

**The legend and the forensic inline label name the rejected stroke (2026-09-06,
scan-sweep, visual-craft).** The canvas has drawn three strokes since 2026-09-04
(`EDGE_DASH`: solid, dashed, dotted); the legend listed one, with a literal `4 4`
that matched neither pattern, and the forensic „relace · neověřeno" label read the
`pending` boolean, so a rejected step of a requested lens carried a plain label.
Both now read the gate; the legend's two dash patterns come from `EDGE_DASH` and
`graph.stage.rejected` is the third label (1 of 3 strokes named → 3 of 3).

**A null trails answer is an outage, not „no trails" (2026-09-06, scan-sweep,
state-coverage).** `trailsAction()` returns null when the store is down and the loader
has already left its trace; `VariantTrasy` typeset that null with `trasy.empty` („trasu
se nepodařilo spočítat z dostupných dat") — the empty-state sentence — and
`VariantMapa` collapsed it to `[]`, so the trail lens panel simply vanished. Both now
keep the null and print `graph.trasy.unavailable`; the honest-fallback rule
(`DataUnavailable`, never plausible emptiness) reaches the two variants (2 collapsed
states → 0).

**Every server-action call settles on rejection (2026-09-06, scan-sweep,
error-handler).** Eight `*Action()` call sites in the feature chained `.then` with no
rejection handler, so a failed action (network, server error) froze its state
machine: the map said „sestavuji mapu grafu…" forever, the inspector „načítám"
forever, the search „hledám…" forever, the cite button stayed disabled. Each call now
settles into the state the loader's own null would produce (outage typeset as
outage, request counters still honoured) and leaves a console trace;
`actionSettle.test.ts` pins one `.catch` per `.then` chain (8 unhandled → 0).

**DOM glyphs take their colour from the token class (2026-09-06, scan-sweep,
parity-auditor).** The legend painted kind glyphs with `fill-<token>` so the
forensic layer could remap them and said why („hex z KIND_STYLE by na tmě lhal");
the inspector, the search hits, the path-finder rows and the permalink page still
painted `fill={style.fill}`, the canvas hex, so in forensic mode one kind wore two
colours. All five DOM glyph sites now go through `KIND_FILL_CLASS[KIND_FILL_TOKEN]`;
the hex stays for `<canvas>` only (5 hex-painted DOM glyphs → 0).

**The forensic hover card sees the overlay (2026-09-06, scan-sweep, state-coverage).**
`hoverCardModel` looked the hovered node up in the map's node list and counted over
the map's edges, so a neighbourhood-overlay node — the layer the map deliberately
omits and the reader explicitly asked to draw — hovered to nothing, and an overlay
edge never counted. The card now reads `stageNodes` and the unfiltered map + overlay
edges (0 of N overlay nodes hoverable → N of N).

**One definition per shared shape (2026-09-06, scan-sweep, parity-auditor).**
`edgeKey` was defined byte-identically in `forensicView.ts` and `diffViews.ts`; the
eleven-field „hledání neproběhlo" `PathQueryResult` was spelled by hand in both
`graphLoader.getPathBetween` and `VariantMapa` — a twelfth field would have reached
one copy. `diffViews` now re-exports the canonical `edgeKey` and both the loader and
the variant build the unavailable result from `trailPath.unavailablePathResult()`
(2 + 2 definitions → 1 + 1; `oneDefinition.test.ts` pins both).
