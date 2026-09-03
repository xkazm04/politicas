---
subject: civic-intelligence/civic-knowledge-graphs
project: politicas
raised_by: intake intake-lightrag-0902 (peer comparison)
source: librarian/sources/2026-09-02-lightrag.md
stage: node/edge write path — above every kg writer, beside the kind/rel enums in lib/analysis/kg-verdict.ts
size: 3 files / ~180 lines / S-M
status: proposed
---

## Why the scope implies it

`scope.does` opens with *"five civic modules over one shared entity graph"*. The word doing the work
is **one**. A shared graph is shared only insofar as two writers that mean the same entity produce
the same id — and in this repo the id grammar is a convention re-spelled at each site, not a
definition imported from one place. `lib/analysis/kg-money.ts:83` is
`companyUrn = (ico: string) => \`company:ico:${ico}\`` — it accepts any string and pads nothing;
`lib/ingest/sources/kiosek.ts:483` builds the same shape inline as
`` companyUrn: `company:ico:${ico}` ``; `lib/analysis/volby/rules.ts:129` declares its own
`authorityId = (ico) => \`company:ico:${ico}\``; and `lib/ingest/changeEvents.ts:147` parses the
segment back out. Four authorities for one vocabulary.

The cost has already been paid once, and it was measured, not feared.
`scripts/case-loops/money/canonicalize-ico-nodes.ts:3-19` records it: a Czech IČO is always eight
digits and 207 of 215 company nodes were canonical, but eight were not —
`company:ico:11835`, `:1350`, `:254843`, `:274046` and four more. The consequences it names are
exactly the two a shared graph cannot tolerate: *"**A split identity.** `company:ico:2867681` (IF
Holding a.s.) DUPLICATES the canonical `company:ico:02867681`, which is MP-tied via `linked_to`"*
(`:13-17`), and *"**Every future IČO join against these 8 is a guaranteed false negative**"*
(`:19`). The script repaired the eight. Nothing prevents the ninth.

`civic-knowledge-graphs` § "The graph is grown, not designed once" asks for *"a small, closed,
versioned vocabulary of node kinds and edge relations, held in exactly one machine-enforced
definition that every writer, validator and view imports"*, and `civic-entity-ontology` extends that
to **id schemes**. `politicas` already has the first half and is exemplary at it —
`KG_NODE_KINDS` (`lib/analysis/kg-verdict.ts:24`) and `KG_EDGE_RELS` (`:27-67`) are single-sourced,
enum-checked at the gate (`:271`, `:282`) and deny-by-default at promotion
(`scripts/data-analysis/kg-promote.ts:90-93`). The **id grammar** for those same kinds lives only in
prose, in `docs/data-analysis/graph-schema.md:36-45`.

The peer sharpened this rather than supplying it. LightRAG's node key is the model's own output
string (`lightrag/operate.py:724`) — the identity regime this project's golden path names as failure
mode #1, and nothing here should adopt it. But LightRAG passes **every** writer through exactly one
normaliser (`lightrag/utils.py:5391-5393`) and one length/byte clamp (`operate.py:209-246`, applied
at six call sites), so its identity contract, however weak, has a single door. A registry join
removes homonym risk and introduces *normalisation* risk in its place; a project that has taken on
the stricter identity regime should not have the looser funnel.

## What the first context contains

The module is a small pure one — `lib/kg/entityId.ts` — imported by every writer, the verdict gate,
and the two link-minting owners.

**It contains:**
- One `EntityIdGrammar` record, keyed by `KgNodeKind`, declaring per kind: the prefix, the segment
  shape, and the canonical form of the tail. `company` → `company:ico:<8 digits, zero-padded>`;
  `person`/`organ` → `psp:<table>:<digits, unpadded>`; `contract` → `contract:<idSmlouvy digits>`;
  `law` → `law:sb:<n>-<rok>`; `bill` → `bill:tisk:<digits>`; `bloc`/`theme` → `<kind>:<kebab slug>`.
  Sourced from `docs/data-analysis/graph-schema.md:36-45`, which becomes the document *generated
  from* this record rather than the place it is written down.
- `entityId(kind, ...parts): string` — the single minting function, which **canonicalises** (the
  eight-digit pad is applied here, once) and throws on a tail that cannot be canonicalised.
- `parseEntityId(id): {kind, parts} | null` — the single reading function, replacing the ad-hoc
  segment splits in `lib/ingest/changeEvents.ts:147` and `features/money/companyId.ts`.
