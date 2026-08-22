# /atlas — Atlas kvality otevřených dat

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
