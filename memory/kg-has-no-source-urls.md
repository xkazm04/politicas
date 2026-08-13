---
name: kg-has-no-source-urls
description: provenance ≠ citation — links are rebuilt from stable ids in lib/kg/sourceLinks.ts, EXCEPT contract and notice nodes, which store their own canonical URL in props (sourceUrl / postingId).
metadata: 
  node_type: memory
  type: project
  originSessionId: 1c9c34d2-915c-40e2-83b4-1fc1a71eda67
  modified: 2026-07-26T11:54:51.755Z
---

`kg_node` / `kg_edge` carry `provenance = {pass, method, ref, computedAt}` —
which is *our* record of how a row was computed, **not** a citation of the
outside world. There is **no `source_url` COLUMN** on either table. (The raw
entity tables do have `source` / `source_url`; the derived graph drops them.)

**CORRECTED 2026-08-13 — two node kinds DO store their own URL, inside `props`.**
The original claim was "no node or edge stores an external URL", and it drove
two kinds into silence they did not deserve:

- `contract` — `props.sourceUrl` is the dump's own `<odkaz>`, written by
  `scripts/case-loops/money/persist-contract-harvest.ts:145`. So a contract
  cites **itself** at `tier: "detail"`. Do **not** rebuild it from the node id:
  `/smlouva/<n>` is `idVerze`, the node is keyed on `idSmlouvy` (see
  [[registr-smluv-token-free-access]] — "THE TRAP").
- `notice` — `props.postingId` is the posting's own `infodeska.gov.cz` address.
  `lib/ingest/sources/kiosek.ts:100-106` makes that URL the posting id
  (deliberately not `iri`, whose `data.justice.cz` host is dead) and
  `scripts/case-loops/sources/kiosek-build-payload.ts:79` carries it onto the
  node — **20/20** notice nodes in `docs/data-analysis/case-sources/kiosek-payload.json`.

The rule that survives is the *shape* of the lookup, not the pessimism: **ask
the node's props first, rebuild from the stored id second, guess never.**

So "every item is officially sourced" is delivered by rebuilding links from the
stable identifier each kind already stores — `lib/kg/sourceLinks.ts`, keyed off
`pspId`, `ico`, `cislo`, `ref`. Three rules encoded there:

- A link is built **only** from a stored identifier (a stored URL counts, and
  wins), never guessed from a name or a "probably like this" pattern.
- `tier` separates `detail` (canonical page for that entity) from `search`
  (a registry query, which claims only "look here"). Collapsing the two turns
  a search into a citation. Test for `detail`: does the address name the
  entity, or does it *filter a list*? `ares.gov.cz/ekonomicke-subjekty?ico=`
  and `or.justice.cz/ias/ui/rejstrik-$firma?ico=` are filters and are `search`
  (both shipped as `detail` until 2026-08-13).
- `registry` renders **literally** as a proper name, so it must name the host
  the link actually reaches. `"Registr smluv"` over a `hlidacstatu.cz` address
  promised the state register and delivered a private aggregator.

Verified by fetching, 2026-07-26:
- `psp.cz/sqw/detail.sqw?id=<pspId>` — **works**, canonical MP page.
- `psp.cz/sqw/organy.sqw?o=10&k=<id>` — **only a directory** of all committees,
  not one organ. Parties and organs therefore get no link on purpose.
- `psp.cz/sqw/historie.sqw?o=10&t=<cislo>` — bill page, already used repo-wide.
- `e-sbirka.cz` 308-redirects to `e-sbirka.gov.cz`; use the gov.cz host.

Genuinely unciteable: `bloc` and `theme` (analytical constructs, no registry
exists), plus `party` / `organ` (psp.cz publishes only a directory).

Still open, recorded in the module header: bill links hardcode `o=10`, and the
bill node carries **no term field at all**. Tisk numbers restart each term, so
after the next term's ingest those citations resolve to a *live psp.cz page
about a different bill* — not a 404. The fix is an ingest change (write a
`term` prop in `kg-legislation-ingest.ts`), not a render change.

**Why:** the instinct is to look for a `url` column, not find one, and either
invent a URL pattern or silently show nothing. Both are wrong for this product —
and "not find one" was itself wrong twice, because the URL was in `props`.
Related: [[evidence-citation-doctrine]], [[registr-smluv-token-free-access]].
