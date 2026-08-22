# /penize — FollowTheMoney

## Current contract

**Routes** — `/penize` (tie ledger + money graph + stat tiles) ·
`/penize/[pspId]` (MP case file) · `/penize/[pspId]/paket` (hash-stamped
evidence packet) · `/penize/firma/[ico]` (company case file — money file when
the firm carries ties, registry file when it carries only ownership) ·
`/penize/strety` · `/penize/kauzy` · `/penize/kontrola` (review console —
`REVIEWER_TOKEN` + `REVIEWER_NAME`, `robots: noindex`, in `DISALLOWED_PATHS`).

**Reads** — `features/money/moneyLoader.ts` owns them all: `loadMoneyLayer()`
(ledger + console), `loadMpMoneySlice()`, `loadCompanyMoneySlice()` /
`readCompanySupplies()`. Everything is `react.cache()`d, capped at
`KG_READ_CAP`, memoized across requests on the imported `MONEY_MEMO_TTL_MS`
(never re-declared; neither an empty read nor a failure is memoized), and goes
through the indexed `kgNeighbours()` — **never a whole-relation scan**. Every
`kgNeighbours` result is re-sorted with `byListOrder` before it is read: the
weight ordering is not total and a CZK sum's float result depends on it.

**One definition, never forked** — if you need one of these, import it:

| Concern | Owner |
| --- | --- |
| Reachable money, attributability, per-tie/bucket reach | `reachableMoney.ts` (`reachableMoney` · `isAttributable` · `tieReach` · `bucketReachCzk`) |
| Tie class | `resolveTieClass()` in `reviewTypes.ts` — a stored `tie_class` wins; `classifyTie()` is the fallback for an edge carrying none, and is **never** called to decide what renders |
| Tie projection (ledger · case file · console) | `mapLinkedToTie()` |
| Gate phase sentence | `reviewSummary()` (also read by `/dashboard` and the spis) |
| Citable refs and figures | `moneyClaims.ts` over `edgeClaimRef()` — the repo's only ref builder |
| VAT base disclosure | `amountBasis.ts` + `components/BasisDisclosure.tsx` |
| IČO normalization | `canonicalIco()` (`companyId.ts`) — canonical 8-digit form **before** any lookup or link |
| Impossible dates | `lib/analysis/plausible-date.ts` |
| Keyboard graph traversal | `features/dashboard/graphTraversal.ts` (imported, not copied) |
| CZK formatting | `lib/format.ts` |

**Wire** — `publicWire.ts` applies `TIE_WIRE` between the loader and the client;
it classifies **every** `MoneyTie` field under
`satisfies Record<keyof MoneyTie, …>`, so a new field fails to compile until
someone classifies it. The console and the case files keep the FULL `MoneyTie`:
the person deciding a tie must never see less than the public does.

**Standing rules.** Steward money is the institution's and is never attributed
to a person. A company file is never ranked by money. Two-hop adjacency is
computed nowhere. A stored class is never rewritten by code — re-classifying is
a human decision at `/penize/kontrola`. A bad date loses its date, keeps its
row, and the count is disclosed; it is never repaired. An unreadable money layer
renders as unreadable, never as "no ties".

**Live state** — 211 `linked_to` ties, **all `pending_review`**, 0 rejected; the
rejected path is proven by test, not by data.

## Dated record

