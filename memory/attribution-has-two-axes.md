---
name: attribution-has-two-axes
description: Whether money may be attributed to a politician needs BOTH the role (tie_class) and the company's ownership (public_mandate) — a municipal utility's turnover is not the MP's, whatever their role.
metadata:
  type: project
---

`tie_class` describes the **ROLE** — what the person does in the company. It cannot
describe **whose money it is**, and `classifyTie` cannot infer that: it reads a company
NAME and a role text, both correctly, and still concludes wrongly.

Money batch 015 measured the cost. Petr Hladík was genuinely `předseda představenstva` of
**Teplárny Brno a.s.** — so `manager` is the right role class — and the company is 100 %
owned by Statutární město Brno. **11,82 mld. CZK** of a municipal utility's turnover was
therefore rendered as money reaching a politician's firm, the largest figure on `/penize`.
Same for Výstaviště Flora Olomouc and Lesy města Olomouce; 12,75 mld. across the three.

**How to apply:**
- The rule is `tieIsAttributable()` in `features/money/reachableMoney.ts`, reading both
  axes. Never test `isAttributable(tieClass)` alone to decide what a surface renders.
- The mandate axis may only ever **REMOVE** attribution. A company the sweep has not
  reached is decided by the tie class alone.
- Publicly-owned money is **not deleted** — it moves to the `steward` bucket, which already
  means "the institution's own public activity". `totalCzk` is unchanged.
- `public_mandate*` is written on the COMPANY node (batch 015, pass 58) by
  `scripts/case-loops/money/public-mandate-sweep-b15.ts` via `lib/analysis/public-body.ts`
  (ARES basic for the legal form + ARES VR for owners). It never touches `tie_class` or
  `review_state`.
- Build a `ReachableTie` only with **`toReachableTie()`**. There were four hand-copied
  projections; the new axis reached one, and the headline silently did not move.
- **Silence in the register is not evidence.** VR lists shareholders for an `a.s.` only in
  special circumstances, so "no owner named" is the normal case, not a private-ownership
  finding — 49 of 52 `private` verdicts (18,05 mld., 98 % of the headline) were made of it.
  That state is `ownership-not-published`, still attributable, and disclosed on the surface.
  `ownershipRecord()` counts natural persons so "no PUBLIC owner among recorded owners"
  stays distinguishable from "no owner recorded" (AGROFERT's only current akcionář is a
  natural person).
- Largest open question: **Pražská energetika, 10,95 mld.**, city-owned through a holding
  that VR does not name — a depth-2 ownership check is not yet implemented.

Related: [[supplies-is-not-attribution]], [[or-shareholder-entry-semantics]].
