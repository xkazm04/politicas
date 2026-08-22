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