`/penize` — **FollowTheMoney** (features/money): the Rentgen money-graph's
production home, translated to Konstrukt — entity-trail graph (hover lights
edges), kniha vazeb grouped by MP with verified/pending-review states, and
the trail methodology (IČO join + human gate). Feeds pillar Integrita.
**Tie class has ONE resolver since 2026-07-29** — `resolveTieClass()` in
`features/money/reviewTypes.ts`. A class stored on the edge
(`kg_edge.props.tie_class`, 211/211 on the live graph) is what a reviewer or
an analysis batch recorded and it WINS; `classifyTie`'s substring guess is
only the fallback for an edge carrying none, and every surface says which of
the two it is rendering (`tieClassOriginInfo`). Five ties disagree and the
stored value is the investigated one — IČO 24227901 is the MP's own SVJ, and
the product used to caption it "vlastní nebo řídí soukromou firmu, která
dodává státu". Never call `classifyTie` to decide what renders.
**But „stored" never meant „a person decided it" (2026-08-13).** Every one of the
211 ties rendered „zapsal ji analytický průchod **nebo lidská kontrola**, není to
automatický odhad", and both halves were false for the whole live corpus. (1) The
human gate cannot write this field at all: `ReviewRepository.setTieReviewState` — the
ONLY write path of `/penize/kontrola` — builds `nextProps` from `review_state`,
`review_note`, `last_decision`, `last_reviewer`, `last_reviewed_at`; `tie_class` is
not among them and never was, so **no stored class can be a human decision**. (2) The
pass that wrote the overwhelming majority computed `tie_class` with the SAME
`classifyTie` the read path labels „odhad": batch-002 wrote **245** edges that way,
batch-006 two more, and only **15** (batch-001) came from genuine per-tie registry
research. So „zapsaná × odvozená" is largely two vintages of one guess — which is
exactly why **Vodovody a kanalizace Vsetín/Vyškov carry `manager`**: the writing
pass's marker table did not yet know `vodovody a kanalizace`, and `isAttributable`
(`tieClass !== "steward"`) therefore hangs two municipal water utilities' public
contract volume on named MPs. **No discriminator exists** — there is no
`tie_class_provenance` beside `tie_class`, and deriving class origin from
`corroboration_provenance`'s free text would be inventing a field the data lacks — so
the copy says which pass wrote a given class is NOT recorded, rather than guessing.
The heuristic now has ONE definition: `PUBLIC_MARKERS` / `OWNER_ROLES` /
`BOARD_MGMT_ROLES` / `classifyTie` are exported from `features/money/reviewTypes.ts`
and the three `scripts/case-loops/money/*` copies import them (`triage.ts` also
stopped copying `reviewTier`/`reviewRank`, whose comment said „MUST agree exactly"
with nothing enforcing it). Marker rulings recorded in code: **`krajsk` NOT added**
(`kraj` is its prefix, so it cannot change one answer — proven by test); **`z. u` /
`z. s` added** (a spelling gap in forms the list already carries). **No stored value
is rewritten** — re-classifying a tie is a human decision at `/penize/kontrola`.
`/penize/kontrola`'s own summary carried a hardcoded FOURTH copy of the retired
sentence and was the last place in the product still making the claim — worst there,
since the reviewer deciding the tie was told a human might already have classified it.
`review_tier`/`review_rank` are a different thing — a pass-24 CACHE of a pure
function, stale on 153/208 ranks after the batch-012 contract re-ingest — so
`resolveReviewOrder()` keeps a stored key only while it still matches the tie
and recomputes otherwise, reporting the count on the console rather than
mixing two vintages of one sort key in one queue.
**The console sees what the public sees, since 2026-08-04** — `ReviewTie` is now
`MoneyTie` plus the console's own fields (id/src/dst/pspId/mpName/club/period/links),
and `getVerificationData.ts` fills it through the SAME `mapLinkedToTie()` the ledger
and the case file use. It used to lift a narrower projection off the identical edge,
so the person DECIDING a tie saw strictly less evidence than a member of the public
reading `/penize/[pspId]`: no flags, no analyst note, no owner stake, no prior-term
note, no earlier decision. Measured on the live graph: **211/211 pending ties carry
`reviewer_note`**, 82 carry `flags`, 10 an `owner_stake_pct`, 1 a `prior_term`.
The console's staleness prompt keyed off `periodTo === null && !corroboration`, which
matches **0 of 211** ties (all 211 carry a corroboration verdict); it now fires on the
`stale-ongoing-in-graph` flag, which **42** ties carry. Machine tokens are never shown
raw to a reader on either surface: `features/money/tieFlags.ts` is the ONE dictionary
(22 tokens, Czech + English, pinned to the language gate by `tieFlags.test.ts`), and an
unmapped token renders VERBATIM and labelled as untranslated rather than hidden.
Analyst prose renders through `components/AnalystNote.tsx` on both surfaces — dated and
attributed from `corroboration_provenance`, linked to `corroboration_source`, and
stating that a pass wrote it and the tie still awaits the human gate. Reviewer prose is
NOT withheld by `lib/analysis/language-gate.ts`: measured, that stopword classifier
calls **14 of 211** genuinely Czech notes English (registry Czech is full of homographs
— "OR", "evidence", "ARES VR"), so the gate binds the copy WE write, not the evidence
we show. `/dukazy` still publishes no reviewer notes (`deriveFeed.ts`).
**A review decision is reversible, since 2026-08-04** — a gate a human cannot
correct is a one-way write. `getVerificationQueue()` now returns `decided` beside
`ties`: verified/rejected ties used to vanish from the product entirely (the queue
filters to `pending_review`). Each carries its DECISION HISTORY assembled by
`gateFromEdge()` — the provenance capsule's own assembler, reused, not forked — from
ONE grouped `listReviewAudit` read per page (0 rows on the live store today).
Reversal is `needs-more` on a decided tie: the tie returns to the queue and the
reversal APPENDS an audit row, so nothing is rewritten and `verifyAuditChain` still
passes across it (pinned in `review.test.ts`). It REQUIRES a reason —
`setTieReviewState` returns `"reversal requires a note"` and writes nothing at all
(no audit row, no edge update), because the chain is the only place the reason
survives (`props.review_note` is overwritten by the next decision). Re-affirming the
same state is not a reversal and is unaffected. **`REVIEWER_NAME` is now required
with `REVIEWER_TOKEN`**: the action used to stamp the literal string `"reviewer"`
when it was unset, so every operator entered the hash chain under one
indistinguishable identity; it now fails closed with a distinct `misconfigured`
result before any write, and the console renders a blocking banner instead of
silently omitting a sentence. `submitReviewDecision` also revalidates `/penize`,
`/penize/<pspId>` and `/penize/<pspId>/paket` — `packet.ts` compiles only
`reviewState === "verified"` ties, so a confirmation or reversal that stopped at
`/penize/kontrola` left the evidence packet asserting a stale set.
**Reads are indexed since 2026-07-29.** `loadMoneyLayer()` (ledger + console,
now the console's ONLY read — it no longer repeats the five scans) is
`react.cache()`-wrapped, uses `KG_READ_CAP` everywhere and no longer reads
`contract` NODES at all: of the 153 731 `supplies` edges the 33 628 without a
weight all point at a node with no `amount`, so the 152 788-row scan bought
nothing. `/penize/[pspId]` goes through `loadMpMoneySlice()` — `kgNeighbours`
for the MP's own `linked_to` edges, then per tied company for its `supplies`
with contract nodes attached — and must never scan a whole relation. Both
paths derive a contract's amount from `supplies.weight` ONLY, so the two
surfaces cannot report different money. Every `kgNeighbours` result is
re-sorted with `byListOrder` before it is read (`memory/kgneighbours-weight-
order-is-not-total.md`): the ordering is not total, and the CZK sum's
floating-point result depends on it.
**"Dosažitelné veřejné peníze" has ONE definition since 2026-07-29** —
`reachableMoney()` in `features/money/reachableMoney.ts`, used by the ledger,
the console and the case file alike. A COMPANY counts once (14 are tied to
more than one MP); the steward/attributable split is not a per-surface option
(steward money is ~91 % of the raw total and is the institution's, never the
MP's); a company whose ties disagree about the class counts as attributable if
any tie is owner-operator/manager (order-independent, unlike the rule it
replaced); a capped corpus yields a FLOOR rendered "nejméně". `MoneyStats`'s
`contractCzk*` / `contractCoverage` fields are named VIEWS onto it kept for
/dashboard — never recompute either anywhere.
**The ledger obeys that doctrine since 2026-08-04.** `reachableMoney.ts` now also
exports the two things every surface was re-deriving: `isAttributable(tieClass)`
(the class predicate, previously written out three times — here,
`features/dashboard/stateSlice.ts`, `features/denik/getDenikData.ts`) and
`tieReach(tie)` / `bucketReachCzk(bucket)` (ONE reach arithmetic: contracts +
subsidies, per company de-duplicated). Four surfaces had grown their own sum —
the ledger's „dosah" cell AND its sort comparator, `MoneyGraph`'s money node,
the case file's per-tie panel. **The featured „nejsilnější spis" is now selected
by ATTRIBUTABLE reach only** (`MoneyMp.attributableReachCzk`, ties broken by
pspId asc), and the caption prints the rule and the value it ranked on
(`money.real.graphSelection`). Measured on the live store: the lead is Petr
Hladík (6881) at **23,65 mld. Kč attributable** — but the picture beside his name
drew Dopravní podnik města Brna (90,0 mld.), SAKO Brno (25,9 mld.) and ARENA BRNO
(20,1 mld.) in the SIGNAL colour; his steward total is **139,1 mld. Kč**, ~5,9× his
attributable one. Steward money now renders in steel with `peníze instituce` on
the ledger row, the money node and the case file alike, and an MP whose whole file
is steward seats is never featured at all. `MoneyMp.totalContractCzk` /
`totalSubsidiesCzk` — the class-MIXING pair that used to BE the ranking key —
are deleted from the type. The owner-operator tile no longer cites bare ARES for
a partly-guessed count: it prints `ownerOperatorMpsStoredClass` beside it
(live: **18 of 18** rest on a recorded `tie_class`, 0 on `classifyTie`'s guess).
**Review truth propagates (2026-08-04).** Two sentences on /penize were LITERALS
asserting that every tie was still pending — the lede banner and the graph
footer badge. They were true only while the console could not write; since it
can (e8bf6c8), the first confirmation makes both false, on the page whose whole
promise is that a claim never outruns its data. `features/money/reviewSummary.ts`
is a pure four-state derivation (`all-pending` · `mixed` · `all-decided` ·
`empty`) over `verifiedTies` / `pendingTies` / **`rejectedTies`** (new — a
rejection is DECIDED, not pending) — counts that were already computed and
rendered nowhere. Both surfaces read the same object, and the banner cites it.
Its population is deliberately NOT `totalTies` (every edge read, including ones
dropped for an unresolved endpoint). One test per state. Also: a review decision
now revalidates **`/dukazy`**, the public bulletin of gate decisions, which reads
the very `review_audit` table the action appends to; the „nejméně" floor prefix
finally renders the explainer that says WHY (`reachableSubCapped`, dead in both
catalogs until now — live `isFloor` is currently **false**, the corpus is not
capped); the mock graph footer no longer certifies its own invented edges
(„● všechny hrany datované + doložené", in the CONFIRMED colour); and the copy
says **10. období**, the term `moneyLoader`'s `TERM = "PSP10"` actually reads.
`features/money/messages.test.ts` pins all of it (cs/en key parity, ICU parity,
no `9. období`, a sentence per phase). **`app/robots.ts` now exists** — the repo
had none, so `/penize/kontrola` (the internal review queue, PUBLICLY LINKED from
the /penize header, showing analyst prose about named people) was crawlable; it,
`/rentgen` and `/admin` are disallowed, everything else allowed. The console page
also declares `robots: { index: false }`. Neither is access control — that is
still `REVIEWER_TOKEN`.
**Every tie is citable (2026-08-04).** `features/money/**` contained ZERO
claim-ref calls, so /penize published 211 money claims about named people and
not one had a permanent address — /overeni, the citation verifier, had nothing
on this surface to verify. `MoneyTie.receiptRef` is now minted ONCE in
`mapLinkedToTie()` with the shared `edgeClaimRef()` from the edge's OWN
endpoints (never a reconstructed `psp:person:<pspId>` string, which would look
right and resolve to `gone`), and both the ledger row and the case-file tie
section link `/zdroj/<ref>` through `claimRefPath()`. There is exactly ONE ref
builder in the repo and no surface forks it. A receipt cites a CLAIM, not a
verdict, so the link states the gate state beside it. Verified against the live
store: 5/5 sampled refs resolve `ok` with `gate=pending_review`, e.g.
`psp:person:6881 --linked_to--> company:ico:46347534`; the fixture suite now
pins decode + resolution + gate agreement for every tie. One-hop links added:
/penize → `/penize/strety` + `/dukazy`, the case file → `/dukazy` (its `/paket`
link was already there).
**The NUMBER is citable too (2026-08-04).** A tie had a permanent address since
the receipt work; the amount beside it had none — so a journalist could cite „the
tie exists" and not „firma X dostala 23,7 mld. Kč", which is what actually gets
quoted. The ledger's „dosah" cell, the case file's two split tiles and the company
file's headline now render through `CitableNumber` with a `data-claim-*` payload
minted in ONE place, `features/money/moneyClaims.ts` (pure — the surface that
ISSUES a figure and the gate that RE-DERIVES it must compose the identical ref).
The ref grammar is not new: `claim:<dataset>:<metric>:<subject>` where the subject
is the entity's own address — a tie's `receiptRef` (`h.<src>.<rel>.<dst>`, decoded
by `decodeClaimRef`) or a node id (`psp:person:6881` / `company:ico:46347534`,
decoded by `pspIdFromEntityId` / `icoFromEntityId`, which moved into
`caseFileLink.ts` so ONE module owns what our ids look like). Four metrics:
`dosah-vazby` · `smlouvy-firem-poslance` · `smlouvy-instituci-poslance` ·
`dosah-firmy` — the two sides of the attribution split are DIFFERENT metrics
because they are different statements. Values come from `tieReach` /
`bucketReachCzk` and nowhere else; the claim's gate state is the tie's own
(`rejected` joined `ClaimReviewStatus` — a rejected tie stays in the graph and a
figure resting on one may not read as merely unchecked), and an AGGREGATE is
`verified` only when every tie under it is. `compactCzk` moved to `lib/format.ts`
as the `czkCompact` citable kind (re-exported under its old name). **`TIE_WIRE` is
unchanged and that is the finding**: every input the claim needs was already
`public`, so /penize ships **zero new wire bytes** — measured 107 724 B raw /
17 312 B gzipped, byte-identical to before. The cost is HTML: **+11 914 B raw /
+941 B gzipped** for the 25 rows one ledger page draws.
**The company is addressable (2026-08-04) — `/penize/firma/[ico]`.** A company
is the graph's JUNCTION node (contract ⋈ subsidy ⋈ donation ⋈ MPs) with a stable
id, and **14 of them are tied to more than one MP** — a fact the ledger's
one-row-per-TIE shape and /penize/[pspId]'s one-MP shape could both compute and
neither could publish. `getCompanyDetail.ts` + `loadCompanyMoneySlice()` read it
through TWO indexed `kgNeighbours` calls (`kg_edge_dst_idx` for the inbound
`linked_to`, then the company's `supplies`), never a relation scan; the per-company
supplies read is now ONE function (`readCompanySupplies`) shared with
`loadMpMoneySlice`, so the two case files cannot report different money for the
same firm. The `[ico]` segment is normalized to the canonical 8-digit form BEFORE
lookup (`features/money/companyId.ts`, pure + tested) — `/penize/firma/2867681`
resolves `company:ico:02867681`, the exact node that unpadded ids once duplicated
(memory/ico-node-id-canonical-form.md). Ties are `MoneyTie` + who the MP is
(`CompanyTie`), filled by the SAME `mapLinkedToTie`, ordered by `reviewRank` —
**never by money: this page is not a ranking and no index page sits above it.**
The steward/attributable verdict comes from `reachableMoney`/`isAttributable`, an
impossible `signedOn` loses its date and is disclosed (rows kept, never repaired),
and every undecided tie says `čeká na kontrolu`. Live renders: Plzeňské městské
dopravní podniky (3 MPs, steward, 13,41 mld. Kč, 1 296 contracts), AGROFERT
(2 MPs — Babiš `manager`, Faltýnek `steward` — attributable 8,71 mil. Kč).
Ledger company cells and case-file tie headings link into it.
**The public wire carries what renders (2026-08-04).** `getMoneyData()` handed the
ledger 211 ties × **38 fields**; `TiesLedger` renders **15**. The other 23 crossed
the network every request — analyst prose (`reviewerNote`, 211/211), the
corroboration capsule + its source URL, the review trail, the signal/tier internals.
`features/money/publicWire.ts` is the projection, applied in `app/penize/page.tsx`
BETWEEN the loader and the client: `TIE_WIRE` classifies every `MoneyTie` field
`public`/`internal` under `satisfies Record<keyof MoneyTie, …>`, so a field added to
`MoneyTie` **fails to compile until someone classifies it**, and `PublicMoneyTie` is
`Pick`ed from that table (a missing `public` field is a type error; the colocated
test holds `toPublicTie` to `PUBLIC_TIE_KEYS`). There is **no second mapper** — the
case file and the console keep the FULL `MoneyTie`, because the person deciding a
tie must never see less than the public does. `mpsWithoutTies` ships the 36 chips
that render plus the TRUE count (144), not 144 stubs. Measured on the live store:
**/penize props 337 330 → 107 724 B raw (−68 %), 40 815 → 17 312 B gzipped (−58 %)**,
with `stats` and `graph` byte-identical.
**The supplies fold is memoized across requests.** `listKgEdges({rel:"supplies"})`
is ~153 731 rows folded into a ~196-entry per-company aggregate that changes only on
`da:kg-compute`, and `react.cache()` is scoped to ONE request — so every /penize and
/penize/kontrola request re-read the whole relation. It now expires on the SAME bound
/dashboard declares (`MONEY_MEMO_TTL_MS`, imported, never re-declared: two memos over
one graph layer on two clocks is how two surfaces print two vintages of one number),
and neither an empty read nor a failure is memoized. Measured: **`getMoneyData()`
cold 5 965 ms → warm 206 / 240 ms** (it was 5 572 ms warm before). The page PRINTS
the bound (`money.real.freshness`), because memoization — not `revalidate` — is what
actually bounds staleness here.
**The mock is code-split.** `lib/civic/data.ts` was imported at module scope by
`FollowTheMoneyPage`, `TiesLedger` and `MoneyGraph` for the fallback alone.
`MockLedger` / `MockMoneyGraph` / `MockStatTiles` are now their own modules loaded via
`next/dynamic` (no `ssr:false` — the fallback still server-renders), and the real and
sample tiles share ONE `components/StatTiles.tsx` rather than two copies of the grid.
The /penize page chunk drops **40 336 → 38 367 B** and the three mock chunks
(1 224 + 3 794 + 3 415 B) leave the parse path. **Honest limit: the shared
`lib/civic/data` chunk (15 269 B) stays eager anyway** — `features/shell/
sidebarParts.tsx` imports `MODULES` on every route, so no /penize change can evict
it. Fallback verified against the production build with `PGLITE_PATH` pointed at a
nonexistent dir: /penize renders the labelled mock, `/penize/firma/<ico>` renders its
honest empty state at HTTP 200, `/penize/firma/abc` 404s.
**Střety stop reading 410 000 rows to print zeros (2026-08-11).** The join
gate (`tieEntersJoin`, imported — never a second copy) is computed BEFORE the
ledger read: with all 211 ties `pending_review` it is empty by construction,
so the vote+legislative layers are not read at all and their coverage is
`null`, never 0 — „nečteno" is a different claim than a zero, and the page has
three sentences for three zeros (gate shut · schuze.zip missing · a real
empty result). The non-empty path rides votetrack's `readLedger()` (floors
included); the whole derivation memoizes on `MONEY_MEMO_TTL_MS` (null never
memoized; an EMPTY candidates result IS — it derives from real reads, stated
in the module header as a deliberate difference from ledgerMemo/chamberMemo).
Measured: cold 15 800 → 3 761 ms, repeat 10 409 → 0 ms. Candidate rows carry
`/zdroj/<ref>` (tieRef grew `rel` so `edgeClaimRef` composes the ONE grammar)
+ `/penize/firma/<ičo>`; route declares `revalidate = 86_400`.
**The kauza can be read and cited (2026-08-11).** /penize/kauzy renders its
hardest evidence for the first time: `registryFindings` as the labelled
key/value pairs its own doc comment always promised, `proposedAnnotation` as
labelled fields (never `JSON.stringify` at a reader, depth-capped and
disclosed past the cap). Machine enums go through
`features/money/dossierVocabulary.ts` (the tieFlags contract: closed cs/en
vocabulary, unmapped renders VERBATIM + labelled); the English analyst prose
is DATA — disclosed as verbatim working material, never rewritten — and the
dossier's gate state renders through the shared `gateVocabulary`
(`LEAD_DOSSIER_GATE_TOKEN` is the one place „a hand lead never auto-verifies"
is a token). Each kauza anchors `#kauza-<leadId>` + `CopyLinkButton`, the
company links its case file via `canonicalIco` (also fixed in
`getLeadPacketTargets` — a 7-digit dossier IČO was a SILENT false negative),
and the /penize teaser derives its dossier count from the discovered list
(was a bilingual „Dva ručně dořešené spisy" literal). Payload read memoized
on `MONEY_MEMO_TTL_MS` (18 files / 490 471 B parsed per request before);
`isDossier` tightened 5 → 13 checks and finally tested. Found in the corpus:
`mediaContext` has TWO live shapes (objects and bare strings) — the bare-
string kauza rendered four empty rows with hrefless anchors; both branches
render now.
**Console + case-file honesty set (2026-08-11).** The review console — the
most leveraged user in the product, 211 pending decisions gating strety,
packets and /dukazy — finally links the fabric it decides on: each card
carries `/penize/<pspId>`, `/penize/firma/<ičo>` and `/zdroj/<receiptRef>`,
the header links /penize + /dukazy. The dead staleness prompt (0/211 by its
own comment) is deleted; the note field states BOTH real rules (needs-more
without a note no-ops; reversal requires one); `nearThreshold` renders (94 of
211 — a pattern, the copy says, not a finding). And `contractCoverage`'s cap
heuristic is CORPUS-ONLY now: a per-MP slice passes `readScope` derived from
its own read (`readCompanySupplies` reports truncation by the
`warnIfTruncated` shape), so a complete slice makes NO floor claim and a
truncated one is a floor with `perCompanyCap: null` and its own sentence —
three small firms `[3,3,3]` used to fabricate „nejméně" plus a cap that does
not exist (Decroix sits at `[3,3,0]` today). Corpus path byte-identical,
verified to the cent on Hladík and Babiš.
**The company file shows its corporate surroundings (2026-08-12).** The
graph has carried a dated ownership layer since pass 28 — 33 `owns_stake`
edges + 19 parent nodes (Město Plzeň, HLAVNÍ MĚSTO PRAHA, Ministerstvo
financí, the AGROFERT ancestors), every stake a dated sole-shareholder
registration from dataor.justice.cz — and NO surface rendered it.
`features/money/ownership.ts` (pure + tested) holds six rules: ONE hop,
both directions (chain-walking is exposure inference and is computed
nowhere — the `genuinelyNew: 0` doctrine); a CLOSED period reads as
history, never current ownership; counterparts link only through
`canonicalIco` (a non-canonical id gets no link); the two NENALEZENO
AGROFERT ancestors render their STORED annotations verbatim + dated
(extinct by merger into the named successor, incl. the name-collision
warning — never presented as registry-verified subjects, and the Czech
analyst prose deliberately does NOT pass the language gate: it is graph
DATA); a company with no `owns_stake` edge gets NO block (absent ≠ empty —
166 of 195 tied companies); a row whose counterpart the graph did not
return drops and is COUNTED. One indexed `kgNeighbours` per company
(4–34 ms, `KG_READ_CAP` + `byListOrder` — every owns_stake weight is
null), the payload rides `CompanyCaseFileData` so `TIE_WIRE` and /penize's
public wire stay byte-identical, and the block's pass renders only when
ALL rows agree on one. `graph-schema.md` finally gained the `owns_stake`
row per its own sync rule.
**The ownership chain is walkable (2026-08-12).** The block's counterpart
links (Město Plzeň, Praha, Ministerstvo financí, the AGROFERT ancestors, 8
private non-tied parents) used to land on „graf nevede žádnou vazbu" —
`getCompanyDetail` bailed on `ties.length === 0` BEFORE looking at the
ownership it had already fetched. `getCompanyCaseFile()` now returns one of
two payloads from the SAME single read: the money case file (byte-identical
wire, pinned) or `CompanyRegistryFileData` — identity + registry links +
ownership block, NO money (not even a zero: no tie → no attribution rule →
a 0 Kč would be a claim), NO follow/deník affordance (no stream is keyed by
a tie-less firm — the `obec:` precedent), provenance from the ownership
edges' own uniform pass, never `ties[0]`. Neither-ties-nor-ownership still
→ null (no address minted for nothing), and `getCompanyDetail()` keeps the
narrow money contract so /overeni answers `zaznam-nenalezen`, never
„Ověřeno, 0 Kč". Riders: the company slice passes `readScope` (the
corpus-only cap heuristic no longer runs on a one-firm population) and the
`truncated` flag is threaded, not discarded.
**The money graph reads for keyboards, and the book speaks the gate's truth
(2026-08-12).** The hero graph was a dead end and an a11y hole — `role="img"`
(a LEAF role) over ~11 focusable `<g tabIndex={0} outline:none>` nodes, zero
links out, `reviewState` shipped per company and rendered nowhere. It now
follows the velín canvas pattern with `graphTraversal.ts` IMPORTED, never
forked: `role="group"`, ONE tab stop (roving tabindex), arrows walk EDGES,
Home/End, Enter/Space opens the node's case file, visible focus ring, the
keyboard pattern printed under the picture. `features/money/graphNav.ts` is
the pure adapter + href resolver: an address derives ONLY from the SHAPE of
`entityId` through `caseFileLink.ts` + `canonicalIco` — person → `/penize/
<pspId>`, company → `/penize/firma/<ičo>`, anything else (incl. EVERY sample
node) → null, stated in the footer. `pending_review` renders AT the node and
in its SR label (a shared picture must carry its own caption). Beside the
keyboard path a REAL `<Link>` (router.push can't open-in-new-tab). And five
falsifiable /penize sentences fell: the ledger disclaimer derives from the
SAME `reviewSummary()` the banner/graph read (four phases, four sentences —
the „všechny záznamy čekají" literal is deleted from both catalogs); „z 207
mandátů" takes its denominator from `MoneyStats.mandatesTotal` (the loader
read mandates and THREW THE COUNT AWAY; a failed read asserts NO denominator,
never zero); the kauzy teaser count cites its disk population
(`case-money/payloads` + the `isDossier` shape check); the method cadences
name the REGISTER as their subject (no scheduler runs over this repo — our
own reading claims only the pass that materialized the layer); and
`TIE_WIRE`'s two mis-justified fields were ruled on — `contractCount` stays
public AND now renders („{count} smluv" under the reach cell),
`donatedToPartyCzk` went internal (nothing on /penize renders it), with
`reachInput()` pinning that the reach arithmetic never consults the donation
(same tie with/without a 4M donation → identical CZK). The messages pins are
SHAPE rules, not allowlists: a literal „<number> <noun>" is banned in
`real.stats.*`, and every step cadence must name a subject derived from its
own step's title (falsified: 7 of 8 retired strings caught; the 8th already
named its subject). Related fix: the /admin T4 tripwire now reads
`share` — the prop the writer actually emits — so „drží 100 %" renders
instead of the eternal degraded fallback.
**The book speaks from the catalog and sorts truthfully (2026-08-12).**
TiesLedger's 25 bilingual `en ? … : …` ternaries — every filter label,
column header, placeholder, empty state, pagination — sat OUTSIDE the
catalog, so the language gate and the LITERAL_COUNT shape rule were
structurally blind to the feature's largest copy surface (two of the
literals shadowed live keys char-for-char). All 25 moved into
`money.real.ledger.*` (the result count is a real ICU plural); the closed
`tieClassInfo`/`temporalBadge` vocabularies deliberately stay where five
surfaces share them. The default sort was headed „třída" while sorting by
`reviewRank` — corroboration first, then money; measured: the last row of
211 was an owner-operator below 154 stewards. ONE control remains,
re-headed „síla důkazu" / "evidence strength", with the rule printed
above the table. Search folds diacritics through the ingest's own
`asciiFold` („teplarny" now finds Teplárny Brno), folded once per list —
and `reviewTypes.foldKey` (a second NFD-strip scheme) collapsed onto the
same function, pinned by `foldKey.test.ts` incl. classifyTie behavior on
live-corpus inputs. The ledger aside stopped describing the MOCK's
grouping over the real flat ledger; `reachNote` states the per-row
duplication (14 companies sit on >1 row — the tile de-dupes, the column
cannot). Six dead keys deleted; `sampleTies.sub` derives its ratio from
the mock data; the ARES cadence dropped its uncited „500 dotazů/min".
`loadClubs` joined the `MONEY_MEMO_TTL_MS` memo (2 registry reads per
request × 3 callers, gone; empty/failed never memoized); strety ↔ kauzy
finally cross-link; `GRAPH_COMPANY_CAP` has ONE definition and the graph
caption can disclose a crop via `companiesTotal` (live: cap does not
bind).
**The review console stopped losing what the reviewer wrote (2026-08-13).**
`/penize/kontrola` is the most leveraged user in the product — 211 pending
decisions gate /penize/strety, the evidence packets and /dukazy, and every
decision is appended to the tamper-evident hash chain — and its WRITE PATH had
a silent data loss. The advertised `1`/`2`/`3` queue shortcuts called
`handleDecide(…, null)` while the mouse path sent `noteDraft`, which was state
local to `ReviewCard` and unreachable from the parent's `window` listener; the
note is the ONLY thing that survives a decision into the chain
(`props.review_note` is overwritten by the next one), the shortcut handler
bails on TEXTAREA targets — i.e. precisely when a draft existed — and
`needs-more` without a note is a documented **no-op that writes nothing at
all**. So a reviewer could type a reason, blur the field, press `2`, and
believe a tie had been flagged when nothing happened. The draft is now lifted
to the parent as a ref (211 keydown listeners would have been the worse price)
and `handleDecide` is the ONE place a note is resolved; no call site passes
`null`, pinned by shape. A note-less `needs-more` is no longer submitted at all
and says so, returning the cursor to the field. Arrows move REAL DOM focus (they
used to repaint a border, so the screen reader stood somewhere other than where
`1`/`2`/`3` pointed) and the queue has ONE tab stop instead of 211 —
**`graphTraversal` is deliberately NOT imported here and the reason is in a doc
comment: that rule is planar (coordinates + edges) and this queue is a 1-D
list.** Write outcomes announce ONCE PER PAGE (`role="status"` for progress and
success, `role="alert"` for failure, both permanently mounted) from one pure
`writeStatusInfo` that the card's own note also reads, so the announcement and
the visible text cannot diverge. Three live lint warnings were fixed AT CAUSE:
`toLocaleString` on a server-rendered client surface (ICU thousands-separator
drift over ~30 counts) went through `useFormat`, and seven hand-rolled
`<p>zdroj: …</p>` became the shared `SourceNote`. `console.a11y.test.ts` strips
comments from the source before asserting, so the file's own header can neither
satisfy nor break a test. **Write semantics in `review.ts` / `reviewActions.ts`
are untouched**, and the ~95 hardcoded Czech literals in that file remain a
DEFERRED direction, deliberately sequenced after this fix.
**Every CZK total said which tax base it was (2026-08-13).** The contract
register publishes a contract's value on TWO bases — `hodnotaBezDph` and
`hodnotaVcetneDph` — and `lib/ingest/sources/smlouvy-dump.ts:31-34` says so in
its own header: *„They are NOT summable with each other, and a CZK total that
mixes them is wrong."* The harvest collapses them into one `amount` but
RECORDS which it used, on the contract node and on **every `supplies` edge**
(`props.amountBasis`). `grep -rn "amountBasis" features/ app/ messages/`
returned **zero**: the ledger's reach column, the case-file tiles, the company
headline and the spis's money section all silently mixed **82 918 bezDph ·
36 580 vcetneDph · 2 959 ciziMena** (`graph-log.md:950-951`) — the deepest
brand-rule violation in the tree, since it is not a missing citation but an
arithmetic the source itself calls invalid. `features/money/amountBasis.ts` is
the pure projection (counts ROWS, never CZK; returns message keys, the
`verdict.ts` pattern) and `components/BasisDisclosure.tsx` the ONE sentence
four surfaces share. **Disclosure, never repair** — no VAT rate is stored, so
converting would invent money (the `plausible-date.ts` precedent); **not one
CZK moved**, pinned by a test that re-implements the pre-change fold and
asserts `czk`/`count`/`amounts` identical with `Object.is` plus a float-ORDER
guard. **Zero new store reads**, proven not asserted: `moneyLoader.ts`'s 14
`store.*` call sites are byte-identical to `3119ef0` and both edge readers run
`select *`, so the basis was already in hand and the fold discarded it.
`none` („the register published no value") and `unrecorded` („the edge predates
the field") stay two claims in the DATA and merge only inside one sentence; an
unrecognised token becomes `unrecorded`, never a VAT side. The composition
rides `MoneyTieDetail` + `MoneyStats` and deliberately NOT `MoneyTie` — that
would need a `TIE_WIRE` classification and ship bytes to 211 ledger rows that
draw nothing (so the ledger discloses once above the table, over
`reachableMoney`'s own de-duplicated population).
**And „100 %" stopped posing as a registry figure.** The ownership block
typeset a stake that no registry published: `dataor-ownership-chains.ts:177`
derives it as `/jedin[ýá]/i.test(role)` — **a regex on one Czech word in a
free-text role label** — while the real `stakePct` in `lib/ingest/sources/
dataor.ts` is dead (both construction sites write `null`). It carries **33 of
33** `owns_stake` edges, so the whole block rested on that word.
`classifyShare()` splits `sole-owner-role` from `published` (a value the regex
could not have produced) from `null`: the derived case renders a sole-owner
STATEMENT with the role wording beside it as evidence, a published percentage
is NOT downgraded, and an absent share stays absent — never „0 %". The
genuinely measured `owner_stake_pct` on `linked_to` (ARES VR,
`reconcile-ares-vr.ts:156`) is untouched. Recorded follow-up: the writer script
should import `SOLE_OWNER_ROLE_RE` (the `classifyTie` precedent) so reader and
writer cannot drift.
