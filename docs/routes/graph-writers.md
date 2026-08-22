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

