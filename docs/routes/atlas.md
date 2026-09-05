# /atlas — Atlas kvality otevřených dat

## Current contract

**Routes** — `/atlas` (per-source data-quality scorecard: coverage · freshness ·
integrity · completeness, each 0–100, each printing the rule that produced it)
and its machine twin `app/atlas/atlas.json`. The landing's source panel reads
the same report through `features/landing/sourceStates.ts`.

**Purity contract** — `now` is an INPUT, never `Date.now()` inside the pure
layer, and byte-identical output under input reordering is asserted by test.

**Unrated is structurally never zero** — the discriminated union carries no
`score` field on the unrated arm, and that discipline is enforced in the
derivation, in the sort (`sortScore` returns `null`, unrated always last) and in
the landing projection. An **unscored** source likewise carries NO number:
four `nehodnoceno` scores would assert "this source has no rows in the store",
which is false. The reason is stated as a limit of OUR pipeline — `kg_node` /
`kg_edge` have no `source` column and no `ingest_run_id`, so no join key runs to
`ingest_run` — and it says explicitly that the data IS in the store. Scoring
`kg_*` coverage is deliberately out of scope: it would break the integrity
rule's printed claim that the sealed tables and the scored tables are the same
set. **Name the gap, do not close it by loosening a printed rule.**

**The printed rule cannot drift from the score.** The rule exists twice by
design — `ATLAS_RULES` publishes, the catalog renders — and the test asserts the
Czech string **after ICU substitution is byte-identical to `ATLAS_RULES`** while
the English must not equal it and must pass `looksEnglish`. `ATLAS_RULE_PARAMS`
is the one declaration of the thresholds and parameterises both catalogs.

## Dated record

`/atlas` — **Atlas kvality otevřených dat** (features/atlas, thin route
`app/atlas/page.tsx`, machine twin `app/atlas/atlas.json`). Per-source
data-quality scorecard: coverage / freshness / integrity / completeness, each
0–100, each printing the rule that produced it. Pure derivation over three
read-only store queries plus a census (nine queries in total — the loader's own
header saying „tři čtení" is wrong and its `cache()` comment nine lines down is
right). **Unrated is structurally never zero** — the discriminated union
carries no `score` field on the unrated arm — and that discipline is enforced
in the derivation, in the sort (`sortScore` returns `null`, unrated always
last) and in the landing's `sourceStates.ts`. `now` is an INPUT, never
`Date.now()` inside the pure layer, and byte-identical output under input
reordering is asserted by test.
**The atlas admits how many sources it cannot score (2026-08-13).** It scored
**three**; the platform declares **twelve**. The nine invisible ones included
`smlouvy` and `dataor` — the entire data foundation of `/penize` — so a reader
checking the quality of the data behind the module that names companies and
contracts found no card at all, and the page silently implied the platform had
three sources. `INGESTED_SOURCES` now declares all twelve with the LANDING each
one's rows reach (`entity` / `graph` / `generated-module` / `none`) and
`unscoredSources()` derives the nine, at zero new store reads. **An unscored
source deliberately carries NO number**: four `nehodnoceno` scores would assert
„this source has no rows in the store", which is false — the reason is stated
as a limit of OUR pipeline (`kg_node`/`kg_edge` have no `source` column and no
`ingest_run_id`, so no join key runs to `ingest_run`) and says explicitly that
the data IS in the store. Scoring `kg_*` coverage was ruled OUT of scope: it
would break the integrity rule's printed claim that the sealed tables and the
scored tables are the same set — name the gap, do not close it by loosening a
printed rule. Two brief claims were corrected by the builder against the tree
and are worth keeping: `volby-ps2025-candidates` has **no importer outside its
own test**, and `monitor-statni-pokladna` reaches no table at all (`/rozpocty`
reads checked-in `features/budget/data/*.generated.ts`).
**The printed rule cannot drift from the score (2026-08-13).** The rule existed
TWICE — `ATLAS_RULES` for `/atlas/atlas.json`, four catalog strings for the HTML
page — byte-identical but bound by nothing; the only test compared the object to
itself. The catalog stays the RENDER source (so the English reader gets real
English) and the constant stays the PUBLISH source, and the test asserts the
**Czech string after ICU substitution is byte-identical to `ATLAS_RULES`** while
the English must NOT equal it and must pass `looksEnglish`. `ATLAS_RULE_PARAMS`
is the one declaration of the thresholds and parameterises both catalogs, so a
constant change reflows the machine rule and both locales from one edit
(demonstrated). `features/atlas/messages.test.ts` is the feature's first — it was
the only catalogued surface without one.

