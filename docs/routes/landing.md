# / — landing

`/` — landing (features/landing). Konstrukt. **REAL since `0e8410c`** — the
hero ranking, hemicycle and specimen ride `getLeaderboardListData()` (the
same loader as /zebricek, trimmed to what the page draws); `null` renders an
honest degraded state, never the mock. A 2026-07-29 `/impeccable` experiment
built four alternative landing worlds behind a switcher (bolder · distill ·
a ledger/registry world · typeset) and **all four were rejected and
deleted** — do not rebuild them; the comparison and the reasoning are in
`docs/design/impeccable-pass-02.md`. What survived is the accessibility
work, which is merged and staying: `SourceNote` sets a citation by measured
LENGTH rather than role, the `steel-aa` / `signal-deep` tokens pass WCAG AA
where `steel` / `signal` sat at ~4,1:1, and the landing is contrast-clean
(135 → 27 detector findings, 0 contrast failures).
**The façade cites measured sources (2026-08-12).** The „Surový materiál"
section rendered seven SAMPLE cadences from `lib/civic/data.ts` („denně",
„téměř real-time"…) under „ověřené veřejné zdroje" with zero SourceNote — on
the page whose brand is that every number cites its source. It now reads
`getAtlasReport()` through the pure projection `features/landing/
sourceStates.ts` (nothing recomputed: coverage IS the atlas dimension score;
unrated is `null` + a word, never 0; order is the atlas's own), cites
/atlas, degrades independently of the leaderboard layer, and the mock
`SOURCES` + `content.sources.*` catalog block are deleted. Three falsifiable
literals fell in the same pass (`meta.rootDescription`'s „index efektivity
… každého politika" → contribution index over 207 MPs of PSP10;
`landing.methodBody`'s „citace u každého pilíře" + „verzované váhy";
ReferendumTeaser's hand-typed weights prose — now derived from
`PUBLISHED_WEIGHTS`, with „207" guarded on data presence). The flagship
score claim reached the two highest-traffic surfaces: LiveSpecimen and the
/zebricek Souboj mint the composite through the ONE `scoreClaim.ts` stamp,
withheld under a reader's custom lens WITH the withholding stated
(`krajLensNoClaim` reused, not forked). `features/landing/messages.test.ts`
pins all of it. **And the façade works for every reader (2026-08-12):**
`.k-range:focus-visible` draws the app's cobalt ring (the sliders were
keyboard-invisible, WCAG 2.4.7 — the fix also repairs /zebricek's
WeightPanel), and HeroStory / Hemicycle / SystemModules gate on
`useReducedMotion` like every sibling surface; `motion.test.ts` pins both
by source-grep (no jsdom here), each guard verified by falsification.
**The façade got lighter and stopped over-promising (2026-08-12).**
recharts left the critical parse path: `ScoreBreakdown` loads via
`next/dynamic` (NO `ssr:false` — the chart still server-renders), so the
116,7 kB gz / 27 % of first-load that every reader paid for a chart drawn
only when `data && mp` now loads lazily (post-change build measured: the
landing's 9 referenced client chunks, 344 342 B raw, carry zero recharts
markers). `SectionRule` — the repo's most-mounted moving component, 65
mounts / 20 pages — finally honours `useReducedMotion`, and `motion.test.ts`
now DERIVES a shared-component scan from the landing's own imports, so a
moving catalog component can't escape the rule at the folder boundary again.
`landing.lead` narrowed to what the loaders measure (no „každá koruna", no
„každý politik"; pinned cs+en). /referendum's hardcoded 207 above its own
null guard fell in both places (page prose + OG description). The embed's
„stav k" dates the DATA — the chamber aggregate's `computedAt`, with a
mixed chamber stating it cannot date the recompute and naming no pass —
while the deploy instant stays beside it labelled „vysazeno" (it used to
BE the „stav k" date: every widget load advertised today over batch data).
`DenikTeaser` takes the Prague day as a SERVER prop (`pragueDay` computed
in app/page.tsx, crossing as data — the browser's UTC day was exactly the
bug pragueDay.ts was written to kill), cites all FOUR sources
(+ change_event), and discloses the FEED_ENTRIES cap beside the day count.
**The teasers speak both languages, without waiting (2026-08-12).**
DenikTeaser stopped client-fetching the force-dynamic 58 kB
/denik/feed.json post-hydration („Zápis se načítá…" flash): `DenikSlot`
(server-only, the RebellionSlot pattern) reads `getDenikData()` +
`deriveDenikEntries` — the SAME FEED_ENTRIES cut the feed serializes —
inside `<Suspense>` in app/page.tsx, deliberately OUTSIDE the page's
`Promise.all` (getDenikData is TTL-memoized but not react.cache()d, ~12 s
cold; the shell ships immediately, the rubric streams — verified live).
The 35 hardcoded Czech strings fell: DenikTeaser (12), ReferendumTeaser
(17) and `LENS_PRESETS` (6 — now `labelKey`/`noteKey` message KEYS with a
closed `LENS_PRESET_COPY_KEYS` list, translated at BOTH render sites
incl. WeightPanel), including two Czech aria-label landmarks in the
lang="en" document; `hardcodedCopy.test.ts` is the falsified source-grep
guard against regrowth. Two falsifiable claims retired: `joinKeyDesc`
stopped selling a subsidy↔donation JOIN (IČO joins firm↔contracts;
subsidies/donations are per-company totals, not joinable records — the
follow-the-money module description aligned too), and `methodBody`'s
„otestováno celý volební cyklus" (first commit 2026-07-23) is replaced
with a claim the repo can carry, both pinned. The 10 dead
`content.modules.*.feeds` strings (four-pillar-era claims) are deleted
from both catalogs along with the dead `MODULES[].feeds` field itself.
