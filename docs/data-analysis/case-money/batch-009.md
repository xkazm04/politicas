# Money batch 009 — the indirect-ownership layer was never actually asked

Case ① FollowTheMoney · 2026-07-27 · **solo mode** (no sibling case driver running;
ship authority per the kernel's Authority section — this batch writes live and commits).
Driver: Opus. One Sonnet subagent (the Registr smluv client build).

> **Headline.** Batch 008 reported "0 indirect exposure" from the `owns_stake` layer and
> its Opus pass corrected that to "0 *sibling-level*, parent/descendant unchecked."
> Batch 009 checked the unchecked directions — and then checked whether the check could
> have found anything at all. It could not. **The `supplies` relation covers exactly the
> 149 MP-tied companies the money feed ever contract-queried; 0 of the 19 ownership
> parents were among them.** The whole indirect-exposure question had never been put to
> the contract registry. Two batches of null results were arithmetic, not evidence.
> Along the way the traversal itself turned out to be broken: 8 parent nodes carried
> unpadded IČOs, one of them a duplicate that had **severed a real ownership chain**.

## 0. Resume — live state verified, not assumed

Three carry-forward items had been rolling since batch 005 with their status
explicitly *not* re-verified. All three were checked against the live DB first
(`scripts/case-loops/money/live-state-b9.ts`):

| carry-forward | asserted status | **verified status** |
|---|---|---|
| OSVČ purge (Q-money-11) | "assumed landed" since batch 005 | **landed** — 211 ties, node gone |
| D5 `review_audit` CHECK migration | "built, not applied" (3 batches) | **already present live** — migration is a NOOP, item CLOSED |
| batch-008 Q-money-15 flip payload | awaiting orchestrator | **not applied** — applied this batch |

Live state at batch start: 211 `linked_to` (all `pending_review` — the human gate is
intact), 183 registry-confirmed / 19 conflicting / 9 registry-unconfirmed, 33
`owns_stake`, 36 `cites`, **0 `concerns`**, 2 290 `supplies`, 215 company nodes.

## 1. Q-money-18 (NEW, the batch's most consequential defect): IČO id drift

Company identity in this graph is `company:ico:<8-digit zero-padded IČO>` — 207/215
nodes and **100% of contract `supplierIco` values** follow it. Batch-006's ownership
slice wrote its new parent nodes straight from the dataor export without padding,
producing 8 malformed nodes:

```
company:ico:11835 (DEZA)      :1350 (ČSOB)        :254843 (Město Ostrov)
:274046 (Stat. m. Pardubice)  :2867681 (IF Holding)  :64581 (HL. M. PRAHA)
:6947 (Ministerstvo financí)  :75370 (Město Plzeň)
```

Two real consequences:

1. **A split identity.** `company:ico:2867681` (IF Holding a.s.) duplicated the
   canonical `company:ico:02867681` — which is MP-tied via `linked_to` **and** is the
   `dst` of one `owns_stake` edge, while the malformed twin was the `src` of another.
   IF Holding's ownership chain was severed across two node identities, so every
   multi-hop traversal stopped dead there — including this batch's own breadth-2 walk.
2. **Every IČO join against those 8 was a guaranteed false negative**, including
   batch-009's first parent-contract check (which compared unpadded values against
   8-padded `supplierIco`s and would have silently reported "no contracts").

**Fixed and applied live** (`scripts/case-loops/money/canonicalize-ico-nodes.ts`,
dry-run default, `--commit` + `--confirm-live` gate, idempotent — a second run reports
0 malformed): 8 canonical node upserts (IF Holding **merged**, canonical node survives),
14 edge re-points, 14 old edge deletes, 8 malformed node deletes. The script identifies
its target set by querying, never by hardcoding, and **refuses outright to move a
`linked_to` edge** — a human-gated accusatory tie is never relocated by a script.
Re-running the breadth-2 walk after the merge reached **3 more companies and extended
descendant depth from 1 to 2** — the severed chain reconnected. Payload:
`payloads/batch-009-ico-canonicalization.json`.

## 2. Indirect ownership, breadth 2 — and the power check that reframed it

`scripts/case-loops/money/indirect-ownership-breadth2.ts` generalizes batch-008's
sibling-only test to the **full `owns_stake` closure in both directions** from every
MP-tied company, tagging each reached company `ancestor` / `descendant` / `collateral`
with hop depth and the construction-bias flag `alreadyTied`.

| direction | rows | not already MP-tied | max depth |
|---|---|---|---|
| ancestor | 8 | 0 | 2 |
| descendant | 9 | 0 | 2 |
| collateral | 22 | 0 | 2 |

