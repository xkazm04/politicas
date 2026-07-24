---
name: data-analysis
description: Systematically analyze the politicas civic entity graph with Sonnet subagents — audit data quality per slice, flag hollow stats, mine patterns for backlog items and product opportunities, and stamp coverage so the loop is resumable. Use when the user says "analyze/audit/mine the data", "what's in the corpus", "score the entity graph", or wants the analysis loop to run.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

# Data Analysis — Civic Corpus Intelligence Loop

A disciplined, resumable loop that turns the real Czech-parliament corpus into
applied intelligence. It fans **Sonnet subagents** across data slices, tags
coverage in the vault (`docs/data-analysis/`) + the `slice_quality` table, and
produces durable outputs: **quality scores**, **backlog items**, and **product
opportunities**. One slice per pass, atomic state updates — it works alone and a
later session resumes from the ledger.

Adapted to **politicas**: Next.js 16 · a PGlite `Store` (`lib/db/`) · the entity
graph in `lib/db/types.ts` rows (person ↔ organ ↔ mandate ↔ membership ↔
vote_event ↔ vote_ballot ↔ absence) · deterministic scorer `lib/analysis/quality.ts`
· verdict contract `lib/analysis/verdict.ts`. Read `docs/data-analysis/onboarding.md`
before starting.

---

## When to use / NOT use

