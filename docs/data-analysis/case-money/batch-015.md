# Money batch 015 — whose money is it? The second axis of attribution

Case ① FollowTheMoney · 2026-08-22 · **pass 58**.

> Batch 014 removed 11,77 mld. of contracts the register hands to somebody else, and left
> Teplárny Brno a.s. as the largest attributable figure on the surface: **11,82 mld. CZK**,
> a company 100 % owned by Statutární město Brno, on whose board Petr Hladík sat. This
> batch asks the question that number begs — *whose money is it?* — and finds the platform
> had no way to ask it.

## 1. The tool existed. It had never been pointed at this population.

`lib/analysis/public-body.ts` was built in batch 010 for exactly this: an ownership-based
public-body test, because a NAME-based one had missed a kraj-owned company under an
ordinary `a.s.` form. It was then run over **four ownership parents** and stopped. The 57
companies whose money the platform attributes to named politicians were never put through
it.

`classifyTie` cannot answer the question by construction: it reads a company NAME
("Teplárny Brno" carries no public marker) and a role text ("předseda představenstva" →
`manager`). Both readings are correct. The conclusion drawn from them was not.

## 2. Two axes, and why `tie_class` was left alone

```
tie_class      — the ROLE:    what the person does in the company.
public mandate — the COMPANY: whose money it is.
```

Hladík really was chairman of the board; the role class is right. What was wrong is reading
a municipal utility's turnover as money reaching a politician. Conflating the two axes is
how the heuristic got here, so the sweep writes a **separate, additive `public_mandate`
annotation on the company node** and does not touch `tie_class` (nor, of course,
`review_state`).

`tieIsAttributable` is the rule, and the mandate axis may only ever REMOVE attribution:

| verdict | companies | CZK | attributable |
|---|---|---|---|
| publicly-owned | **3** | **12 753 808 645** | **no** |
| private (evidenced) | 5 | 330 396 336 | yes |
| ownership-not-published | 47 | 18 036 352 065 | yes, **unverified** |
| unknown | 1 | 1 791 100 | yes |

The three: **Teplárny Brno a.s.** (Statutární město Brno), **Výstaviště Flora Olomouc a.s.**
and **Lesy města Olomouce a.s.** (both Statutární město Olomouc). Their money is not
deleted — it moves to the **steward** bucket, which already means "the institution's own
public activity, never the MP's enrichment". `totalCzk` is unchanged.

**`/penize` headline: 31 122 348 145 → 18 368 539 501 CZK (−12,75 mld.).**

## 3. The bigger finding: 98 % of what remains is not evidence

Running the classifier over a real population exposed a flaw in the classifier itself.
Its `private` branch was reached whenever VR returned a record with no current legal-person
shareholder — and **for an akciová společnost that is the normal case**, because VR lists
shareholders only in special circumstances.

Measured: **49 of 52 `private` verdicts — 18,05 mld. CZK, 98 % of the attributable money —
rested on that silence.** Top of the list is Pražská energetika a.s. (10,95 mld.), whose VR
record names no shareholder at all while the company is city-owned through a holding.

The module's own doctrine — *absence of data is not evidence* — was enforced for a VR
record that could not be FETCHED, and not for one that came back empty. So:

- `ownershipRecord()` now also counts **natural persons**, which `shareholdersFromVr`
  drops by design. Without that count, "no public owner among recorded owners" is
  indistinguishable from "no owners recorded" — and AGROFERT a.s., whose only current
  akcionář in VR is a natural person, would have been filed as unverified.
- A new verdict **`ownership-not-published`** replaces `private` for that state. It stays
  `attributable: true`: silence is not evidence of PUBLIC ownership either, and withdrawing
  18 mld. on an absence would be the same error pointed the other way. It marks the figure
  as unverified so the surface can say so.

`/penize`'s reach tile now carries three caveats, each a different direction:
what is **outside** the total (contracts the register hands to another party), what is
**inside and over-counted** (several named recipients, no stated split), and what the
number **does not rest on** (47 firms / 18,04 mld. with no owner named in the register).

## 4. The surface may not contradict the token it renders