**0 genuinely-new exposure in every direction, at every depth.** Batch 008's lesson
says a null must be power-checked before it is reported, so
`scripts/case-loops/money/parent-exposure-power-check.ts` asked whether a hit was
even possible:

- 19 ownership parents are not themselves MP-tied; **19/19 carry an IČO**, and
  **0/19 have a single `supplies` edge** — none was ever contract-queried.
- `supplies` covers **149/215** company nodes — exactly the 149 MP-tied companies the
  money feed queried. The contract corpus contains **149 distinct `supplierIco`
  values** for 2 287 contract nodes.
- Missing-edge candidates (parent IČO present as a `supplierIco` with no `supplies`
  edge): **0**, under both the padded and unpadded convention.

> **VERDICT: ZERO-POWER.** No non-MP-tied parent was ever contract-queried, so a
> parent-level null was arithmetically guaranteed. This is the *same* failure shape
> batch 008 caught at sibling level, one layer up — and it survived an Opus correction
> pass because that pass fixed the *framing* of the null without asking whether the
> **next** test would have any power either.

Artifacts: `qmoney-indirect-breadth2-b9.json`, `qmoney-parent-power-b9.json`.

## 3. The unlock — a token-free Registr smluv client

The remedy is to actually ask the contract registry about the parents. `HLIDAC_API_TOKEN`
is still absent, so the kernel's bounded-probe rule applied: probe whether the same
source exposes a cheaper access path. It does.

**`lib/ingest/sources/smlouvy.ts` + tests (36/36)** — a Registr smluv (ISRS) party-search
client, **no token required**:

- `GET /vyhledavani?party_idnum=<8-digit IČO>&all_versions=0`; `party_idnum` matches
  **either** contracting party (so a hit means "appears in a published public contract",
  never "was paid public money" — each row keeps its publisher so direction is readable).
- **No structured export exists** — `&export=1|xml|csv` all return the same HTML
  (verified; not claimed as an API).
- Pagination is a **Nette session signal**, not a stateless query param: a
  `do=searchResultList-setLimit` request only works as a *second* request carrying the
  first response's cookie. Verified with cookie-jar tests; a bare limit param is ignored.
- `Neuvedeno` → `valueCzk: null`, **never 0** (the brand rule).
- Fail-loud on header drift rather than mis-parsing a shifted column.

**Defect found and fixed in review (worth recording):** the client's header check
required a literal `"Detail"` label on the trailing action column. That matched the
subagent's own fixture and **rejected all 18 live pages** on the first sweep. The live
site renders that `<th>` empty. Fixed to assert the six *labelled* columns by label and
the table width by count; a regression test now pins it. A fail-loud guard calibrated
against a self-authored fixture is not a verification — it is the fixture agreeing with
itself.

## 4. Parent contract sweep

`scripts/case-loops/money/parent-contract-sweep.ts` queries each ownership parent that is
**not MP-tied and was never contract-queried** — exactly the blind spot §2 identified —
and applies the case's hardest-won rule at report time: a parent that is itself a public
body (ministry / kraj / město) has contract activity that is **its own mandate and is
never attributable to an MP**, reported under a separate heading.

smlouvy.gov.cz rate-limits (429) an unthrottled sweep within a handful of requests — hit
on the first run. The script now paces itself (`--delay`, default 12 s) and backs off on
429; **a 429 is recorded as an explicit query failure, never as "no contracts"**.

**10 private-by-name parents queried; 8 answered, 2 rate-limited out.** The four
non-zero results are the **first indirect-exposure evidence in this case's history** —
money reachable through the ownership layer that the direct `linked_to` join cannot see:

| parent | contracts | stated value | period | owns MP-tied |
|---|---|---|---|---|
| Zdravotnický holding Královéhradeckého kraje a.s. | 222 | 1 088 489 502 CZK (121 valued, 101 unstated) | 2016-09-23 – 2026-07-14 | Oblastní nemocnice Trutnov a.s. |
| Lázně Luhačovice, a.s. | 214 | 173 511 488 CZK (171 valued, 43 unstated) | 2016-07-27 – 2026-07-27 | Léčebné lázně Jáchymov a. s. |
| Rybářství Třeboň Hld. a.s. | 56 | 38 155 159 CZK (50 valued, 6 unstated) | 2016-07-19 – 2026-06-11 | Rybářství Třeboň a.s. |
| DEZA, a.s. | 91 | 13 526 307 CZK (80 valued, 11 unstated) | 2017-02-02 – 2026-07-13 | Synthesia, a.s. |

