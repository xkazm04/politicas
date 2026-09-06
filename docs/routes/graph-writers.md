# Graph writers — reset/merge safety

## Current contract

**Not a route** — the offline writers under `scripts/data-analysis/` that every
route's data rests on: `kg-compute.ts`, `kg-promote.ts`,
`kg-contribution-ingest.ts`, `kg-contribution-recompute.ts` and their siblings,
run via the `da:*` npm scripts.

**Why the guards exist.** `upsertKgNodes` does `props = excluded.props` — a
WHOLESALE REPLACE — so a writer that builds props from scratch **erases every
other pass's layer on that node**. Four writers adopt an explicit read-merge
because of it; `mergeComputedNodeProps` (`lib/analysis/kg.ts`) is the shared
idiom, and it carries `firstSeenPass` through from the stored node while
deliberately RE-STAMPING `provenance` (it dates the numbers in `props`, so
freezing it would be a false vintage).

**The three standing guards:**

| Guard | What it refuses |
| --- | --- |
| `guardKgReset` | A `--reset` that would delete more than the run re-emits. It compares what the store ACTUALLY holds against what the run ACTUALLY emits — never a hardcoded list — names the casualties, and prints the verdict on every dry run |
| `CASE_OWNED_NODE_KINDS` (`kg-promote`) | A node of a kind this path has never legitimately written; derived as the enum MINUS `bloc`/`theme`, so a kind added to the enum is refused by default. A refused node never joins `kgResident`, so no edge can come to rest on it |
| `guardContributionWrite` | A `--commit` over a node whose stored `contribution_provenance.ref` differs from the ref being stamped. The rule is EQUALITY, not lineage ordering — `pass` cannot rank two formulas |

`--supersede` is the deliberate human override for the contribution guards; a
dry run is never blocked and always prints the verdict.

**Standing rules.** `--commit --reset` is **not** routine maintenance — the
frontier note and the knowledge-graph skill that said so are corrected. Take the
next pass number from `nextPass()`; the `Math.max(0, ...nodes.map(...))` spread
throws `RangeError` on ~154 k nodes and must not return. The recompute owns
`contribution_psp9`; the ingest states on every commit that it does not touch
it. `contribution-legacy.ts` is FROZEN with literal constants on purpose: a
proof gate that follows the formula it is proving proves nothing. And a sample
builder must never mint an address over invented ids — `lib/civic/stateGraph.ts`
points at module indexes, never at a node id.

## Dated record

