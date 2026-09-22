# App shell — failure surfaces & per-route payload

## Current contract

**Scope** — the chrome and the failure surfaces every route inherits:
`features/shell/` (left nav rail + mobile nav; `navModel.ts` declares the
modules, each page's section anchors and `UNLISTED_ROUTES`; `isBareRoute()` opts
out the landing, `/admin` and `/rentgen`), `app/layout.tsx`,
`app/not-found.tsx`, the two error boundaries, `app/robots.ts` and
`app/sitemap.ts`.

**Standing rules.**

- **Pages must NOT draw their own logo** — the rail owns it.
- `navModel` is the single declaration: it feeds the rail, the section anchors,
  `publicRoutes.ts` and through it the sitemap, and the known-segment set
  `/overeni` matches against. A page in the rail is a page in the sitemap.
  Module identity (`brandName`) lives here too — deliberately not in the message
  catalogs, because "CivicScore" does not translate.
- **404 is not an outage.** `not-found.tsx` distinguishes a record that does not
  exist from a source that could not be read, and its doors are keyed by WHAT
  the reader was looking for (MP to /zebricek, law to /zakony, firm to /penize,
  town to /rozpocty, citation to /overeni), never a bare "back home". It is a
  SERVER component with zero client JS, and it **prints no status numeral**:
  Next returns 404 only for non-streamed responses.
- **Never claim a report was sent.** Sentry is env-gated to a silent no-op
  without `NEXT_PUBLIC_SENTRY_DSN` and this repo has none; the boundaries show
  the digest and a sentence that is true with or without a DSN.
- Root `lang="cs"` stays — it is the document's DEFAULT language and the locale
  is unknowable in `global-error`. What must hold is that **every English
  fragment carries `lang="en"`**, including halves inside bilingual lines.
- Base URLs come from request headers (sitemap, the robots `Sitemap:` line, the
  four feeds): honest localhost in dev, the field omitted with no host, **never
  a guessed domain**.
- **The chrome must not drag the mock catalog.** `sidebarParts.tsx` loads on
  every route; importing `MODULES` from `lib/civic/data.ts` for one lookup
  shipped invented people and firms into an anti-disinformation product's every
  page. Honest limit: 8 of 23 routes are clean — 15 still carry that chunk
  through their OWN importers.
- A font that is preloaded must be rendered by something. `font-serif` falls
  back to the system serif, and `docs/DESIGN.md` section 2 says so.

## Dated record