**The source register is derived from the tree, not copied from it
(2026-09-01, scan-sweep).** `INGESTED_SOURCES` was hand-written on 2026-08-13
with the note that every row had been verified over the tree, and its test
compared the list only to itself. Two adapters that entered `lib/ingest/sources`
afterwards never got a row: `isvz.ts` (Registr veřejných zakázek — the whole
tender layer `/volby` reads, 61 k nodes) and `smlouvy-dump.ts` (the bulk
Registr smluv dumps behind the contract census). So the page whose purpose is
to name every source the platform works with named 12 of 14, and the landing's
source panel printed „12 deklarovaných" from the same constant. Both now carry
rows (`isvz-nipez-cz`, `smlouvy-gov-cz-dump`, landing `graph`, unscored for the
same reason as the other graph sources), and `lib/analysis/atlas.test.ts` reads
the adapters directory and fails on the next module that lands without a row
(two named helpers excluded, each with its reason). Counts on this page and on
`/` moved 12 → 14 declared, 9 → 11 unscored.

**The graph became measurable, and the seal moved first (2026-09-04, moonshot
#22).** This file has carried the refusal verbatim since 2026-08-13:
"`kg_node` / `kg_edge` have no `source` column and no `ingest_run_id`, so no join
key runs to `ingest_run`", and "Scoring `kg_*` coverage is deliberately out of
scope" — because the integrity rule **prints** that the sealed set of tables and
the scored set are the same set, and scoring the graph would have made that
sentence false. Eleven of fourteen sources therefore printed no number at all,
including **both** that carry the whole of `/penize`.

The order of the fix is the whole point. `lib/kg/provenance.ts` declares the one
stamp (`{source, ingest_run_id, pass, ref, writer}`); `CORE_DDL` projects
`source` and `ingest_run_id` out of it as stored generated columns; **then**
`RUN_TABLES` (`repositories/ledger.ts`) gains `kg_node`/`kg_edge`, appended at
the end of the pinned order so every previously sealed run keeps its root
(`kg_edge` seals in `(src, rel, dst)` order — its identity is the triple, it has
no `id`); and only after the seal actually covers the graph does
`readEntityCoverage` read the two tables. The printed integrity rule is updated
in the same change, in `ATLAS_RULES` and byte-identically in both catalogs. The
sentence stays true; it just got two tables wider.

**Section 03: rows with no declared publisher.** With a `source` column the
page can finally ask a question it could not ask before — how many graph rows
claim no declared source — and the answer is a number, printed. It is **not** a
card: a card for `unknown` would carry four dimensions and a composite and would
sort between `psp-poslanci` and `smlouvy-gov-cz`, asserting that a publisher of
that name exists. It does not.

Two counts, deliberately not summed:

| | means | how it goes away |
| --- | --- | --- |
| **nedohledáno** (`source = 'unknown'`) | the migration reached the row and could not honestly reconstruct its origin | re-run the writer that owns those rows; it stamps a real source |
| **neorazítkováno** (`source IS NULL`) | the migration has not reached the row | run `kg-provenance-backfill` |

Folding them into one "no provenance" figure would hide which is a confession
and which is work in progress. **Zero here does not mean finished** — it means
every row claims some source.

The graph landing's unscored sentence changed accordingly: a graph source now
stands in section 02 only until an ingest under the provenance contract stamps
it, not because the tables structurally cannot be measured. Both that sentence
and the scope note are byte-pinned to their constants by
`features/atlas/messages.test.ts`, so the prose and the capability cannot drift
apart again.

**`/atlas/atlas.json` answers an outage with an uncacheable 503 (2026-09-06,
scan-sweep, parity-auditor).** Same rule as the feed and data endpoints
(`cache-control: no-store`, `retry-after: 600`); pinned by
`lib/testing/machineRoutes503.test.ts`.
