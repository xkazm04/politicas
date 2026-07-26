---
date: 2026-07-26
slug: money-tie-mapper-dedup
status: shipped
branch: "(committed to master)"
commits: [8dddf90]
type: weak-pattern
reach: "3 loader files / ~75 duplicated mapping lines / 3 duplicate type declarations"
risk: 2
effort: m
payoff: 3
related_scan: "[[Architect/scans/2026-07-26-data-loading-boundary]]"
---

# One mapper for the money tie

## Context
The same `kg_edge` `linked_to` row is mapped to a domain object in three places:
`getMoneyData.ts:72-116` → `MoneyTie`, `getMpDetail.ts:53-96` → `MoneyTieDetail`
(near-verbatim 25-line copy), `getVerificationData.ts` → `ReviewTie` (~18 overlapping
fields). `moneyLoader.ts` was created to stop exactly this drift and succeeded for
*fetching* but the *mapping* was copy-pasted anyway. `ReviewState` is declared twice
(`moneyTypes.ts:15`, `reviewTypes.ts:16`) — two lines above a re-export comment
explaining why duplication is bad; `Corroboration` three times. Any new tie prop must be
added in three files, on the app's highest-stakes surface (human-gated corruption claims).

## Decision
Host a single `mapLinkedToTie(edge, company, contracts)` in `features/money/reviewTypes.ts`
(already the shared-logic home) returning the superset type; derive `MoneyTie` /
`MoneyTieDetail` / `ReviewTie` from it (Pick/extend). Collapse `ReviewState` and
`Corroboration` to one declaration each.

## Rollout (as executed, 2026-07-26)
1. 8dddf90 — `mapLinkedToTie()` in `moneyLoader.ts` (not reviewTypes.ts as the stub
   proposed: moneyLoader is already the declared "single place that fetches it" and
   both consumers import it, so mapping joins fetching there; reviewTypes stays the
   pure-classifier module it advertises). Both call sites collapsed — the case file
   spreads the result and appends its contract lines. `ReviewState` collapsed to one
   declaration (re-exported from reviewTypes, matching the TieClass rule beside it).
   Net −144/+93 lines. `npm run check` green (36 files / 347 tests).

   Verified against the LIVE store, not just types: ledger vs case-file agree on all
   32 shared fields for the top MP's ties (0 mismatches); 211 ties / 63 MPs /
   18.7 bn CZK reachable unchanged.

## Deliberately NOT unified
`ReviewTie` (getVerificationData) shares ~18 field names but is a different
PROJECTION — it carries reviewer identity (`id`/`src`/`dst`/`pspId`/`mpName`/`club`),
parsed `periodFrom`/`periodTo`, and `links: RegistryLinks`, while omitting the
ledger's review-audit fields. Forcing one type would couple the console's write path
to the ledger's read shape. Its duplication is field NAMES, not copy-pasted mapping
logic — the actual hazard this ADR removed.

## Acceptance criteria
- [x] Adding a tie prop touches exactly one mapping site (for the two surfaces that
      shared an identical projection).