Reproduced identically across two independent runs. **Every one of these is a LEAD, not
a finding**, and four caveats bind before any of it goes near a person:

1. **`party_idnum` matches either party.** Each row keeps its publisher; direction has
   not been read yet. "Appears in a public contract" ≠ "was paid public money".
2. **Zdravotnický holding Královéhradeckého kraje is kraj-OWNED** — the biggest number
   in the table is a public body's own activity under a private legal form. The
   `PUBLIC_BODY_RE` classifier keys on the *name*, so it caught the ministries, kraje
   and města and missed this one. Under the tie-class steward rule that 1.09 bn CZK is
   **not attributable to any MP**, and the classifier needs an ownership-based test, not
   a name-based one, before the next sweep.
3. **The four zeros are not clean negatives.** Registr smluv only carries contracts
   published from **2016**; the two AGROFERT parents are dissolved pre-2016 entities
   (§4a) so their 0 was structurally guaranteed, and ARES reports Léčebné centrum sv.
   Markéty as "Resort sv. Markéty Prachatice, a.s. **v likvidaci**". Only UNICO
   Pardubice's 0 is an ordinary negative.
4. **2 parents are unmeasured, not zero** — ČSOB and České dráhy exhausted the 429
   backoff (both are very large publishers). They are recorded as explicit query
   failures.

### 4a. Q-money-19 — two ownership IČOs do not resolve in the registry

The AGROFERT zeros were not accepted. An ARES check over **all 47 ownership-layer nodes**
(`parent-ico-existence-check.ts`, basic **and** `-vr` endpoints — the doctrine's required
pair before asserting an absence) found **45 exist, 2 do not**:
`25130072` "AGROFERT HOLDING, a.s." and `60197773` "AGROFERT a.s." — **precisely the
nodes batch 006 headlined as "a real dated AGROFERT ownership chain."**

They are **not fabrications**, and the batch's first reading of them as such was wrong:
the owning edges come from dataor/justice.cz's ISVR export — a primary registry — with
dated 1999–2005 sole-shareholder records, i.e. **dissolved predecessor entities the
current register no longer retains**. The real AGROFERT, a.s. (`26185610`) exists and is
in the graph as their child. Both nodes were annotated live (Czech analyst note,
checked endpoints, `likely_historical_entity`, successor candidate) so no surface can
ever present them as registry-checkable. Two label drifts were also recorded, not
corrected: ARES calls `26040166` "Resort sv. Markéty Prachatice, a.s. v likvidaci" and
`00075370` "Statutární město Plzeň".

Artifacts: `qmoney-parent-contract-sweep-b9.json`, `qmoney-ico-existence-b9.json`,
`payloads/batch-009-unresolvable-ico-annotation.json`.

## 5. Carry-forward decisions

**Q-money-16 (dataor large files) — RETIRED, on evidence, not fatigue.** Four attempts
across batches 006 and 008 reproduced the same structural stall on the two largest
court×form files. Decisive fact: the 4 ties it was meant to close (Bauer↔TAMPA,
Kučera↔Sirius Praha, Šafránková↔Pražská VŠPS, Jurečka↔AGRO 2000) were **all independently
re-verified against live ARES VR in batch 008 and returned confirmed negatives**
(`qmoney15-summary.json`). The bulk path buys nothing they do not already have. The
kernel's deferred-three-batches rule forces commit-or-retire; this is a retire with a
reason.

**Batch-008 steering item 4 (apply kiosek `concerns` payload so the money watch gains
power) — WRONG AS STATED, corrected.** Checked deterministically
(`kiosek-power-check-b9.ts`): the payload carries 24 `concerns` proposals over 20
distinct targets, of which **0 are company nodes in the live graph and 0 are MP-tied
companies**. Applying it would leave the money watch reporting 0 *by construction* —
the same zero-power shape, one step later. The payload may well be worth applying for
the case-sources/law surfaces; it is not a money-watch remedy, and carrying it as one
would have cost a future batch.

**Q-money-13 (stale purged-IČO mentions) — partially closed, measured.** A full string-leaf
walk of every node's props (`stale-mentions-open-b9.ts`, which recurses into nested
citation objects the batch-005 scanner counted only at top level — hence 60, not 58)
finds **60 mentions; 39 carry explicit closure wording, 21 do not**: **14 law-owned**
(bill `forensic_citations[N].claim/.source` and `forensic_conflict_assessment(_en)`
across tisky 43111/43118/43178/43196/43366) and **7 effort-owned** (6 bare
`effort_citations[N]` URLs + 1 `effort_notes`). These are sibling-owned analyst prose
and citation arrays; this batch **records the exact list rather than half-editing another
case's verdict text at batch end**. Itemized in
`qmoney-stale-mentions-open-b9.json`.

