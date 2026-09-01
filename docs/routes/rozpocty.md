# /rozpocty — BudgetMirror

## Current contract

**Routes** — `/rozpocty` (BudgetMirror: 132 towns with wired budget series,
town-vs-peer-group mirror, debt-per-capita trends) and `/rozpocty/[ico]`
(permanent town address; ~360 towns declared in `generateStaticParams`, none prerendered today — see 2026-09-01).

**Reads** — the budget series come from the checked-in generated modules
`features/budget/data/*.generated.ts` (FIN 2-12 M consolidated figures), **not
from a store read**; the supplier trail rides the money graph.
`municipalRoutes.ts` is ONE list feeding both `generateStaticParams` and
`app/sitemap.ts` — a municipality is a public register, not a person, so the
sitemap exclusion that applies to people does not apply here (argued in place).

**Standing rules.** The headline figure is Σ contract VALUE over a year span,
**not payments**, and the card says so with the /penize qualifier and the span.
Columns are named for what they measure (documented DIRECTION, never "payment").
Stewardship feeds only executive roles, stated on the page. The impossible-date
boundary is `lib/analysis/plausible-date.ts` — imported, never forked — applied
at the DECODE boundary the page actually reads, with the upper bound
`SUPPLIERS_RETRIEVED_ON` (the day the register was read) rather than "today";
both bounds are withheld together, the row and its money stay, the count is
typeset. A DATA fault must not take the supplier section down; a structural
codec error still fails loud.

## Dated record

`/rozpocty` — **BudgetMirror** (features/budget): **REAL since the
2026-07-30 MONITOR moonshot** — 132 towns with wired budget series (FIN
2-12 M consolidated figures) + the live supplier trail over the money
graph, town vs computed peer-group mirror, debt-per-capita trends,
permanent town addresses at `/rozpocty/<ico>`. Stewardship feeds only
executive roles — stated explicitly on the page.
**The impossible date has ONE boundary (2026-08-13).**
`lib/analysis/plausible-date.ts` says in its own header that it exists „aby
hranice byla v celé aplikaci jedna a stejná". It was not: `/rozpocty` carried a
PRIVATE `y > 1900 && y < 2100` fork in `supplierTrail.ts`, so the corpus's future
years passed straight through — and the checked-in `municipalSuppliers.generated.ts`
holds `00279676 × Československá obchodní banka` spanning **2009–2043**, i.e. the
page published a municipality's contract history running to 2043. Two further
findings shaped the fix: `yearOf` ran at GENERATION time, so repairing it there
would have changed nothing on the live page (the gate had to go at the DECODE
boundary, the path the page actually reads); and the upper bound is now
`SUPPLIERS_RETRIEVED_ON` — the day the register was read, travelling with the rows
in the same batch — not „today", which would have been a second guess. **Both
bounds are withheld together** on an implausible year (withholding one would be an
estimate), the row and its money stay, the count is typeset, and a structural codec
error still fails loud while a DATA fault no longer takes the supplier section down.
Same pass on the money side: `/penize/[pspId]` printed `{c.signedOn}` verbatim while
its sibling `/penize/firma/[ico]` suppressed and disclosed the SAME graph field, and
`/penize/[pspId]/paket` baked impossible dates into a hash-stamped **downloadable**
bundle; the MP file now reuses the company file's exact keys (zero new money keys),
the packet strips the date, splits „no date" from „impossible date" as two counts,
and discloses the suppression inside `citeCs` — the sentence a journalist pastes.
The packet hash changes for an affected tie, which is expected and stated: measured,
**zero existing packets change today** because all 211 ties are `pending_review`, so
every packet's `ties` is empty. Note the shape deliberately chosen: the raw
`signedOn` STAYS on `MoneyMpDetail` and the verdict is attached beside it
(`ContractLine.dateWithheldOn`, with `displaySignedOn()` the one path to a surface),
because `features/profile/profileMoney.ts` RECOMPUTES its own `dateUnusable` from the
raw value — nulling it would have made /poslanec silently stop disclosing bad dates.
A loss of disclosure is not a price worth paying for de-duplication.
`features/dashboard/datedFacts.ts` (which re-declared `PLAUSIBLE_FROM`) and
`features/denik/deriveDenik.ts` (which imported it THROUGH datedFacts) now read the
canonical module; the value is unchanged, so what those two count as impossible does
not move — de-duplication, not a fix, pinned by a one-declaration test.
**The honest sheet (2026-08-12).** The most-seen number (38,78 mld Kč,
Praha default) read as payments while being Σ contract VALUE 1995–2026 —
the card now carries the /penize qualifier („částka = hodnota smlouvy")
and the year span `supplierTrail` always computed and nobody drew (a row
with no signing date neither extends nor zeroes the span); „doložené
platby" columns renamed to what they are (documented DIRECTION, not
payment). §03 peer table gained its SourceNote; the rail contract was
repaired three ways (missing `#penize` anchor, §01 label drift, no
`sectionsFor` case for town pages) with a parity test in the /hlasovani
pattern; nine mock-era keys asserting „smyšlená čísla, MONITOR nenapojen"
are deleted from both catalogs and `budget.sourceLine` interpolates the
generated retrieved-date constants instead of a hand-typed literal
(`features/budget/messages.test.ts` forbids the tokens). ~360 declared
town pages joined the sitemap through `features/budget/municipalRoutes.ts`
— ONE list for `generateStaticParams` AND `app/sitemap.ts` (a municipality
is a public register, not a person, and the register is a static module:
both sitemap-exclusion reasons lapse — the exception is argued in place).

