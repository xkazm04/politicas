# Cluster: committee jurisdiction (F12) + money-graph wiring (F6/F15)

Pass 8, 2026-07-23. Closes **F12**, **wires but cannot populate F6**, and pins down
exactly what **F15** needs. See [[graph-schema]], [[graph-log]].

## F12 — committee → theme ownership (DONE, gated verdict)

A gated Sonnet verdict mapped the 33 PSP10 committees to the 13 themes they hold
jurisdiction over → **27 `owns` edges** (new relation; organ → theme). Committee names
and themes are real graph nodes; the mapping is each committee's actual remit, gated
against real ids (`.kg-analysis/verdicts/F12.json`, promoted pass 8).

- **11 of 13 themes get a committee owner.** `oversight-interpellations` is densest — 7
  committees (KV, PV + the standing intelligence/security-oversight commissions SKHH/
  SKBIS/SKFAÚ/SKNÚKIB + the ad-hoc Dozimetr inquiry) — reflecting how much dedicated
  control machinery the chamber runs.
- **2 themes have NO committee owner** — `government-confidence` and `state-honours-symbolic`
  are plenary acts, not delegated to committee (an honest structural gap, not a miss).
- **4 committees have no matching theme** — VO (defence), ZAV (foreign), VVVMS (education/
  science), VB (security): the F2 theme taxonomy (built from the 47 head *vote* subjects)
  simply doesn't cover those domains. Spawned a taxonomy-gap frontier item.

Closes the vote → theme → committee chain: a citizen can now trace a roll call to its
subject to the committee that shaped it. Feeds LawWatch (auto-route bills to gestor
committees) and CivicScore (an oversight-cluster activity score).

> **UPDATE 2026-07-24 — F6 IS NOW POPULATED.** The three feeds below were ingested (Hlídač
> státu proxies Registr smluv + ARES; the MP↔company link uses Hlídač `/osoby` private-role
> events, bridged to psp ids by name+birthdate). The graph now holds **196 `company` + 2 287
> `contract` nodes, 260 `linked_to` (all `pending_review`) + 2 290 `supplies` edges** (pass 10,
> deterministic). The gate held exactly as designed — every person↔company edge is
> `pending_review`, none auto-verified. The section below is the pre-population record.
> See [[graph-schema]], [[coverage-ledger]], [[feature-opportunities]] O2.

## F6 — the money graph is WIRED but cannot be populated here (honest — pre-2026-07-24)

The FollowTheMoney pipeline (`MP —linked_to→ Company —supplies→ Contract`) is now a
real, unit-tested computation — **`lib/analysis/kg-money.ts`** (`buildMoneyGraph` +
`moneyTrails`, 6 tests). It encodes the design's methodology exactly: the **IČO join**
(contract.supplierIco → ARES company → linked MPs) plus the **human gate** — every
`linked_to` edge carries a `review_state` (`verified` / `pending_review`), because an
automated match is a *lead*, never a published fact about a real politician.

**It emits nothing, on purpose.** Three data feeds are absent from this environment and
cannot be faked (`§11: don't fake it`; these are accusatory edges about real people):
1. **Registr smluv** — the public-contracts dumps (supplier IČO + amount). The
   `smlouvy-dump-watch` Pumper app surfaces them, but no ingest adapter + no file here.
2. **ARES / obchodní rejstřík** — IČO → company (+ officer records).
3. **The MP↔company linkage** — the *hard, sensitive* part: conflict-of-interest / asset
   declarations (159/2006, via the CRO register) or OR officer matches. Without a
   declared source this link cannot be made honestly — name similarity alone is not enough.

So F6 moves from *"no adapter"* to **"join + gate BUILT; blocked only on the three data
feeds"**. The node/edge kinds (`company`/`contract`, `linked_to`/`supplies`) are in the
schema; `kg-money.ts` turns typed feeds into gated edges the moment they exist.

## F15 — formal bill → committee (DONE, pass 12, deterministic)

> **UPDATE 2026-07-24 — F15 IS NOW POPULATED.** F12's `owns` mapping is committee *remit*
> (name-based, gated). The *formal* per-bill assignment — which výbor a specific tisk was
> `přikázán` to — lives in `tisky.zip` → **`hist_vybory.unl`** (the "přikázání tisku
> výborům" table; psp.cz open-data k=1303), joined to `hist.unl` for the assignment date.
> A new deterministic parser (`parseCommitteeAssignments` in `psp-legislation.ts`) collapses
> the event rows to one assignment per (tisk, committee) and `da:kg-routing` materialized
> **150 `assigned_to` edges** (bill → organ), props `{role: garanční|další, status:
> přikázáno|navrženo|iniciativně, assignedOn}`, provenance `pass 12 · deterministic · F15`.

**131 of 141 bills are formally routed** (133 garanční + 17 další committee assignments); the
**10 unrouted** bills (tisky 43143, 43354, 43360, 43365, 43366, 43370, 43372, 43379, 43382,
43383) are prints not yet proposed for assignment in a term opened 2025-10-04 — an honest
structural gap, not a miss. Status is recorded per edge (86 navrženo / 63 přikázáno / 1
iniciativně) so a consumer can restrict to House-confirmed assignments. Concentration is where
you'd expect: **ÚPV (justice) 31 garanční, RV (budget) 26, HV (economy) 19.**

**Formal routing vs the heuristic `owns` — they agree, and the one disagreement is F12's own
declared gap.** Of the 12 committees that receive at least one *garanční* bill, **11 also carry
an F12 `owns` remit**. The single exception is **VVVMS** (education/science), which formally
takes 4 garanční bills yet has no `owns` edge — because it is one of the exact **4 committees
F12 flagged as having no matching theme** (the F2 taxonomy, built from the 47 head vote
subjects, doesn't cover education/science/defence/foreign). So the formal per-bill routing
independently *confirms* F12's honest taxonomy gap rather than contradicting the remit mapping.
The `owns` heuristic was right about who owns what; F15 now pins it to the specific tisk.
Feeds LawWatch (route a bill to its gestor committee) off real assignment, not name matching.
