# Combined Scan Fix Wave 7 — Landing & Navigation

> 5 commits, 5 findings closed (1 partially — CTA reachability, not full mobile menu).
> Baseline preserved: 0 TS errors → 0 TS errors, 352→355 tests (added 3) → 355/355, `eslint .` clean throughout.

## Commits

| # | Commit | Findings closed | Severity | Files |
|---|---|---|---|---|
| 1 | `0d1601b` fix(shell): reset section-spy state synchronously on navigation | app-shell-navigation.md #1 | High | `features/shell/useActiveSection.ts` |
| 2 | `76294fa` fix(shell): close mobile nav drawer on any pathname change | app-shell-navigation.md #2 | Medium | `features/shell/MobileNav.tsx` |
| 3 | `5efab86` test(civic): pin SOURCES/translation-catalog alignment for DataSources.tsx | landing-page.md #1 | High | `lib/civic/dataSources.test.ts` |
| 4 | `8a191c6` fix(landing): key ScoreBreakdown's stacked bars by pillar key, not label text | landing-page.md #2 | High | `features/landing/components/ScoreBreakdown.tsx` |
| 5 | `b9ce7f9` fix(landing): keep the dashboard CTA reachable from the header on mobile | landing-page.md #3 (partial) | High | `features/landing/components/SiteHeader.tsx` |

## What was fixed (grouped by sub-pattern)

1. **Stale state surviving a synchronous render (app-shell #1)** — `present`/`active` were reset only inside a `requestAnimationFrame` callback, so the render immediately after a route change used the previous page's stale section-id Set, visibly flashing the "on this page" nav block empty on every navigation between modules. Fixed using React's "adjust state during render" pattern (a `prevKey` ref compared during render) rather than a `setState`-in-effect, which the codebase's own `react-hooks/set-state-in-effect` lint rule flags — this pattern recurred for the MobileNav fix too.

2. **State not synchronized to the URL (app-shell #2)** — the mobile drawer's `open` state was only ever set to `false` from in-panel click handlers, never from a pathname change, so back/forward navigation left it visibly open over a page the user didn't navigate to via the menu. Same during-render reset pattern.

3. **A silent two-file content coupling with no verification (landing-page #1)** — `DataSources.tsx` iterates `SOURCES` purely for its length while pulling all visible text from a translation catalog by positional index; nothing checked the two stayed in sync. Rather than restructure the JSON keying (higher risk, touches two locale files' content), added a test that pins the invariant the component actually depends on — a future drift now fails loudly in CI instead of shipping as silently misaligned card content.

4. **Rendering identity coupled to display text (landing-page #2)** — `ScoreBreakdown`'s stacked-bar data was keyed by the *translated* pillar label; two pillars sharing a translated label in any future locale edit would silently collide via `Object.fromEntries`. Rekeyed by the stable `p.key` enum, with the label passed only via `<Bar name>` for tooltip display.

5. **A responsive cutoff with no mobile alternative (landing-page #3, partial)** — the entire header nav (anchors + primary CTA) vanished below the `lg` breakpoint with nothing replacing it. A full mobile drawer is a feature addition, not a bug fix, so this wave applied the fix sketch's minimum-viable option: the "enter dashboard" CTA — the primary conversion path — now stays visible at every breakpoint; the section-anchor tabs remain `lg`-only since they only make sense in the wide poster layout they were designed for. The broader "add a real mobile nav menu" work is deferred (see below).

## Verification table (before/after counters)

| Check | Before wave | After wave |
|---|---|---|
| TypeScript errors | 0 | 0 |
| Tests passing | 352/352 (36 files) | 355/355 (37 files) |
| `npx eslint .` (full repo) | clean | clean after every commit |

## Cumulative status (across all waves so far)

- **Wave 1**: 5 findings closed — Theme A, Review-Gate Race Conditions & Data Trust.
- **Wave 2**: 9 findings closed — Theme B, Silent Numeric Failures.
- **Wave 3**: 4 findings closed — Theme C, Money/Graph Data-Integrity Mismatches.
- **Wave 4**: 5 findings closed — Theme D (part 1), Ingestion Normalization Hardening.
- **Wave 5**: 3 findings closed + 1 verified-not-applicable — Theme D (part 2), PGlite Backend Robustness.
- **Wave 6**: 5 findings closed — Theme E, Custom ESLint Rule False Negatives.
- **Wave 7 (this wave)**: 5 findings closed (1 partial) — Theme F (part 1), Landing & Navigation.
- **Running total**: 36/125 findings closed (35 full + 1 partial), 1 verified false-positive.
- **Deferred**: landing-page.md #3's full scope (a real mobile drawer/menu reusing the NAV array) — a feature addition, not a bug fix; the CTA-reachability half is closed.
- Remaining: ~85 findings across themes F (remainder)–J.

## Patterns established (additions to the catalogue, item 16)

16. **"Adjust state during render" beats "reset in an effect" for any prop-driven reset** — this wave needed the exact same fix shape twice (useActiveSection's `present`/`active`, MobileNav's `open`) for the same underlying reason: a piece of local state needs to reset the instant a prop/derived key changes, before the next paint, without triggering a second render pass. React's documented pattern (track the previous prop value in state, compare during render, call setState conditionally in the render body) satisfies both "reset before paint" and this codebase's own `react-hooks/set-state-in-effect` rule — reach for it by default over `useEffect(() => reset(), [dep])` whenever the reset must be visible in the SAME render as the prop change, not one render later.

## What remains

Theme F (remainder — Velin Dashboard, MP Profile Dossier, CivicScore, VoteTrack, LawWatch, BudgetMirror UI/data findings), G (graph/canvas robustness), H (shared primitives & bootstrap remainder), I (legislative-data correctness remainder), J (test/tooling coverage) are all still open — see `INDEX.md` for the full per-theme breakdown.