**The combobox is a catalog primitive (2026-08-27, spark election-replay WP3a).**
`TownPicker` no longer hand-rolls the ARIA combobox: input, listbox,
`aria-activedescendant`, keyboard (arrows / Home / End / Enter / Escape / Tab)
and the kraj group headers now come from
`features/shared/components/Combobox.tsx`, whose keyboard model is a pure
reducer (`comboboxKeys.ts`, tested in `Combobox.test.ts`). Ranking stays here
in `searchMunicipalities` — the primitive only debounces (0 ms for this
surface, unchanged) and limits (40, unchanged); grouping by `krajName`, the
option ids and the covered/uncovered tag are the same as before. One
deliberate small delta: a quick-pick chip no longer clears a query typed in
the search field (the list still closes via blur). `KrajPickerPage` and
`/graf` `NodeSearch` are the two remaining hand-rolled copies, left for a
later package.

**Nothing is prerendered, and three places said it was (2026-09-01, explorer sweep).**
`.next/prerender-manifest.json` from the 2026-08-27 build lists 0 `/rozpocty` paths:
the locale cookie read in `lib/i18n/request.ts` renders every route dynamically
(`memory/revalidate-is-inert-every-route-is-dynamic.md`), so `generateStaticParams` on
`/rozpocty/[ico]` is a declared ceiling, not a description of the build. The page
comment, the `municipalRoutes.ts` header and this file all claimed „~360 prerendered
pages"; the sitemap argument leaned on it („Next z něj tytéž stránky už
předgeneruje"). The argument still stands on its other leg — a municipality is a
public register baked into the build, no store read, no person — and the three
claims now say what runs. Noted for the day the app goes static: `getSupplierTies`
(the live human-review state) must not be frozen into static output; its header
already says so, and the page comment now points there.

**The picker ranks by population again (2026-09-01, explorer sweep).** `searchMunicipalities`
promised „uvnitř stupně podle počtu obyvatel sestupně" and delivered it by relying on the
registry's input order plus a stable sort. Commit 26d695a (the repo-wide total-order
tiebreak, correct in intent) appended `ic` straight after the score, so within a tier the
order became IČO order: „pra" returned Pravonín (572) ahead of Prachatice (11 119). The
comparator now states population desc explicitly, then IČO; a test feeds the registry
reversed so the order can never again be an assumption about the input.

**§04 lists every counterparty with an MP tie, not only the twelve largest (2026-09-01,
explorer sweep).** The tie lookup ran only over the first `TOP_SUPPLIERS` rows, so a
tied counterparty ranked 13th or lower vanished into „a dalších N protistran" with no
word — on the surface whose purpose is that tie. Measured against the store: Brno
(44992785) has 17 counterparties, 13 tied, four of them (RAILREKLAM, ČSOB Pojišťovna,
Vzdělávací centrum pro veřejnou správu, Univerzita Palackého) at ranks 13–16, all
hidden. `liftTiedRows` (`supplierTrail.ts`, tested) now keeps the twelve largest AND every
tied row, in volume order; the fold sentence (`budget.restRowTiesLifted`, cs + en) states
how many rows were lifted beyond the largest and that no folded counterparty has a tie
on record. Without the live tie layer nothing is lifted and the old sentence stays,
beside `tiesUnavailable`. Not visually verified in this session — no politicas dev
server was available; the split is a pure function under test.

**§04's headline count is named for what it measures (2026-09-01, explorer sweep 2).**
`contractCount` sums the per-counterparty rows, so a contract with two graph companies (or
two municipal parties) counts once per row; the batch carries no contract ids, so a unique
count cannot be derived from it. Measured: 11 741 row-counts against 11 582 municipal
contracts (+1,4 %). The card now says „smluvních vztahů (smlouva × protistrana)" in both
catalogs, pinned by `messages.test.ts`; the per-row column stays „smluv", which per row is
true. Also this pass: §03 and §04 tables carry `aria-labelledby` to their section heading
(`SectionHeading` gained an optional `id`), and the graph-link button keeps its label while
pending with `aria-busy` instead of swapping to „…".

**The peer median is taken at the town's own year (2026-09-01, explorer sweep 2).** `MetricDuo`
prints one year over both bars — the town's last reported year — while `peerMedians` always
took the batch's last year. They coincided only because 132/132 towns report 2025. The page
now passes the town's year index; a town whose last statement is 2024 is measured against the
2024 median (and the 2024 bar ceilings), with `sampleSize` saying how many peers reported that
year. No number moves on the checked-in batch; `peerGroups.test.ts` pins both the contract and
the fact that today the two indices are equal.