`/penize/firma/<ico>`'s steward sentence reads „všechny zdejší vazby jsou dozorčí nebo
správní funkce". For Teplárny Brno that is now **false** — the tie is `předseda
představenstva`, and ownership is what moved it. When the mandate decided, the page prints
the registry's own reason and names the public owner beneath it, instead of a role-based
sentence its neighbouring row falsifies.

## 5. One projection, because there were four

`ReachableTie` was built by hand at four call sites. Adding the second axis to the rule
changed three of them not at all — the corpus headline kept attributing 12,75 mld. for as
long as it took to notice the field was being dropped in the projection. `toReachableTie()`
is now the only way to build one.

## 6. Gate

`npm run check` green — **2 968 tests** (+9), 0 lint errors; production build compiles.

Live-store verification passed through `getMoneyData()` itself: headline **18 368 539 501
CZK**, the three publicly-owned companies carrying `attributable=false` with their named
owners. It took a store restore to get there — see §7, now CLOSED.

## 7. Incident (CLOSED) — the live store stopped opening

After pass 58 was written and verified, `./.pglite` began aborting at open
(`RuntimeError: Aborted()` at PGlite's `callMain` — the WASM postgres failing to START, not
a query failing). Established, in order:

- **PGlite itself is healthy**: `.pglite-backup-20260822-pass58` opens and reads fine.
- **The tests are not implicated**: `lib/testing/loaders.test.ts` seeds an isolated
  `mkdtemp` dir and never points at `./.pglite`.
- **Not memory**: 26 GB free.
- **`mv .pglite` fails with Permission denied** — which, per
  [[held-store-mimics-corruption]], IS the holder check firing and must never be worked
  around. A byte copy of a held store is torn by construction, so the copy also aborting
  proves nothing either way.
- **The holder is an orphan**: three processes running `scripts/tmp-inventory.ts` since
  13:01 (~7 h). **That file does not exist in the tree** — it was a temp script, deleted,
  whose process was never stopped. It is not another session's live work.

~~The suspected trigger is `npm run build`, which prerenders routes from several workers
that each open the single-connection store while the orphan held a handle.~~
**REFUTED by batch 016** (2026-08-22, same day): tested deliberately on a copy, the build
completes and leaves the store undamaged, and two concurrent openers both succeed.
Concurrent LARGE reads do fail — loudly, with `invalid memory alloc request size` — and
still leave no damage. **What broke the store is unknown**, and this record no longer names
a cause it cannot support.

**Resolved, losslessly.** With the user's go-ahead the orphan was stopped — and the store
STILL aborted, which is what finally separated "held" from "damaged": the holder check had
been telling the truth about a handle while the data was independently broken. The damaged
dir is preserved at `.pglite-damaged-20260822` (not deleted), `.pglite-backup-20260822-pass58`
was restored, and pass 58 was replayed from its committed payload. Verified after:
passes 56/57 intact (6 251 non-recipient · 3 495 payer · 1 058 shared), pass 58 back on 56
companies, and every rendered figure identical to the pre-incident run.

Total data loss: **none** — because every write this case makes is a committed, gated
payload precisely so a restore is a replay ([[live-store-can-be-restored-under-you]]).

## 8. Lessons

1. **A tool is only as good as the population it was run on.** The ownership classifier had
   existed for five batches, was correct, was tested — and had never been pointed at the 57
   companies whose money the platform actually publishes. Building the right check and
   running it on four rows is not the same as having the check.
2. **Running a classifier on a real population is how you audit the classifier.** The
   sweep's purpose was to classify 57 companies; its most valuable output was discovering
   that 49 of its own `private` verdicts were made of silence. A verdict distribution that
   looks too clean is a finding about the verdict function.
3. **A module's doctrine has to be enforced at every branch that can reach it.** "Absence of
   data is not evidence" was written at the top of `public-body.ts` and enforced on one of
   the two paths where absence occurs.
4. **Four hand-copied projections is three chances to drop a new field**, and the drop is
   silent — the headline simply did not move. The fix is one constructor, not more care.
5. **A number that moves must say why, and the sentence next to it must still be true.**
   Moving 12,75 mld. into the steward bucket made an existing, correct-until-today
   explanatory sentence into a false one.
6. **"Held" and "damaged" are not exclusive, and the holder check cannot tell them apart.**
   [[held-store-mimics-corruption]] is right that a Permission-denied rename is the holder
   check firing and must not be worked around — but here BOTH were true at once: an orphan
   held a handle AND the data was broken. Stopping the holder is what made the question
   answerable, not what answered it. The protocol should be: find the holder, resolve it,
   THEN re-test at rest — never infer "therefore not corrupt" from the presence of a holder.
7. **The recovery cost nothing because of a discipline paid for earlier.** Restoring a
   1,5 GB store lost zero analytical work, because passes are committed payloads replayed
   by one script. That is the whole return on the "vault first, graph second" rule.
