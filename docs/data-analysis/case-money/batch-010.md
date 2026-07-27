# Money batch 010 — asking the question the case had never asked

Case ① FollowTheMoney · 2026-07-27 · sibling law/effort sessions running concurrently.
Driver: Opus. One Opus verification pass at maximum depth (the **top-signal trigger,
armed since batch 002, fired for the first time**).

> **Headline.** Batch 009 built the tool; batch 010 used it. Sweeping the companies the
> money feed had never contract-queried produced two findings of opposite sign, and the
> quieter one is the more important:
>
> 1. **All 18 `owner-operator` companies — the entire class where money could actually
>    reach an MP — hold ZERO published public contracts.** Clean hands, measured rather
>    than assumed.
> 2. **The graph's Babiš↔AGROFERT record was a decade stale.** It held a board role that
>    ended in 2014 and missed a **`jediný akcionář` (sole-shareholder) registration inside
>    the current parliamentary term** — 2025-10-15 to 2026-02-20, a window in which the
>    person was also **Prime Minister** from 2025-12-09.

## 1. The un-queried population (steering item 1)

Batch 009 established the case's ceiling: `supplies` edges exist only for the 149
companies the original money feed happened to query. `unqueried-population-b10.ts`
enumerates what that left out and ranks it by the case's own attribution rule —
`tie_class` first, because money reaching an `owner-operator` company can plausibly reach
the MP, while a `steward` tie is a public-body board seat whose money is the body's own.

| | count |
|---|---|
| company nodes | 214 |
| ever contract-queried | 149 |
| **never queried, queryable** | **63** (MP-tied 46, parents/other 17) |
| excluded — IČO unresolvable in ARES | 2 (both AGROFERT, §4) |
| un-queried **MP-tied** by class | **owner-operator 18** · manager 5 · steward 23 |

**18 owner-operator companies had never been asked whether they hold public contracts.**
That was the case's largest blind spot, and it sat in exactly the class the whole
Integrity pillar depends on.

## 2. The sweep — and a clean-hands result

`company-contract-sweep.ts` runs the ranked population through the token-free Registr
smluv client. Two batch-009 defects are fixed in it:

- **Results are persisted after EVERY company**, with `--resume`. Batch 009's sweep wrote
  its payload only at the end and lost 8 completed queries when the process died.
- **A failure is an `error` row, never a zero**, and `--resume` retries exactly those. A
  real HTTP 500 appeared mid-sweep, so the retry predicate now covers 429 **and any 5xx**
  (a header-drift or parse error is deliberately NOT retried — that would just repeat a
  bug).

**Result — owner-operator class: 18/18 answered, 0 hold any published public contract.**
The `manager` class was swept too: **4/5 answered, also all zero**; Teplárny Brno, a.s.
exhausted the 429 backoff and is recorded **UNMEASURED, not zero** (it is a Brno
city-owned heating utility, so on the classifier's ownership test its money would in any
case be the city's own activity, not the MP's).

That is a finding, not an empty run, and the doctrine gives it equal weight to an
accusatory one: the companies sitting MPs personally own or run are, as a class, absent
from the public contract register. It is also the strongest available answer to the
suspicion the module exists to test, and it should be surfaced as such rather than filed
as "nothing found".

Caveat that binds it: Registr smluv carries contracts published **from 2016**, and
`party_idnum` matches either contracting party. A zero means "does not appear in the
published register since 2016", not "never received public money".

## 3. The public-mandate classifier (steering item 2)

Batch 009's public-body test keyed on the entity **name**. It caught every "Ministerstvo
…", "… kraj" and "Město …" — and missed **Zdravotnický holding Královéhradeckého kraje
a.s.**, a kraj-owned company under an ordinary `a.s.` form, which was also the single
largest CZK figure that batch produced. Attributing 1.09 bn CZK of a kraj's health
holding to an MP would have been a serious, brand-rule-breaking error.

`lib/analysis/public-body.ts` (15 tests) replaces it with an ownership test in two layers:
the entity's own `pravniForma`, then its **current** shareholders from the ARES VR record
(`akcionari` **and** `spolecnici` — batch 002's P35 lesson that several VR arrays are
load-bearing).

