---
name: kg-has-no-source-urls
description: kg_node/kg_edge store provenance but no external URLs — official-source links are rebuilt from stable ids in lib/kg/sourceLinks.ts.
metadata: 
  node_type: memory
  type: project
  originSessionId: 1c9c34d2-915c-40e2-83b4-1fc1a71eda67
  modified: 2026-07-26T11:54:51.755Z
---

`kg_node` / `kg_edge` carry `provenance = {pass, method, ref, computedAt}` —
which is *our* record of how a row was computed, **not** a citation of the
outside world. **No node or edge stores an external URL.** (The raw entity
tables do have `source` / `source_url`; the derived graph drops them.)

So "every item is officially sourced" is delivered by rebuilding links from the
stable identifier each kind already stores — `lib/kg/sourceLinks.ts`, keyed off
`pspId`, `ico`, `cislo`, `ref`. Two rules encoded there:

- A link is built **only** from a stored id, never guessed from a name.
- `tier` separates `detail` (canonical page for that entity) from `search`
  (a registry query, which claims only "look here"). Collapsing the two turns
  a search into a citation.

Verified by fetching, 2026-07-26:
- `psp.cz/sqw/detail.sqw?id=<pspId>` — **works**, canonical MP page.
- `psp.cz/sqw/organy.sqw?o=10&k=<id>` — **only a directory** of all committees,
  not one organ. Parties and organs therefore get no link on purpose.
- `psp.cz/sqw/historie.sqw?o=10&t=<cislo>` — bill page, already used repo-wide.
- `e-sbirka.cz` 308-redirects to `e-sbirka.gov.cz`; use the gov.cz host.

Genuinely unciteable: `bloc` and `theme` (analytical constructs, no registry
exists). `notice` has a source URL in the kiosek JSON-LD but **ingest drops it**
(`lib/ingest/sources/kiosek.ts`) — a fixable upstream gap, not a property of the
entity, so don't reconstruct it.

**Why:** the instinct is to look for a `url` column, not find one, and either
invent a URL pattern or silently show nothing. Both are wrong for this product.
Related: [[evidence-citation-doctrine]].
