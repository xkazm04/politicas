# Money loop — fleet handoff (batch 006)

Case ① FollowTheMoney · 2026-07-25 · fleet mode (effort + law + kiosek
executors concurrent) · Sonnet driver + 2 Opus verification passes (max
reasoning depth). Full narrative + Opus verdict excerpts in
`docs/data-analysis/case-money/batch-006.md` — this document is the
orchestrator's action list: exact payloads, validation commands, schema
proposals, commit plan, lessons. **No commit made. No live `.pglite` write.
No `review_state` flipped anywhere.** All work happened on a case-suffixed
copy (`.pglite-copy-money-b6`, deleted at the end of this run — never
`./.pglite`). This document supersedes batch-005's `handoff.md`, now
historical.

## Headline number

**dataor closed 4 of the 32 live open corroborations this batch**
(2 via the general sweep + 2 via the PRaK re-point) — see batch-006.md §0
for why "32" is the correct live figure, not the batch brief's stale "81"
(pre-OSVČ-purge count).

## 1. New source: dataor.justice.cz bulk-ISVR ingest adapter

**Shipped, uncommitted, in the tree:**

```
NEW   lib/ingest/sources/dataor.ts        # CKAN client + udaje grammar parser + court/
                                            # legal-form resolver + CSV reader + high-level
                                            # fetchAndFindRecord()
NEW   lib/ingest/sources/dataor.test.ts   # 21/21 tests, real captured record fixtures
EDIT  .gitignore                          # + .dataor-cache/ (raw bulk files, gitignored
                                            # like .justice-samples/)
```

Licence note (logged per the source assessment): dataor's data is
**non-commercial-use only** and carries personal data (officer birth
dates/addresses) under a GDPR-controller obligation. This adapter extracts
`narozDatum` **only** for identity-matching comparison against our own
roster — never surfaced as narrative content, consistent with the platform's
existing "public-role facts only" doctrine.