## 6. Live writes made this batch (solo mode, ship authority)

| write | scope | result |
|---|---|---|
| batch-008 Q-money-15 flip | 1 `linked_to` props-merge (Okamura ↔ MIKI TRAVEL) | applied, pass 36, `conflicting → registry-confirmed` |
| Q-money-18 canonicalization | 8 company nodes, 14 `owns_stake` re-points | applied |
| D5 CHECK migration | — | NOOP, constraint already live |

**No `review_state` was touched. 211 ties remain `pending_review`** — the human gate is
untouched, as in every prior batch. Post-write live state: 184 registry-confirmed / 18
conflicting / 9 registry-unconfirmed; 214 company nodes; 33 `owns_stake` with 0 duplicate
`src|dst` pairs.

## 7. Open items for batch 010

1. **The sweep's private-parent hits are LEADS, not findings.** Each needs the direction
   read off its publisher, tie-class applied, and a dated overlap check against the MP's
   role before it is anything more. Nothing from §4 is graph-writable as-is.
2. **`supplies` coverage is the real ceiling on this whole case**: 149/215 companies.
   The money feed only ever queried MP-tied companies. Extending the Registr smluv client
   to the un-queried remainder is now cheap and token-free — this is the highest-value
   next ingest step.
2b. **The public-body classifier must become ownership-based before the next sweep.**
   It keys on the entity NAME, which caught every ministry/kraj/město and missed a
   kraj-owned holding under a private legal form — the single largest number this batch
   produced. Until it is fixed, no sweep result may be attributed to an MP without a
   manual publicness check.
2c. **ČSOB and České dráhy are unmeasured, not zero** — both exhausted the 429 backoff.
   Re-query with much longer pacing.
3. **Q-money-13's remaining 21** (exact nodes/props listed in
   `qmoney-stale-mentions-open-b9.json`) — **law owns 14, effort owns 7**. Note for the
   owning drivers: the batch-005 scanner only counted top-level string props, so nested
   `citations[N].claim/.source` residue was never in its 26.
4. `owns_stake` "39 vs 33" from batch 008 was **not a data-integrity defect** — the graph
   has 0 duplicate `src|dst` pairs. The artifact counted *(tie × parent)* pairs, not
   edges; a company tied by two MPs yields two rows. Closed, no action.
5. The presentation gate is **not** cleared for this batch's output: none of §2–§4
   renders anywhere. See the manifestation note below.

## 8. Manifestation check (kernel step 6)

This batch persisted a **correction** (8 canonicalized nodes, 1 merged chain, 1
corroboration flip) rather than new reader-facing content, so it adds no new
manifestation debt of its own — the flip renders through the existing `/penize` tie list
and `/penize/kontrola` console, which already show corroboration state and review state
honestly.

It does, however, **name existing debt precisely**: the `owns_stake` layer (33 edges, 24
parents) has **no surface at all**. It is invisible to readers, and until §7 item 2
lands there is nothing worth showing. Recorded as standing debt, not silently carried.

## 9. Lessons

1. **A corrected framing is not a corrected test.** Batch 008's Opus pass rewrote a null
   result's *wording* honestly ("sibling-level only, parent unchecked") and everyone —
   including this batch's own plan — read that as "so go check the parents." Nobody asked
   whether the parent check *could* return a hit. It could not, for the same structural
   reason. When a null is reframed rather than fixed, the reframing must state the power
   of the **next** test, or it just relocates the tautology.
2. **A fail-loud guard verified against its own fixture is not verified.** The header
   check was correct in design and wrong in calibration, and only a live run over 18 real
   pages exposed it. Any scraper guard should be exercised against at least one live
   fetch before it is trusted to distinguish drift from normality.
3. **Identity conventions are load-bearing and drift silently.** An 8-digit padding rule
   nobody wrote down cost a severed ownership chain and would have cost a false negative
   in this batch's headline check. Where a graph keys on an external identifier, the
   canonical form belongs in a gate, not in the habits of whoever wrote the last ingest.
4. **Verify carry-forward items before carrying them.** Three items had rolled for 3–4
   batches labelled "status not re-verified"; one was already done (D5), one was actively
   wrong (kiosek), one was partially done (Q-money-13). A five-minute live census
   settled all three. "Carry forward if still open" is not a status.
