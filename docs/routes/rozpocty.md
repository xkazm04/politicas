# /rozpocty — BudgetMirror

## Current contract

**Routes** — `/rozpocty` (BudgetMirror: 132 towns with wired budget series,
town-vs-peer-group mirror, debt-per-capita trends) and `/rozpocty/[ico]`
(permanent town address, ~360 prerendered pages).

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
(`features/budget/messages.test.ts` forbids the tokens). ~360 prerendered
town pages joined the sitemap through `features/budget/municipalRoutes.ts`
— ONE list for `generateStaticParams` AND `app/sitemap.ts` (a municipality
is a public register, not a person, and the register is a static module:
both sitemap-exclusion reasons lapse — the exception is argued in place).