The design decision that matters: **an unrecognised legal-form code returns `unknown`,
never `private`.** The tables are explicit allowlists, each public code verified against a
named real subject (804 ← Královéhradecký kraj, 801 ← Město Ostrov, 325 ← Ministerstvo
financí, 361 ← ČESKÁ TELEVIZE, 601 ← Univerzita Karlova, …). ARES's own `PravniForma`
číselník endpoint returns only a 16-item fragment, so a closed-world assumption is not
available — and the expensive error here is calling a public body private.

Run over the batch-009 leads, the classifier reproduces the manual judgement
automatically:

| company | form | verdict | attributable |
|---|---|---|---|
| Zdravotnický holding Královéhradeckého kraje a.s. | 121 | **publicly-owned** (akcionář: Královéhradecký kraj) | **no** — 1 088 489 502 CZK removed from attribution |
| Lázně Luhačovice, a.s. | 121 | private | yes (lead only) |
| Rybářství Třeboň Hld. a.s. | 121 | private | yes (lead only) |
| DEZA, a.s. | 121 | private | yes (lead only) |

## 4. Q-money-20 — the sole-shareholder registration the graph did not hold

While re-deriving the AGROFERT chain (steering item 5) against the surviving entity
`26185610`, the VR record turned out to carry a live ownership history. The graph held
exactly one Babiš↔AGROFERT relation — *předseda představenstva, 2000-07-01 → 2014-01-22* —
and nothing about shareholding.

This is a money-touching claim about a sitting MP, so the **conditional top-signal Opus
trigger fired for the first time since it was armed in batch 002**. The verification pass
went past ARES to or.justice.cz's úplný výpis and to two notarial deeds in the sbírka
listin, returned **PARTIAL**, and corrected four material defects in the driver's reading:

1. **Registry dates are not legal-effect dates.** The akcionář entries carry an empty
   `clenstvi` object — the register records no vznik/zánik of the shareholding. **The
   acquisition date is not established** and must never be stated as 2025-10-15.
2. **The field is `Jediný akcionář`, not "akcionář"** — and per § 48 odst. 1 písm. k)
   zák. č. 304/2013 Sb. a shareholder is entered for an a.s. *only* where there is a
   single one. The true claim is **stronger** than the driver's: sole shareholder, 628 of
   628 shares. (The driver had also mis-cited § 12 ZOK as the registration duty.)
3. **Wilfried Reinhard Elbs, registered since 2026-02-20, is a TRUSTEE, not an owner** —
   `svěřenský správce` of RSVP TRUST (IČO 24099333); § 1448(3) obč. zák. puts trust
   property outside the trustee's ownership. Describing him as "the shareholder" would
   have been materially misleading.
4. **"Sitting MP" is the wrong frame** — and the weaker one. psp.cz records *poslanec od
   4. 10. 2025* **and *předseda vlády od 9. 12. 2025***. The conflict-of-interest rules in
   §§ 4b/4c zák. č. 159/2006 Sb. attach to a **member of government**, not to an MP.

The defensible statement, which is what was persisted:

> Obchodní rejstřík vede Ing. Andreje Babiše (nar. 2. 9. 1954) jako zapsaného **jediného
> akcionáře** společnosti AGROFERT, a.s., IČO 26185610, **od 15. října 2025 do 20. února
> 2026**; v notářském zápisu NZ 1292/2025 ze dne 15. října 2025 sám čestně prohlásil, že
> jediným akcionářem je. Od 9. prosince 2025 byl současně předsedou vlády. Zapsané datum
> není datem nabytí akcií.

Two things are explicitly **not** claimed, and are recorded as open questions on the edge:
the 2017 trust note was deleted **2024-12-02**, so the register leaves a ten-month gap it
does not explain; and the founder and beneficiaries of RSVP TRUST are **unverified**
(esf.justice.cz returned 404) — it must not be assumed that Babiš founded it.

**Persisted as a props-merge on the existing edge, `pending_review`, `review_state`
untouched.** The record also sets `tie_class_review_needed`: a registered sole-shareholder
period would reclassify the tie from `manager` to `owner-operator`, which changes
attribution — that decision belongs to the human reviewer, not to this loop.

## 5. Q-money-19 corrected — the two extinct IČOs are not an anomaly