**App shell — the failure surfaces and what every route ships (2026-08-13).**
Three surfaces a reader meets only when something has gone wrong, all careless in a
product careful everywhere else. **There was no 404 page at all**: the repo had no
`app/not-found.tsx`, so twelve `notFound()` call sites (`/poslanec/[id]`,
`/zakony/[cislo]`, `/zakony/predpis/[ref]`, `/penize/[pspId]`(+`/paket`),
`/penize/firma/[ico]`, `/rozpocty/[ico]`, `/kraj/[kraj]`, `/zdroj/[ref]`,
`/graf/p/[ref]`, `/dashboard/exponat/[id]`, `/plakat/[view]`) — and every mistyped
address — answered with Next's built-in **English** „This page could not be found.",
system-font, no way out, inside the Czech root layout. The new page is a SERVER
component (zero client JS) rendering its own `<main>` inside the layout so the rail
survives, catalog-driven in both locales, and its core job is the distinction
`DataUnavailable.tsx` was written for: **„záznam neexistuje" ≠ „zdroj se nepodařilo
přečíst"**. Its doors are keyed by WHAT the reader was looking for (MP → /zebricek,
law/tisk → /zakony, firm → /penize, town → /rozpocty, citation → /overeni), not
„back home". **It deliberately prints no status numeral**: Next returns 404 only for
non-streamed responses, so typesetting „404" would assert something false for part of
the traffic — the status belongs in the header, not the typography. Both error
boundaries stopped claiming „Hlášení jsme odeslali" / „A report has been sent":
Sentry is env-gated to a silent no-op without `NEXT_PUBLIC_SENTRY_DSN` and this repo
has none, so the sentence was plausible-but-false at the exact moment a reader's
trust is already dented. What replaced it is the digest plus a note that is true with
or without a DSN. `global-error`'s `lang` was corrected the RIGHT way round: root
`lang="cs"` stays (the root lang is the document's DEFAULT language, Czech is the
primary voice, and the locale is unknowable there) — what was broken is that **only 2
of its 7 English fragments carried `lang="en"`**; every one does now, including the
halves inside bilingual lines, via class-less `<span>`s that change no pixel.
`app/robots.ts` finally publishes `Sitemap:` (base from request headers like
`sitemap.ts` and the four feeds — honest localhost in dev, **never a guessed domain**,
and the field is omitted entirely with no host).
**And the rail stopped shipping invented people.** `features/shell/sidebarParts.tsx`
imported `MODULES` from `lib/civic/data.ts` for ONE `.name` lookup, dragging the whole
mock catalog — „Petra Nováková", „Karel Hruška", „Silnice MSK a.s." / IČO 258 41 991,
„Agrofond s.r.o." / 470 12 336, „2,1 mld Kč" — into a chunk the layout loads, i.e.
everywhere, in an anti-disinformation product. The rendered half of this fell
2026-08-11; the SHIPPED half only now. Module names are declared in
`features/shell/navModel.ts` (new `brandName`), which already owns the module list —
a third file would be a third declaration of module identity — and deliberately NOT as
a catalog key, because „CivicScore" does not translate and both catalogs would hold
the same string until a translator localized one. Measured by a controlled A/B over
two real webpack builds differing in that one expression, read from `<script src>` in
the SERVED HTML (the client-reference manifest is a global superset and cannot answer
„what does this route load"): `/podminky` `/ochrana-osobnich-udaju` `/atlas`
`/overeni` `/data` `/denik` each **−14 652 B**, chunk 975 gone. **Honest limit, not a
clean sweep: 8 of 23 routes are clean; 15 still carry it through their OWN importers**
(landing `SystemModules`, `/svedectvi` `CHAMBER_STATS`, `/dashboard` `CHAMBER_TREND` +
`graphText`, `/hlasovani` `ROLL_CALLS`, `/kompas` → `clubStyle` → `CLUB_DISPLAY`,
`/rentgen`, `/penize` + `/zakony` via `Mock*`). What was removed is the CHROME's
dependency — precisely the standing limit the /penize and /dashboard code-splitting
passes each recorded as unfixable from inside a feature. Same pass: **Fraunces was
`rel=preload`ed on every route and rendered by nothing** — one repo-wide grep hit, its
own declaration — costing 67 388 + 59 540 = **126 928 B, 46,9 % of the 270 316 B
preloaded font payload, for zero glyphs**. Removed: preloaded **270 316 → 143 388 B**,
all font files **358 908 → 212 232 B (−40,9 %)**. The `.font-serif` utility stays and
falls back to Tailwind's system serif — honester than a token pointing at a face that
is not loaded — and `docs/DESIGN.md` §2's „reserved" claim is corrected in the same
change (a reserve that ships is not a reserve). No appearance or a11y change: all five
brands render byte-identically in cs and en, and `sidebarParts.test.ts` +
`a11y.test.ts` pass with **no assertion edited**.

**2026-08-27 — NAV module `volby` (spark election-replay).** `/volby` is a
sixth top-level module (brandName „Volby"); `/kraj` and `/kompas` are listed
under it a second time while their original parents keep `entryFor`
precedence, and `/volby/snemovna` is a child because the sitemap reads NAV.
`sidebarParts.test.ts` pins six modules and asserts `volby` is deliberately
absent from `lib/civic` MODULES — the surface has no sample-data fallback.

## 2026-09-04 — /admin: the review gate, one question asked the same way (G2, deck #5)

`ReviewHubSection` had four panels, each answering a different question in a
different shape: ties by tier, forensic verdicts by severity, lead dossiers,
audit decisions by reviewer. None of them made the actual finding legible —
that three of those populations were in the hundreds with a decided count of
**zero**, because no writer for them existed anywhere in the tree.

A per-kind coverage table now sits above the four: **decided / pending / total /
audit rows**, one row per claim kind, all counts, no rate. A rate is precisely
the number that hides how big the population is, and the population is the
finding.

Two rules the table exists to keep:

- **A kind with no writer says so.** `tripwire` and `lead` carry a „bez
  zapisovatele" marker. A queue nobody has worked and a queue that CANNOT be
  worked look identical in the numbers, and an operator must not have to guess
  which one they are reading.
- **Audit rows may exceed decisions, and that is not an error.** A claim can be
  decided, reversed with a stated reason, and decided again; every step is its
  own chained row. The source note says so rather than letting the two columns
  look like a bug.

The effort denominator is CLAIMS, not people: one MP can carry three verdicts
(`effort_low_score_reason`, `effort_rapporteur_load`, `effort_workhorse`) and
each is decided on its own address (`psp:person:<id>#<prop>`).

`getAdminData`'s forensic block also stopped defaulting an absent
`forensic_review_state` to `"pending_review"` — the same fabrication removed
from `getLawData.ts` in this change, which had been sitting in two places.

**Carry-over, named rather than implied.** The table is a BOARD, not yet a
queue: it has no decision buttons and no server action. The two-phase confirm
(the `LoopMissionControl` pattern) and posting through the one writer with the
existing `REVIEWER_TOKEN` / `ADMIN_TOKEN` gates are the next slice. Until then
the door is reachable only from the repository, and this record says so rather
than letting an operator infer a queue from a table.
**2026-09-04 — degradations become answerable (moonshot #26).** This file has
said plainly that `Sentry.captureException` is a no-op here because the repo has
no DSN. Together with `console.error`, that was the entire sink list for
`reportLoaderFailure` — **121 call sites** whose evidence scrolls off a terminal
and vanishes into a disabled reporter. So the operator's actual question — which
surfaces fell back to mock in the last 24 hours — had no answer anywhere, and
the loader convention's own failure mode is exactly that invisibility: a dead
store is indistinguishable from an empty graph.

`lib/db/loaderFailureLog.ts` adds a third sink: a bounded JSONL sidecar at
`.data/loader-failures.jsonl` (newest 2 000 lines; the summary reports what it
counted, not what ever happened). `/admin` "Stav systému" renders the 24 h
roll-up — total, the loaders that degraded, the last instant — with its source
path printed beside it, and the sentinel reads it as the `loader-degradations`
check.

Two rulings, both about not collapsing distinctions:

- **An absent log is not a clean one.** `summarizeLoaderDegradations` returns
  `null` for a missing file and `{ total: 0 }` for a present, empty one. Missing
  means nobody was watching; empty means somebody was and nothing happened. The
  strip says so in words, and the sentinel maps the first to `unevaluable` —
  never `ok`.
- **The append never throws.** It is the one writer in this repo that runs
  inside a `catch` block, and the file it is logging to is not the thing the
  reader came for. A throw there would convert an honest fallback into a crash —
  an observability feature causing an outage. It reports its own failure to
  stderr once per process instead, so it is silent about the LOG and never about
  the degradation: the `console.error` line the reporter already prints is
  unconditional.

**2026-09-05 — the retry button called `undefined` (scan-sweep, bounty-hunter).**
Both boundaries destructured `unstable_retry`. Next 16.2 passed that prop; 16.3.0
stabilised it as `retry` and stopped passing the old name (error.md „Version
History"; the runtime hands the fallback `reset: this.reset, retry: this.retry`
and nothing else). Since the 16.3.1 upgrade every „Zkusit znovu" on `/error` and
`global-error` threw a TypeError inside the surface whose job is to lead the
reader OUT of an error — and nothing could catch it: Next exports no prop type
for `error.tsx`, so `tsc` accepted any name, and the repo has no jsdom to click
the button. Fixed at the source in both files and pinned by
`features/shell/errorBoundaryProps.test.ts`, which reads the prop name FROM the
installed runtime rather than from a copied string: the next rename fails there,
not at a reader. The two files were a pair fixed together, which is the whole
point of checking pairs — the same bug in `global-error` would have survived a
fix to `error.tsx` alone.

**2026-09-05 — two rationale claims corrected (scan-sweep, copy-auditor).**
`sitemap.ts` justified listing the 360 municipalities partly with „Next already
pre-generates these pages"; `app/rozpocty/[ico]/page.tsx` had measured on
2026-09-01 that nothing is pre-generated (the locale cookie makes every route
dynamic). The listing stands on the two reasons that hold — a static registry,
no store read — and the comment now says so, with the „already" retracted.
`robots.ts` opened with a sentence missing its predicate; it now states the
file's job.

**2026-09-05 — a sitemap with no host is empty, not relative (scan-sweep,
state-coverage).** The standing rule above said the base is never guessed and
the robots `Sitemap:` line is omitted without a host — but `sitemap.ts` in the
same state emitted 387 relative `<loc>` entries, which the sitemaps.org protocol
does not define (every location must be fully qualified). It now returns an
empty list, and `features/shell/sitemapRoutes.test.ts` pins the address SHAPE
for both files (https behind a forwarding proxy, honest http in dev, root with
its trailing slash, nothing without a host) the way `publicRoutes.test.ts` pins
the path SET.

**2026-09-07 — the chrome draws its logo once (scan-sweep, parity-auditor).**
`MobileNav` carried a byte-identical copy of `BrandBlock`'s mark SVG; a change to
the mark would have needed two edits and a missed one would have shipped two
logos. `BrandMark` in `sidebarParts.tsx` is now the single drawing, sized by
`className` (h-7 on the rail, h-6 on the mobile strip). `shellSource.test.ts`
counts one `viewBox="0 0 32 32"` in the shell.

**2026-09-07 — every catalog key the nav model names is checked against both
catalogs (scan-sweep, test-strategist).** `NAV` and `PAGE_SECTIONS` are hand-kept
lists of `labelKey`/`tagKey` strings that the rail renders through `t()`; a key
absent from `messages/{cs,en}.json` renders as the bare key. Three feature tests
guarded their own anchors (/hlasovani, /rozpocty, /volby — 17 of 52 keys); the
rail rows, /dashboard, /zebricek, /penize, /zakony and /poslanec had no guard.
`navModel.test.ts` now resolves all 52 against both catalogs (0 missing today;
the guard was verified red by mutating one key).

**2026-09-08 — robots and the sitemap read the tree's one live-URL definition
(scan-sweep, parity-auditor).** Both files spelled `host` + `x-forwarded-proto`
themselves (the third and fourth copies beside the feeds and the poster, all
defaulting to `http`) while `lib/routing/liveUrl` has been the single definition
since 2026-09-07. Both import it now; `sitemapRoutes.test.ts` still pins the
address shape on both sides (https behind a proxy, http in dev, empty without a
host), and `lib/testing/appShellSource.test.ts` pins that the two files carry no
copy. The same test pins two more pairs: every path in `DISALLOWED_PATHS` has a
page declaring `robots: { index: false }` (three today), and the error boundaries'
11 px red kicker and paper-text hover buttons use `signal-deep` (5,31:1), not
`signal` (4,10:1, under AA for text below 18,66 px) — `app/error.tsx` had the
kicker wrong and both boundaries hovered onto bare `signal`.