- `isCanonicalEntityId(id, kind?): boolean` — the predicate the gate and the audit both use.

**Its boundary — what it must NOT absorb:**
- **Not the kind/rel vocabulary.** `KG_NODE_KINDS` / `KG_EDGE_RELS` stay in
  `lib/analysis/kg-verdict.ts`; this module *imports* the kind type and adds a grammar per kind. Two
  modules, one direction of dependency, no cycle.
- **Not entity resolution.** Deciding *which* IČO a name refers to is `reconcile-ares-vr.ts`'s job
  and stays gated and human-reviewed. This module only says whether a given id is well-formed.
- **Not external URL construction.** `lib/kg/sourceLinks.ts` owns that and its three rules stay
  intact — in particular *"a link is built only from a stored identifier, never guessed from a
  name"*. This module is upstream of it.
- **Not a migration.** Repairing existing malformed ids is `canonicalize-ico-nodes.ts`'s job, already
  written. This module prevents the next one.
- **Not a runtime cost.** It is pure string work with no I/O, so it can sit inside
  `validateKgVerdict` (a check that every declared node id and every edge endpoint is canonical for
  its kind) without changing that function's dependency-free character.

The audit half — a read-only census of every `kg_node.id` and every `kg_edge.src`/`dst` against the
grammar — reuses the shape of `canonicalize-ico-nodes.ts`'s own reporting half and runs over a
`.pglite` copy, per the single-connection rule.

## The measurable

**Primary: ids in the live store that do not parse under their kind's grammar.** Today that number
is unknown for every kind except `company` (where it was 8 of 215 in batch 009 and is presumed 0
after the repair). The direction has paid off when the census is run, the number is published in
`docs/data-analysis/graph-schema.md`, and it is **0 and held at 0 by the gate** — i.e. a subsequent
verdict or writer that would mint a ninth is refused before it writes, not repaired afterwards by a
one-off script.

**Secondary, and the one that matters to a reader:** *dangling edge endpoints* — edges whose `src`
or `dst` matches no `kg_node.id`. The sentinel's `orphan-edges` invariant
(`lib/testing/sentinel/invariants.ts:164`) already counts these; the census separates the two causes
that number currently mixes — an endpoint that is *missing* from an endpoint that is *misspelt*.
A misspelt endpoint is a silent coverage hole exactly like the eight IČOs, and today nothing
distinguishes it.

**Falsifiable in a single afternoon** by test **T3** in the study: run the census before writing any
enforcement. If it returns 0 across all eleven kinds, the proposal shrinks from a repair to a guard
and its size drops from M to S — still worth it, but the urgency argument goes away and the owner
should know that before approving.

## What would make this wrong

- **The census returns 0 and the grammar turns out to be genuinely uniform per kind.** Then the
  convention has held for eleven kinds and twenty rels without a door, and the eight IČOs were a
  one-off caused by an upstream feed rather than by the missing funnel. Declining on that evidence is
  correct; the study's answer is that a convention holding so far is not the same as a convention
  being enforced, but that is a judgement the owner makes, not a fact.
- **The grammar is not actually closed.** If any kind's id legitimately admits more than one shape —
  a company known only by a foreign registration number, a law cited in two citation styles — then a
  single canonical form is the wrong model, and forcing one would either reject real entities or
  invent a canonicalisation the source does not support. The right answer then is a per-kind
  *validator* that admits a set, not a *minter* that produces one; the module survives, its
  `entityId()` half does not.
- **It makes the gate reject work that is correct.** `validateKgVerdict` is deliberately
  dependency-free and total; adding a grammar check adds a way for a well-formed, truthful verdict to
  be discarded over a formatting detail the subagent cannot see. If the loop starts losing verdicts
  to this, the check belongs in `kg-promote` (which already refuses per-kind and per-rel) rather than
  in the shared gate, and the proposal should be re-scoped rather than reverted.
- **The `psp:*` ids turn out to need padding too.** The grammar record above asserts they do not,
  from `graph-schema.md:36-45` and from `ENTITY_URN = /\bpsp:[a-z_]+:\d+\b/g`
  (`lib/analysis/kg-verdict.ts:85`), which is unpadded. If a psp feed ever emits a zero-padded person
  id, this module would canonicalise it away and break the prose sweep. Verify against a live census
  of `person.id` before shipping.