**The graph writers stopped being able to erase each other (2026-08-13).**
Not a route, but it protects every one of them. `upsertKgNodes` does
`props = excluded.props` — a WHOLESALE REPLACE — and four writers adopted an
explicit read-merge because of it, while `memory/kg-upsert-replaces-props.md`
named `kg-legislation-ingest.ts` and **not `kg-compute.ts`**, the area's own
declared entry point, which built each node's props from scratch. So
`npm run da:kg-compute --commit` erased the whole effort layer from all 207
MPs (`contribution_score`, `participation_rate`, `absence_rate`,
`speech_turns`, `interpellations`, `bills_authored`, `absentee_manager_lead`,
`contribution_psp9`, `effort_tenure_class` — every one of them read by a live
loader), and with `--reset` it called `clearKg()`, deleting ~154 k nodes /
~178 k edges and rebuilding ~1 k, taking /penize, /zakony, /denik and /graf
dark. **And the vault instructed exactly that**: `docs/data-analysis/
frontier.md` F5, status `open`, prescribed `--commit --reset` as routine
maintenance, with a second copy of the same instruction in
`.claude/skills/knowledge-graph/SKILL.md`. Both corrected.
`mergeComputedNodeProps` (pure, in `lib/analysis/kg.ts`) matches the four
siblings' idiom rather than inventing a fifth, and carries `firstSeenPass`
through from the stored node — a `--pass=50` re-run used to re-stamp all ~250
creation stamps. `provenance` IS re-stamped, deliberately: it dates the
numbers in `props`, and freezing it at pass 1 beside a fresh `rebellion_rate`
would be a false vintage. `guardKgReset` compares what the store **actually
holds** against what the run **actually emits** — never a hardcoded list, so
a kind or relation added by a future pass is protected the day it lands — and
it names the casualties (including rows of a rebuilt kind the run will not
re-emit: a departed MP, an emptied committee), refuses, and prints the verdict
on every dry run; `--supersede` is the deliberate override
(`kg-contribution-ingest`'s precedent). Same family: `kg-promote.ts` had
guarded EDGES since 2026-07-24 and left NODES open, so a verdict declaring
`psp:person:6790` passed the shared `KG_NODE_KINDS` enum and would have
replaced that MP's whole enrichment layer with one `{rationale}` string;
`CASE_OWNED_NODE_KINDS` is derived as **the enum minus `bloc`/`theme`** (the
only kinds this path has ever legitimately written), so a kind added to the
enum is refused by default, and a refused node never joins `kgResident` so no
edge can come to rest on it. Also: `Math.max(0, ...nodes.map(…))` — the spread
that throws `RangeError` on ~154 k arguments, fixed once in 2026-08 and left
live in **six** siblings, each therefore working ONLY when the operator passed
`--pass=N` and dying on the bare invocation its own header documents — is now
the single `nextPass()` reduce, read by all **seven** writers. And
`lib/civic/stateGraph.ts` stopped minting `/poslanec/<slug>` over the sample's
invented ids (`novakova-p`), which `notFound()`s — precisely when the sample
is drawn, i.e. when the store is down; its other nodes already pointed at
module indexes and the person now points at `/zebricek`. `stateGraph.test.ts`
had **zero** href assertions while `stateSlice.test.ts` pins them, so
CLAUDE.md's claim that both builders are held to the same invariants was
false; two tests close it (every sample href is a module index; none carries a
node id).


## 2026-09-04 — every write names its origin, or is refused

`kg_node.provenance` / `kg_edge.provenance` were free-form jsonb, and the seven
writers filled them seven ways: `{pass, method, ref, computedAt}` with no
`source` and no run key anywhere. The cost was not stylistic. `/atlas` could
score **3 of 14** declared sources and printed a paragraph explaining why the
other eleven — including **both** that carry the whole of `/penize` — get no
number at all; the Merkle seal covered eight entity tables and **zero** graph
rows, so a half-applied money or law pass was invisible to the sentinel while a
half-applied score pass was not.

`lib/kg/provenance.ts` is now the one declaration: `{source, ingest_run_id,
pass, ref, writer}`, with `source` a key of `INGESTED_SOURCES` **imported** from
`lib/analysis/atlas.ts` rather than re-listed. Two stored generated columns on
each table project `source` and `ingest_run_id` out of the jsonb, so the column
can never disagree with the row it describes and no backfill has to keep two
copies in step.

**The split that matters here is origin vs enrichment**, and it is the same
distinction `kg-contribution-ingest` already drew when it kept
`provenance: existing.provenance`:

| Writer | Role | Stamps |
| --- | --- | --- |
| `kg-compute` | origin | per ref — nodes `psp-poslanci`, the three edge rels `psp-hlasovani` |
| `kg-money-ingest` | origin | per kind/rel — company + `linked_to` `dataor-justice-cz`, contract + `supplies` `smlouvy-gov-cz` |
| `kg-legislation-ingest` | origin | source `psp-tisky-law`, ref `psp-tisky` |
| `kg-promote` | origin | `--source=` required; no default that is a guess |
| `kg-vote-bill-ingest` | origin | source `psp-hlasovani` — the `decides` edge asserts the VOTE half; the bill is only referenced |
| `kg-contribution-ingest` | enrichment | `contribution_provenance.writer`; row provenance untouched |
| `kg-forensics` | enrichment | `forensic_provenance.writer`; row provenance untouched |
| `persist-batch` | enrichment | `<ns>_provenance.writer`; row provenance untouched |

An enrichment writer claiming a source would say a person node came from a
scoring pass rather than from the chamber register. It does not; it names the
**writer** instead, which is what lets a per-layer uniformity check say *which
script* a divergent bucket came from rather than only that one exists.

`guardStampedRows()` runs immediately before every origin upsert and throws with
the row index and the reason. `--allow-unstamped` exists for the migration pass
alone and **counts** what it lets through — a bypass nobody counts is a bypass
that becomes permanent.

**`source: "unknown"` is a value, not a hole.** `kg-promote` without
`--source=` and every row the backfill cannot reconstruct land there, and
`/atlas` counts them on the card. A migration that guessed a plausible source
would be repair, and this repo discloses: a number printed and burned down beats
a number that looks finished and is not.

### The migration pass

`scripts/data-analysis/kg-provenance-backfill.ts` (dry run by default) derives a
stamp for every pre-contract row from the `ref` it already carries — four rules,
each read off the writer that produced it. Rows it cannot resolve land on
`unknown`, grouped by the unresolved ref and printed as the number to burn down;
re-running the owning writer replaces it with a real source. It passes `props`
through byte-for-byte (this is exactly the script shape that once erased the
effort layer off all 207 MPs), leaves a row already under contract alone unless
`--restamp`, and attaches no `ingest_run_id` to a historical row — that would
place it inside a seal that never covered it. On the fixture mirroring the five
legacy stamp shapes, 13 of 16 rows derive and 3 land on `unknown` across two
refs.

Proven on a store copy (`scripts/data-analysis/kg-writer-provenance.test.ts`),
never against the live store — including the thing every writer on this page has
broken before: a later pass's props still survive a stamped rewrite of the same
node. `kg-money-ingest` also gained the `isDirectRun` guard `kg-promote` already
carried; importing its pure half used to fire `main()` and exit 1 for want of an
API token.

**One dump reader for the kg writers (2026-09-06, scan-sweep, parity-auditor).**
`getDump` — cache dir, base URL, user-agent, 180 s timeout, warn-and-null — was
copied byte-for-byte into five writers, and one copy already logged a non-ok status
that the other four swallowed. `scripts/data-analysis/pspDump.ts` is the one
definition; `ingest.ts` keeps its metadata-recording variant on purpose (it feeds
the `ingest_run` row). `kg-bill-roles-ingest` also dropped its private UNL member
reader for `lib/ingest/unlMembers` (5 + 1 copies → 1 + 1; `oneDump.test.ts` pins it).
`kg-vote-bill-ingest.ts` carries a sixth copy and is not in this context's file list;
it is named here, not touched.

**`kg-committee-routing` derives its pass (2026-09-06, scan-sweep, parity-auditor).**
Its default was the literal `12` while eight sibling writers derive the pass from the
graph (`nextPass`), so every re-run without `--pass` restamped the `assigned_to` edges
as pass 12. It now derives like the others (1 frozen default → 0; `writerPass.test.ts`).

**`kg-contribution-recompute` reads person nodes through `KG_READ_CAP` (2026-09-06,
scan-sweep, parity-auditor).** The last literal cap among the kg writers (`limit:
1000`) is gone; `writerReadCap.test.ts` pins that no writer lists graph rows under a
literal (1 → 0).

**`kg-money-ingest` read-merges its nodes (2026-09-06, scan-sweep, bounty-hunter).**
D1 (batch 004) made the `linked_to` edges merge-preserving; the company and contract
NODES were still built fresh — `props: n.props`, `firstSeenPass: opts.pass` — so a
re-ingest wholesale-replaced every company node's props (the `upsertKgNodes` replace
this page catalogues) and restamped the pass that created the node. `moneyGraphToKgRows`
now takes the stored nodes and merges through `mergeComputedNodeProps`; the ingest
passes them (`kgMoneyIngestMerge.test.ts`: a stored `ico_unresolvable_in_ares`
survives, a computed `subsidies_total_czk` wins, `firstSeenPass` stays).

**`kg-legislation-ingest` read-merges bill and law nodes (2026-09-06, scan-sweep,
bounty-hunter).** `kg-bill-roles-ingest`'s header has said since pass 34 that a full
re-run of this writer „would wholesale-erase" `summary_cz`, `forensic_*` and `amends_*`
off every bill node; the hazard was documented in the sibling and left in place here.
Bill and law nodes now merge through `mergeComputedNodeProps` and keep the pass that
created them; a law node's e-Sbírka title (esbirka-laws.ts) survives too
(`legislationMerge.test.ts`; 2 from-scratch node builders → 0).

**2026-09-08 (scan-sweep, kg-pipeline round 74, parity-auditor).** `kg-compute` was the
last writer with a frozen pass default: `--pass` fell back to the literal `1`, so a bare
recompute restamped every node's and edge's provenance as pass 1 — the false vintage its
own header describes — while its eight siblings derived the pass from the graph. It now
reads `nextPass(store.listKgNodes())` like them; an explicit `--pass=N` still wins
(`kgPipelineSource.test.ts`; 9 writers, 0 frozen defaults).