**A real bug found and fixed mid-batch** (caught by an Opus verification
pass, not the driver's own review): the first version's officer-type
recognition only covered `STATUTARNI_ORGAN_CLEN`; dataor also uses
`DOZORCI_RADA_CLEN` (dozorčí rada/supervisory board), `KONTROLNI_KOMISE_CLEN`,
and `SPRAVNI_RADA_CLEN` for equally-real officer seats with the identical
`osoba`/`narozDatum` shape — the pre-fix extractor silently dropped a
birth-date-confirmed corroborating match entirely. Fixed
(`OFFICER_TYPY` set expanded); regression tests added.

Also fixed mid-batch: a CSV parser rewrite (index/`indexOf`-based row
reading instead of character-by-character accumulation) after the first
version OOM'd at 4GB heap on a real 321MB decompressed file.

**Validation**: `npx vitest run lib/ingest/sources/dataor.test.ts` → 21/21.

## 2. Job A — dataor corroboration sweep

**Shipped, uncommitted:**

```
NEW   scripts/case-loops/money/dataor-corroborate.ts
NEW   docs/data-analysis/case-money/payloads/batch-006-dataor-corroboration.json  # 30 proposals
NEW   docs/data-analysis/case-money/dataor-corroboration-summary.json
```

**Every proposal is a props-merge onto an EXISTING `linked_to` edge** — same
discipline as batch-001/002's `reconcile-ares-vr.ts`. NEVER creates a
person↔company edge, NEVER touches `review_state`.

| result | count |
|---|---|
| `match` (upgrade to `registry-confirmed`) | 2 |
| `not-isvr-registered` (structural, verified) | 9 |
| `ico-not-in-dataset` (court/form guess wrong) | 6 |
| `no-match` (checked, honest negative) | 4 |
| `fetch-incomplete` (network budget, see lessons) | 5 |
| `dataset-not-found` | 1 |
| `court-form-unresolved` | 3 |

The 2 `match` proposals (Jana Černochová↔Komwag, Marek Ženíšek↔Pojišťovna
VZP) are **Opus-verified and corrected** — see §5.

## 3. Job B — PRaK re-point (Q-money-7), CLOSED

**Shipped, uncommitted:**

```
NEW   scripts/case-loops/money/prak-repoint.ts
NEW   docs/data-analysis/case-money/payloads/batch-006-prak-repoint.json  # v2, post-Opus-correction
```

**Two proposals, MUST be applied together**:

1. `nodeCreateProposal` — `company:ico:61858111` ("PRaK, a.s. v likvidaci")
   does not exist in the graph yet (ARES never had it — 404 on both REST
   endpoints, dissolved 2012).
2. `edgeRepointProposals` — **2 edges**, both `psp:person:346` (Bendl) and
   `psp:person:6184` (Brabec), currently pointed at the wrong IČO
   (`49683144`, "PRAK spol. s r.o.", a different, still-active s.r.o.),
   re-pointed to `company:ico:61858111`. Both edges are now
   `corroboration: "registry-confirmed"` (exact birth-date matches for
   both). `tie_class` is `"manager"` (Bendl, board-management role) /
   `"steward"` (Brabec, non-management board seat) — computed by the SAME
   deterministic classifier the rest of the 260-tie graph uses, with **no
   asserted public-appointment narrative** (a v1 "mayoral ex-officio at a
   rail SPV" claim was retracted after Opus found it unsupported by the
   primary record — see §5).

**Orchestrator persist order**: create the node FIRST, then re-point both
edges (the re-point payloads reference the new node id — validated by
`validate-batch006.ts`, §6).

## 4. Job C — indirect-ownership first slice (O-money-3)

**Shipped, uncommitted:**

```
NEW   scripts/case-loops/money/dataor-ownership-chains.ts
NEW   docs/data-analysis/case-money/payloads/batch-006-ownership-chains.json  # 55 edges, 19 new nodes
```

**Schema proposal (additive — `kg-verdict.ts` is shared, NOT edited by this
fleet run):**

```ts
// KG_EDGE_RELS += "owns_stake"   (company -> company)
// props shape: { role: string | null, from: string | null, to: string | null,
//                share: number | null, source: string, note: string }
```

Confirmed no collision with the existing `"owns"` rel (organ→theme, the
law/effort loops' F12/F15 committee-remit edge — different node kinds,
different semantics; checked directly in `kg-verdict.ts` before proposing a
new name).

**AGROFERT, a.s. (IČO 26185610) — the task's flagship example — has a real,
dated shareholder chain in the data**: AGROFERT HOLDING, a.s. (sole
shareholder 2002-06-20→2004-08-31) → a predecessor AGROFERT a.s. entity
(sole shareholder 2004-08-31→2005-06-30). **The chain does NOT reach the
well-known post-2017 trust-fund (AB private trust) restructuring** — not
investigated further this batch, flagged as a lead. **No MP-exposure
inference drawn** — company-to-company facts only, per doctrine.

55 total `owns_stake` proposals across 19 new parent-company node proposals;
195 companies considered, 153 not attempted (scope-bounded — logged with a
reason each, see the payload's `notAttempted` array), 15 resolved with zero
corporate shareholders (honest negative).

## 5. Opus verification (P51) — full verdicts

**Pass 1 (PRaK re-point, v1 draft): WITH CORRECTIONS.** Opus independently
downloaded and decompressed the 321MB primary file itself (not the script's
cached output) and found 4 real defects — parser gap (§1), a wrong
`role_valid_from`, a false claim about a shared `vymazDatum` field's
meaning, and an unsupported "mayoral ex-officio/rail SPV" narrative behind
`tie_class: "steward"`. **All 4 corrected**, v2 payload in the tree.

**Pass 2 (general sweep, 2 closures): PARTIAL × 2, WITH CORRECTIONS.**
Opus independently fetched ARES VR's own live endpoint for both IČOs and
found the v1 draft's central justification ("ARES VR's live snapshot missed
this match, dataor's bulk history caught it") **false** — ARES VR
demonstrably has both memberships already. The actual cause of the
batch-002 ARES-VR reconciliation's original "conflicting" classification
was **not re-diagnosed this batch** (open item, below). Also caught:
Černochová's tenure understated (4 terms, 2007–2021, not just the last one)
and Ženíšek's bare `"člen"` role needing its organ qualifier restored.
**All corrections applied and re-verified** (re-run confirms the corrected
output).

Full text of both verdicts (verbatim) is in `batch-006.md` §5.

## 6. Validation commands (for the orchestrator)

```bash
# 1. Re-check the adapter + regression tests:
npx vitest run lib/ingest/sources/dataor.test.ts
npx tsc --noEmit

# 2. Gate ALL THREE batch-006 payloads (entity-id membership, no fabricated ids):
PGLITE_PATH=./.pglite-copy-money-b6 npx tsx scripts/case-loops/money/validate-batch006.ts
# (or point PGLITE_PATH at a fresh copy of the live ./.pglite before persisting)

# 3. Inspect payloads directly before persisting:
cat docs/data-analysis/case-money/payloads/batch-006-dataor-corroboration.json
cat docs/data-analysis/case-money/payloads/batch-006-prak-repoint.json
cat docs/data-analysis/case-money/payloads/batch-006-ownership-chains.json

# 4. Full suite:
npx vitest run
npx eslint lib/ingest/sources scripts/case-loops/money
```

**All 3 payloads validated cleanly this batch**: 30/30 corroboration
proposals, 2/2 PRaK edge re-points (+ 1 node create), 55/55 owns_stake
proposals (+ 19 node creates).

## 7. Open items / follow-ups for the next batch

1. **5 `fetch-incomplete` ties** (Bauer↔TAMPA, Okamura↔MIKI TRAVEL,
   Kučera↔Sirius Praha, Šafránková↔Pražská VŠPS — all `sro-full-praha-2026`;
   Jurečka↔AGRO 2000 — `sro-full-brno-2026`). Retry command in
   `batch-006.md` §7 lesson 4 — pre-fetch via curl with a long timeout, the
   adapter's own cache will pick it up on the next `dataor-corroborate.ts`
   run with zero code changes needed.
2. **The batch-002 ARES-VR reconciliation's original "conflicting"
   classification for Černochová↔Komwag and Ženíšek↔Pojišťovna VZP was
   never actually explained** — Opus proved ARES VR's live endpoint DOES
   carry both memberships, so something in the original reconcile pass (or
   a later re-ingest) produced a false negative. Worth a targeted
   diagnostic pass: re-run `reconcile-ares-vr.ts` fresh against these two
   ICOs and diff against what's currently in the graph.
3. **`nevlad_org` legal-form-slug mapping is unverified and empirically
   often wrong** (4/4 misses this batch for z.s./spolek entities) — dataor's
   catalog has several NGO-adjacent slugs
   (`nevlad_org`/`pobspolek`/`z_pobocny_spolek`/`zaj_sdr_po`/`p_nevlad_org`)
   with no documented ARES-`pravniForma`-code mapping. A future batch
   should brute-force test each against a known z.s. IČO to fix
   `PRAVNI_FORMA_TO_SLUG` in `lib/ingest/sources/dataor.ts`.
4. **A Ženíšek↔CONTACID a.s. lead** (IČO 26360934, dozorčí rada
   2004-2007, birth-date matched) surfaced as an Opus byproduct — not in
   the graph, not proposed this batch, needs its own gated treatment.
5. **The 3 `court-form-unresolved` ties** (Bendl↔Svaz měst a obcí,
   Pastuchová↔Nemocnice Jablonec, Patková↔Hvězdárna a planetárium HK) need
   a manual aggregator lead the way PRaK itself did — not attempted this
   batch, structurally similar to the PRaK dead end before batch 003 found
   kurzy.cz.
6. **AGROFERT's post-2017 trust-fund restructuring is not visible in this
   batch's chain** — worth a targeted follow-up (try the `sf` legal form,
   or check whether the transfer used a different engagement mechanism this
   extractor doesn't yet parse).
7. **Indirect-ownership Job C's 153 not-attempted companies** are a real,
   bounded scope decision (12-new-fetch budget this batch) — the payload's
   `notAttempted` array has every reason logged; a future batch can widen
   the fetch budget now that several large court×form files are already
   cached.

## 8. Shared-vault additions (exact text to append — not edited myself, fleet rule)

**`patterns.md`** (proposed new entry): *"A driver's own background-task
wait is not a substitute for finishing the work in-session — the kernel's
'a driver never ends its run waiting' rule was violated mid-batch (money
batch 006, Jobs A/C dispatched to background monitors and the driver
genuinely stopped issuing tool calls); corrected by switching to
bounded-timeout foreground execution (Promise.race with a short cap on any
uncached large fetch) so the whole sweep completes deterministically within
one session, never relying on out-of-band notifications to resume."*

**`patterns.md`** (proposed new entry): *"A parser's own narration of what
it extracted is not evidence it extracted everything — an Opus verification
pass caught a real officer-type-code gap (dataor's `DOZORCI_RADA_CLEN` etc.)
that a Sonnet-only build had silently missed, and a second Opus pass caught
a false claim about why a primary source 'didn't see' a match it actually
had. Independent re-derivation from the primary source, not trust in the
script's own summary, is what caught both (money batch 006)."*

**`contradictions.md`** (proposed new entry): *"Money batch 002's ARES-VR
reconciliation marked Černochová↔Komwag and Ženíšek↔Pojišťovna VZP as
'conflicting' (no birth-date match found); batch 006 independently
confirmed via Opus that ARES VR's own live endpoint DOES carry both
matches. The batch-002 classification was therefore a false negative from
this loop's own earlier pass, cause not yet diagnosed — flagged for a
targeted re-run, not assumed to be dataor finding something ARES genuinely
lacks."*

No other shared vault files or shared code enums touched.

## 9. Lessons learned

Full list with detail in `batch-006.md` §7. Summary:

1. A driver ending its run on background-task waits violates the kernel's
   explicit rule — corrected mid-batch, documented as a standing pattern.
2. Two real defects (a parser officer-type gap; a false claim about a
   primary source's completeness) were caught ONLY by independent Opus
   re-derivation, not by the driver's own review of its own script's
   output — the third consecutive batch (004/005/006) with this exact
   finding.
3. Character-by-character CSV/text accumulation does not scale to real
   200-300MB+ decompressed government bulk exports — index-based scanning
   fixed a real 4GB-heap OOM.
4. A single very large court×form file can stall an entire sweep if fetched
   naively — bounded per-file network budgets (25s for any uncached file)
   are now standard in both dataor scripts.
5. Structural negatives (9 `not-isvr-registered` closures) are worth
   verifying live, not inheriting from a prior batch's label — spot-checked
   against ČESKÁ TELEVIZE's actual ARES subject record.

## 10. Cleanup

`.pglite-copy-money-b6` deleted at the end of this run. No live `./.pglite`
write occurred at any point. `.dataor-cache/` (raw bulk files, several
hundred MB) is gitignored and left in place for the next batch to reuse
(cache-hit is instant; a fresh checkout would need to re-fetch). No
`.pglite-copy-<other-case>` directory belonging to the concurrent
effort/law/kiosek loops was touched.