Batch 009 flagged `25130072` and `60197773` as unresolvable and called them "likely
historical entities". Directionally right, but it treated them as a data-integrity
concern. The verification pass established the precise reason from the successor's
`ostatniSkutecnosti`: **both merged into AGROFERT, a.s. (26185610)** — 25130072 on
**2004-08-31**, 60197773 (together with AGROPROFIT) on **2005-06-30**. The ids are
extinct, not wrong, and the dataor slice that produced them was accurate.

A genuine reading trap was recorded on the successor node: **the same legal entity
26185610 was itself named "AGROFERT HOLDING, a.s." between 2004-08-31 and 2013-10-01**
(and "AGFTRADING, a.s." before that), so two different subjects carry that name in
different periods.

## 6. Live writes (pass 39)

| write | scope | result |
|---|---|---|
| Q-money-20 shareholder record | 1 `linked_to` props-merge (Babiš ↔ AGROFERT) | applied, with all four Opus corrections |
| Q-money-19 correction | 3 company nodes (2 extinct + successor name history) | applied |

**No `review_state` touched — 211 ties remain `pending_review`.**

**Pass-number note:** batch 009 stamped 34 and had to re-stamp when a sibling took 34/35
concurrently. This batch checked the log immediately before writing — 37 and 38 had been
taken by sibling sessions in the meantime — and stamped **39**. The lesson held.

## 7. Open items for batch 011

1. **Finish the sweep**: `steward` class (23 companies) and the remaining ownership
   parents are un-queried. `--resume` makes this cheap; the steward results are context,
   not attribution, and must be labelled as such on arrival.
2. **Read direction on the batch-009 parent leads.** The batch-009 script did not record
   publishers, so Lázně Luhačovice / Rybářství Třeboň / DEZA have contract counts but no
   payer breakdown. Re-query those 4 with the batch-010 script, which does.
3. **ČSOB and České dráhy remain UNMEASURED** (429 backoff exhausted in batch 009), as
   does anything the manager-class sweep failed. Never report them as zero.
4. **Q-money-20 follow-through**: the tie-class reclassification is queued for human
   review, not automated. Separately, AGROFERT's own contract exposure has never been
   swept — it is an MP-tied company and, on this record, was under the sole ownership of
   a sitting Prime Minister for part of the current term. That sweep is the obvious next
   query, and it must carry the §§ 4b/4c framing rather than an MP framing.
5. **The 2024-12-02 → 2025-10-15 gap** in the AGROFERT trust record is unexplained by the
   register; and RSVP TRUST's founder/beneficiaries are unverified. Both are open leads,
   not findings.
6. Q-money-13's 21 open residue items still belong to law (14) and effort (7).

## 8. Manifestation check (kernel step 6)

Batch 010 persisted a correction and one high-signal annotation; it created no new
reader-facing surface, and **the debt it names is now sharper**: the `/penize` tie list
shows a tie's role and review state, but nothing in the product would show a reader that
the Babiš↔AGROFERT tie carries a sole-shareholder period inside the current term — the
single most consequential fact this case has produced. The verification console is where
it belongs (it is the reviewer's evidence dossier), and rendering `shareholder_record`
there is the first genuinely build-ready increment the case has had in several batches.

Standing debt, unchanged: the `owns_stake` ownership layer still has no surface.

## 9. Lessons

1. **The armed trigger earned its keep on first use.** Four defects, every one of which
   would have shipped a wrong or misleading public claim about a named person — including
   one (`sitting MP` vs `předseda vlády`) that picked the legally *weaker* status, and one
   (Elbs as owner rather than trustee) that would have been simply false. Reserving
   maximum-depth verification for money-touching claims about real people is correct, and
   the trigger should stay armed rather than be spent routinely.
2. **A null in the right class is a headline.** 18/18 owner-operator companies with no
   public contracts is the strongest non-partisan result the case has produced, and it
   only became sayable once someone asked. Two prior batches reported nulls that were
   arithmetic; this one is measured.
3. **Classifiers that key on names encode a guess.** The name test worked on every obvious
   case and failed on the one that mattered most (largest CZK, publicly owned, private
   legal form). Where a registry publishes the structural fact — ownership — classify on
   that, and make the unknown case loud rather than convenient.
4. **Incremental persistence is a correctness property, not an optimisation.** Batch 009
   lost 8 completed network queries to a process kill and had to re-run them; the same
   sweep this batch survived a 500 and a rate-limit wall without losing a single answer.
