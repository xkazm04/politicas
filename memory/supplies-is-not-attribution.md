---
name: supplies-is-not-attribution
description: A `supplies` edge means "party to the contract", not "received the money" — Registr smluv names a recipient on multi-party records and it is often somebody else.
metadata:
  type: project
---

`company --supplies--> contract` records that the company is a **contracting party**. It
does NOT mean the money reached that company, and on multi-party records the register
usually says who it did reach: `<smluvniStrana>` carries optional `<prijemce>` /
`<platce>` flags.

Money batch 014 measured the gap: **11 771 399 785 CZK — 27,44 % of `/penize`'s
attributable headline** — sat on contracts where the register explicitly flags a
different party as `prijemce`. **99,9 % of it was one company** (Teplárny Brno a.s., a
co-signatory to the Brno multifunctional hall alongside HOCHTIEF and to four tram-Plotní
agreements alongside IMOS/STRABAG), and through it one named MP.

**Why:** the flags are optional and roughly half of records omit them, so `directionFor`
answered `unknown` for anything its two-party shortcut could not settle — collapsing *the
register said nothing* into the same token as *the register spoke and did not name us*.

**How to apply:**
- Reach is decided by `moneyReachesCompany` in `features/money/reachableMoney.ts` — the
  ONE predicate. Import it; never re-test `direction` inline. It excludes `non-recipient`
  and `payer`, and deliberately keeps `unknown`, because reading silence as a negative is
  the mirror of the original bug and would strip real suppliers of real money.
- The edge is never deleted for this — the relation is true, only the attribution was
  false. Excluded value goes to `CompanyContracts.excluded` and the surface prints it.
- `co-recipient` (several flagged recipients, no split stated anywhere) stays in the
  total, carries `recipients_shared`, and is disclosed. Dropping it understates exactly
  as badly as counting it whole overstates.
- A caveat must be scoped to the SAME population as the figure it qualifies. Computing
  these over all tied companies instead of the attributable ones would have printed
  29,09 mld. beside a 31,12 mld. headline.
- The stored `contract.props.parties` is `smluvniStrany` only — the publisher's flags were
  not retained. Feeding it to `directionFromParties` raw makes a three-sided record look
  two-sided and the shortcut then answers `payer` where the truth is `non-recipient`
  (it moved 101 of 128 edges on first try). Re-attach the publisher as an unflagged party.

See [[kg-upsert-replaces-props]], [[ico-node-id-canonical-form]],
[[registr-smluv-token-free-access]].
