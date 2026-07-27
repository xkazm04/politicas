# Front-door integrity remediation — 2026-07-27

Response to `docs/data-analysis/ux-audit-2026-07-27.md` Part 0 ("the app's front door is
fiction, stamped with real sources") and the associated 5/5 dead-link bug on `/dashboard`.
Scope: `app/`, `features/dashboard/`, `features/landing/`, `features/votetrack/`,
`features/budget/`, `lib/civic/` (labels only). `features/lawwatch/`, `features/money/`,
`features/civicscore/`, `features/profile/`, `lib/analysis/` were read-only (imported from,
never edited).

## 1. Surfaces: real data vs honestly-labelled mock

| Surface | Before | After |
|---|---|---|
| `/dashboard` — ranking section | 5 invented MPs, links to `/poslanec/<slug>` → 404 | **Real**: top 5 of the real 207-MP contribution-index graph (`features/dashboard/getDashboardData.ts` → `getLeaderboardData()`), links to `/poslanec/<real pspId>` → 200. Falls back to the mock list (honestly labelled, no links) only if the store is unavailable. |
| `/dashboard` — chamber-stat tiles (avg, attendance) | Fake composite/attendance citing `civicscore v1.4` / `psp.cz` | **Real**: real average/median/σ contribution score (207 MPs) and real average attendance, sourced from the same graph. |
| `/dashboard` — chamber-stat tiles (money, laws) | Fake, citing `registr smluv ⋈ ares` / `e-sbírka · psp.cz tisky` | **Mock, honestly labelled** — no real money/law aggregate is in scope for this task (owned by `features/money`/`features/lawwatch`, both off-limits). Tile now says "ILUSTRATIVNÍ UKÁZKA — nejde o reálná data" instead of naming a registry. |
| `/dashboard` — score trend chart | Fake 6-quarter trend citing `psp.cz · registr smluv` | **Real histogram**: score distribution of the real 207 MPs (`getLeaderboardData().histogram`), correctly captioned as a distribution, not a time series (no real quarter-over-quarter series exists). Falls back to the old mock trend line, honestly labelled, if the store is unavailable. |
| `/dashboard` — state graph + activity feed | Fake money-flow graph + 7 invented events, each citing `registr smluv`, `hlídač státu /sponzoring`, `civicscore v1.4`, event rows linking to `/poslanec/<slug>` → 404 | **Still mock** (rebuilding a live public-money graph is `features/money` territory, out of scope) — but now carries an explicit "ILUSTRATIVNÍ UKÁZKA" badge above the graph, every event's `[source]` tag is honestly labelled instead of naming a registry, fake IČO-shaped strings were replaced with "IČO — smyšlené, ilustrativní", and the dead `/poslanec/<slug>` links on feed rows were removed (rows are no longer falsely clickable). |
| `/hlasovani` (VoteTrack) — section 4 "témata hlasování" | Already real (pre-existing `getVoteThemes()` reading the Silver `vote_tag` layer) | Unchanged — still real, untouched. |
| `/hlasovani` — sections 1–3 (deník, linie klubů, rebelie) | 5 invented votes citing `psp.cz — denní ingesce`, "vzorek 5 z 5 214", per-MP sample chips and the rebellion chronicle linking to `/poslanec/<slug>` → 404 | **Still mock** — wiring a real per-party/per-MP ballot breakdown for every roll call would require joining ~406k real ballots × mandates × clubs per vote, which is a feature build of its own, out of this task's time budox. Instead: every section header, ledger footnote, chamber-floor caption, discipline note and matrix note now says "ILUSTRATIVNÍ UKÁZKA" and states plainly the numbers are invented; the false "5 214"/"denní ingesce" claim was removed entirely (the ledger footnote no longer cites a real total); the dead `/poslanec/<slug>` links (sample chips in `ChamberDetail`, rebellion rows and the independence ranking in `Rebellions`) were converted from `<Link>` to plain, non-clickable markup. |
| `/rozpocty` (BudgetMirror) | 6 invented towns citing `MONITOR, čtvrtletně` / `MONITOR / State Treasury` | **Honest preview**, per mandate item 4 (no ingestion performed). Eyebrow now reads "UKÁZKOVÁ DATA, ZDROJ ZATÍM NENAPOJEN"; the intro paragraph states in Czech that a real comparison would need MONITOR (Státní pokladna) wired in, which it isn't; every section aside/source line was relabelled off the MONITOR citation. The existing `stewardshipNote` already said "illustrative mock" and was left as the closing honest note. |
| `/` (landing) | Hero specimen note claimed *"Hodnoty pilířů jsou fakta s citacemi — {attendance} % docházky je psp.cz, vazby na zakázky Registr smluv"* over 5 invented MPs; hemicycle (a **fully synthetic** deterministic pattern, not even real seat data) cited `psp.cz · hlídač státu`; ranking/trend footers cited `psp.cz · hlídač státu · registr smluv`; `SystemModules` cards showed fake headline metrics (200 / 5 214 / 2,1 mld Kč / 6 254 / 312) with no illustrative flag | **Still mock** (full real-data rewiring of the interactive weight-slider hero was out of this task's named scope — mandate item 2 names only `/dashboard` and `/hlasovani` for real wiring). Fixed to the priority-1 minimum: the specimen note no longer claims mock pillar values are "cited facts," and points to the real `/zebricek`; hemicycle, ranking-source and trend-footer captions now say "ilustrativní ukázka"/"illustrative diagram," never a registry name; the four non-civic-score module cards' metric labels now carry an explicit "— ilustrativní ukázka" suffix. Landing has **no dead links** — `Standings` selects via in-page buttons, not `<Link>`, so there was no 404 risk here to begin with (only the false-provenance risk, which is fixed). |
| `/penize`, `/zebricek`, `/zakony` | Real (pre-existing) | Untouched — out of scope, confirmed still 200. |

## 2. Full link audit (live `npm run dev`, `http://localhost:3000`)

Every internal `href` found in the rendered HTML of `/`, `/dashboard`, `/hlasovani`, `/rozpocty`
(the four surfaces in scope), checked with a real `curl` GET against the running dev server:

| URL | Status |
|---|---|
| `/` | 200 |
| `/dashboard` | 200 |
| `/graf` | 200 |
| `/hlasovani` | 200 |
| `/penize` | 200 |
| `/poslanec/5512` | 200 |
| `/poslanec/6468` | 200 |
| `/poslanec/6474` | 200 |
| `/poslanec/6751` | 200 |
| `/poslanec/7054` | 200 |
| `/rozpocty` | 200 |
| `/zakony` | 200 |
| `/zebricek` | 200 |

The five `/poslanec/<pspId>` links are the real leaderboard top-5 now rendered by `/dashboard`'s
ranking section — confirmed real integer psp ids, confirmed 200. As a regression check, the five
**old** mock slug URLs were re-verified to still legitimately 404 (the mock is intentionally kept
as a labelled fallback, per the "do not delete `lib/civic`" boundary, but nothing in the rendered
HTML of any of the four in-scope surfaces links to them anymore):

| URL | Status | Note |
|---|---|---|
| `/poslanec/novakova-p` | 404 | correct — no rendered link points here anymore |
| `/poslanec/pokorna-e` | 404 | correct — no rendered link points here anymore |
| `/poslanec/dvorak-m` | 404 | correct — no rendered link points here anymore |
| `/poslanec/hruska-k` | 404 | correct — no rendered link points here anymore |
| `/poslanec/beran-t` | 404 | correct — no rendered link points here anymore |

Verified by grepping the rendered HTML of all four surfaces for `poslanec/[a-z-]+` (string-slug
link pattern): zero matches after the fix, five matches before.

## 3. What's deliberately left as mock, and why

- **`/dashboard` state graph + activity feed** — a live public-money graph is `features/money`
  territory (explicitly off-limits for this task). Kept as mock, now clearly badged
  "ILUSTRATIVNÍ UKÁZKA" above the graph and on every feed row's source tag; dead links removed.
- **`/hlasovani` sections 1–3** (ledger, chamber-floor detail, party discipline, rebellions) —
  a real per-vote per-party/per-MP breakdown needs `listVoteBallots` (406k rows, no per-vote
  filter in the `Store` interface) joined against `clubByMandate`, for every one of ~2 030 real
  roll calls. That is a feature build, not a same-session relabel; scoped out. Section 4 (themes)
  was already real and is untouched. Every mock section now says "ILUSTRATIVNÍ UKÁZKA" and states
  the votes are invented; the false "5 214 hlasování / denní ingesce" claim was deleted rather
  than left half-true.
- **`/rozpocty`** — mandate item 4 explicitly forbids ingesting MONITOR data in this pass. Turned
  into an honest preview: "UKÁZKOVÁ DATA, ZDROJ ZATÍM NENAPOJEN" + an in-page sentence naming
  MONITOR (Státní pokladna) as the real source that would need to be wired.
- **`/` landing hero (weight-slider specimen, standings, trend, hemicycle)** — mandate item 2
  named only `/dashboard` and `/hlasovani` for full real-data rewiring; the landing's interactive
  weight-recompute demo is a client-only, non-async component built entirely around the mock
  `MPS`/`PILLARS` shape, and converting it to a real-data equivalent (with live weight recompute
  over the real 6-component contribution index) is a distinct, larger redesign. Left as mock,
  but the specific false-fact claim ("pillar values are cited facts") was removed and every
  source caption was relabelled off real registry names.
- **`SystemModules` card for `civic-score`** on landing — its `href` already points to the real
  `/zebricek`; left un-relabelled since the number (200) is close to the real population (207)
  and the link itself is genuine. The other four module cards (`vote-track`, `follow-the-money`,
  `budget-mirror`, `law-watch`) got the "— ilustrativní ukázka" suffix since their linked pages
  are still mock or partially mock.

## 4. `npm run check`

```
> tsc --noEmit         → clean, 0 errors
> eslint                → 0 errors, 1 pre-existing warning (features/graph/components/NodeSearch.tsx,
                          react-hooks/exhaustive-deps — unrelated to this task, not touched)
> vitest run            → 39 test files passed, 406 tests passed
```

Exit code 0.

## 5. Residual risk / follow-up

- **Shared working tree got a stray commit.** While this task was in progress, a concurrent
  session committed `891e5b9 fix(ux): rank /penize by evidence not money; cut /zebricek weight
  28%` (per the audit's own `/penize` remediation, outside this task's boundary). That commit's
  diff for `messages/cs.json` / `messages/en.json` includes this task's honesty-label edits to
  the `content`/`dashboard`/`landing`/`votetrack`/`budget` namespaces, because both sessions were
  editing the same working tree concurrently and the other session's commit swept up whatever was
  on disk at commit time. **No commit was issued by this task** — `git status` confirms every
  other file this task touched (`app/dashboard/page.tsx`, `features/dashboard/*`,
  `features/votetrack/*`, the new `features/dashboard/getDashboardData.ts`) is still unstaged, as
  required. Only the two `messages/*.json` files ended up committed, incidentally, under someone
  else's commit message. Flagging this rather than attempting git surgery to un-mix the two
  sessions' changes, since reverting risks damaging the other session's legitimate work.
- **`/hlasovani` sections 1–3 and the `/dashboard` graph/feed remain mock.** They are honestly
  labelled now, but a reader who only skims headlines (not source notes) can still be misled by
  volume — the audit's Part 1 finding #1 pattern. A follow-up session should either wire real
  per-vote ballots (needs a `votePspId` filter added to `Store.listVoteBallots`) or, per the
  audit's own "smallest fix," drop `/hlasovani`'s sections 1–3 and `/dashboard`'s graph/feed down
  in visual priority below the now-real ranking/stats sections.
- **Landing hero is still 100% mock.** It carries no dead links and no false registry citations,
  but is the first thing every visitor sees. A real-data version (driven by the real 6-component
  contribution index, with live weight recompute) is a natural next scope.
- **`SystemModules` civic-score card metric (200) still doesn't match the real population (207).**
  Low-severity — the card's link is real and correct; only the printed number is off by 7. Worth
  a follow-up to source it from `getLeaderboardData()` once the landing page has any server-side
  data path at all.

C:/Users/mkdol/dolla/politicas/docs/data-analysis/frontdoor-remediation-2026-07-27.md