**Use** for corpus-wide understanding + maintenance: quality audits, hollow-stat
detection, entity-graph integrity checks, pattern/opportunity mining, data-driven
backlog. **Don't use** for rendering a single MP profile (that's a feature
surface), for ingestion (that's `npm run da:ingest`), or for the mock data layer
in `lib/civic/` (that stays clearly labelled mock until a surface is ported).

## The product (primer — subagents inherit this)

politicas is a Czech public-accountability platform over **one entity graph**.
Five modules read it: CivicScore (a per-MP score from four pillars), VoteTrack
(roll-call ledger + club discipline), FollowTheMoney (IČO-joined money ties),
BudgetMirror, LawWatch. **Score quality bounds product quality**: a dangling
ballot can't feed discipline, a placeholder date can't feed a timeline, an empty
contact field can't feed a profile. **Trust is the product — never fabricate**;
analysis writes DERIVED metadata only and never overwrites a source field. A
smaller real dataset beats a large invented one. **Czech-first**: diacritics are
folded to ASCII at ingest into `*_norm` columns (PGlite has no `unaccent`).

**Two data realities (the politicas analogue of "data depth"):**
- **Structural publisher limits** — some columns are empty or merged AT SOURCE
  and no scraper can fill them: the current-term MP contact fields (email/web/
  facebook 0/207), short vote titles (empty for ~all PSP10 votes), and the
  post-1995 **merged K bucket** (abstained + didn't-press are one code and cannot
  be separated). A low score here is upstream reality — say so, do NOT propose a
  scraper, and do NOT split a merged number.
- **Mirror defects** — the Pumper release mirror carries U+FFFD because Pumper's
  HTML fetch ignores psp.cz's windows-1250 charset. That is a Pumper SPEC item,
  not a politicas bug; the authoritative Czech text comes from the direct UNL
  download, which the ingest decodes itself.

## The vault — `docs/data-analysis/`

The memory that makes the loop resumable.

- **`onboarding.md`** — the founding analysis + the source known-issues, the
  ground truth for every slice's caveats.
- **`coverage-ledger.md`** — THE DRIVER. A table: slice · status (`pending`/
  `analyzed`/`stale`) · lastAnalyzed · composite · notes. The loop reads it to
  pick the next slice; a slice goes `stale` when its source re-ingests after
  lastAnalyzed. Create it on the first run by enumerating the slices below.
- **`analysis-<slice>.md`** — per-slice findings: quality breakdown, gaps,
  patterns, opportunities, the subagent verdict.

## Slices — the unit

A slice is **`<source> × <term> × <entity>`**. Sources: `psp-poslanci`,
`psp-hlasovani`, `pumper-psp-opendata`. Terms: `PSP10` (current chamber) or `all`
(term-agnostic registries — person, organ). Entities are the graph tables. The
deterministic scorer scores each slice on the six criteria and `slice_quality`
persists them. This is the unit the loop PERSISTS and the qualitative unit a
Sonnet subagent reasons over.

## The loop — one pass

1. **Pick** — read `coverage-ledger.md`; take the stalest `pending`/`stale` slice.
2. **Refresh the deterministic ground truth** — `slice-stats.ts` is the ONE place
   the numbers come from. PGlite is single-connection: if a dev server holds
   `./.pglite`, run against a COPY (never a 2nd connection):
   ```bash
   cp -r .pglite .pglite-copy
   PGLITE_PATH=./.pglite-copy npx tsx scripts/data-analysis/slice-stats.ts --out=./.data-analysis
   ```
   It writes `stats.json` (every slice) + `rows/<slice>.json` (a bounded row
   projection). Re-ingest first (`npm run da:ingest`) only if the source is stale.
3. **Read the deterministic stats = ground truth for COUNTS.** Per-field %s +
   composite are authoritative; the subagent must not author them. BUT a count can
   be **semantically hollow** — `pct_categorized: 100` on ballots is true yet 22%
   of them are the merged K bucket; catching that is the subagent's job.
4. **Fan ONE combined Sonnet subagent per slice** (parallel, one message). Give it
   the slice id, its row file, the deterministic stats, and the verdict-schema
   requirement — nothing else. Enforce the verdict **schema** (see below).
5. **Synthesize + verify** — reconcile subagent claims against the stats; drop
   what the numbers don't support.
6. **Write the vault** — `analysis-<slice>.md`; note any backlog/opportunity.
7. **Persist** — the DETERMINISTIC `slice_quality` via `promote-verdicts.ts`
   (`--commit`). Subagent scores are NEVER written as the trusted number.
8. **Tag** — mark the slice `analyzed` in the ledger (lastAnalyzed, composite).
   Atomic: one slice, one ledger update. Re-run `datahub-sync.ts` so the catalog
   coverage matches.
9. **Loop** — repeat until analyzed/budget.

## Subagent output — the ENFORCED schema contract

The verdict shape is a **machine contract**, not prose to re-type. Single source
of truth: `lib/analysis/verdict.ts`:
- `verdictJsonSchema` — draft-07, six named criteria (each score integer 1–5),
  `composite` 1–5, `backlog[].kind` enum `ui-ux|feature|data-quality|methodology`,
  `additionalProperties:false` on `quality` so an **invented dimension is rejected**.
- `validateVerdict()` / `parseAndValidateVerdict()` — a deterministic gate
  returning every violation with a dotted path.

**Prefer** tool-call-layer enforcement: fan with `agent(prompt, {schema:
verdictJsonSchema, model:'sonnet'})` — the model physically cannot return a
drifted shape. **Fallback** (plain `Agent`, no schema param): ask for one fenced
```json block and run EVERY block through the gate before using its scores:
```bash
echo "<subagent text>" | npm run da:validate-verdict -- --rows=.data-analysis/rows/<slice>.json
```
`--rows` also rejects a cited `entityId` that is not a real row in the slice (a
field name or a slice-wide phrase in the id slot). On drift: **discard the scores,
keep the qualitative findings, re-run the subagent — never persist a drifted score.**

**The prompt** (either path — the schema, not this text, defines the shape):

> You are a data-quality analyst for politicas, a Czech public-accountability
> platform over one entity graph. [PRODUCT PRIMER incl. the two data realities.]
> Slice: `<source × term × entity>`. Read your rows at `<file>` (already filtered
> to this slice — read nothing else; the file is NOT lossy-truncated).
> Deterministic ground-truth stats (AUTHORITATIVE): `<per-field %, composite, notes>`.
> Return a verdict matching the AnalysisVerdict schema: per-criterion
> `{score 1–5, reason}` for completeness/freshness/categorization/validity/richness/
> volume, `composite` 1–5, plus `entityGaps`, `miscategorized`, `patterns`,
> `opportunities{productImpact}`, `backlog{kind}`.
> Rules: judge ONLY from your rows; cite entityIds + counts; each score CONSISTENT
> WITH THE STATS; defer to the stats for COUNTING but FLAG when a stat is
> semantically hollow (the merged K vote bucket, empty current-term contacts, a
> year-2925 placeholder date, U+FFFD mirror text, a future-dated excuse); never
> invent rows/numbers/dimensions; a parliamentary club is NOT the elected party
> list; say if you sampled.

## Universal quality criteria (shared across every onboarded corpus)

Each 1–5; composite = mean. Same six everywhere so corpora compare fairly; the
politicas MEANING of each is defined as documented fields on the `slice_quality`
dataset and implemented in `lib/analysis/quality.ts`:
**Completeness** (identity fields the entity can't function without) ·
**Freshness** (sync age · newest-row lag; beware placeholders + recesses) ·
**Categorization** (placed in the graph taxonomy: person→mandate, mandate→CLUB
not party-list, ballot→choice vocabulary) · **Validity** (edges resolve · vote
tallies reconcile · name_norm pure ASCII · no U+FFFD) · **Richness** (optional
product depth: contactable MP, distinguishable vote, timed excuse) · **Volume**.

## Known corpus gotchas (watch-list — pre-empt these each run)

- **The merged K bucket** (44,633 PSP10 ballots): abstained + didn't-press are ONE
  code since 1995 (90/1995 Sb.). Never split it; never call it "missing".
- **Empty current-term contacts**: PSP10 email/web/facebook 0/207 — upstream-absent,
  not a scrape fix. Photos ARE present (203/207).
- **Empty short vote titles** (~all PSP10 votes): richness cap; the long title carries content.
- **Far-future placeholder dates**: a membership dated year 2925 (a 2025 typo) —
  treat year>2100 as a placeholder; it inflates newest-row freshness.
- **Voided (zmatečné) votes** (16 in PSP10): exclude from any discipline/attendance metric.
- **Future-dated excuses**: excuses are filed ahead, so a future newest row is real.
- **U+FFFD in the Pumper mirror** (all 17 rows): Pumper's charset defect, a SPEC
  item — validity is structurally 0 there by design; never guess-repair the text.
- **Club ≠ party-list**: an MP elected on one list can sit in another club.

## Guardrails

- **Never fabricate / never overwrite source fields.** Derived metadata only.
- **One slice per pass, atomic ledger update.** Note any sampling/skips.
- **Respect the PGlite writer** — read a COPY (`PGLITE_PATH=`), never a 2nd connection.
- **No lossy preprocessing** — the row projection keeps every field a verdict reasons about.
- **Counts come from `slice-stats.ts`**, the ONE place; the subagent adds qualitative only.
- **Enforce the verdict schema** (`da:validate-verdict`); discard/re-run on drift.

## Resuming

Read `coverage-ledger.md` → the `pending`/`stale` rows ARE the remaining work;
`analyzed` rows link their `analysis-*` notes. `slice_quality.analyzedAt` is the
source of truth if the vault and DB disagree. Then run the loop.
