# Shared Display Primitives — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. AnimatedScore silently renders "NaN" when upstream data yields a non-finite value
- **Lens**: Bug
- **Severity**: High
- **Category**: silent-failure / edge-case
- **File**: features/shared/components/AnimatedScore.tsx:24-35 (compounded by lib/format.ts:14 `czech`)
- **Scenario**: Any call site that computes `score` or `delta` from a ratio (e.g. `votes / totalVotes`, an average over an empty array, or a value read from a temporarily-unavailable PGlite connection that resolves to `0/0`) can hand `AnimatedScore` a `NaN`. `animate(prev.current, NaN, …)` still runs; `onUpdate` receives `NaN`, `Math.round(NaN * 10) / 10` is `NaN`, and `czech(NaN)` → `"NaN".replace(".", ",")` → the literal string `"NaN"` is rendered in place of a civic score, on a component used across dashboard, profile, head-to-head and landing pages.
- **Root cause**: The component trusts `value: number` at the type level but has no runtime guard for non-finite numbers, and the default formatter (`czech`) performs no validation either — `toFixed` on `NaN` just stringifies the token instead of throwing, so the failure never surfaces as an error, only as wrong-looking text baked into a brand promise ("every number is honestly sourced").
- **Impact**: A transient upstream data problem (exactly the class of failure this app explicitly designs around, per `DataUnavailable`'s own doc comment about PGlite single-connection contention) turns into a literal "NaN" displayed as a politician's score — the opposite of the "never fabricate/never display broken numbers" rule the codebase otherwise takes seriously.
- **Fix sketch**: Guard in `AnimatedScore` (`Number.isFinite(value) ? value : prev.current` or render nothing) and/or harden `czech`/`czechInt` to fall back to an em-dash or the `SourceNote`-style unavailability marker when given a non-finite input, so a bad upstream computation degrades to "—" rather than "NaN".

## 2. Rapid successive value updates cause AnimatedScore to jump instead of interpolate smoothly
- **Lens**: Bug
- **Severity**: Medium
- **Category**: animation-cleanup / race-condition
- **File**: features/shared/components/AnimatedScore.tsx:26-34
- **Scenario**: `value` changes twice in quick succession (e.g. a live-refresh or two rapid prop updates from a parent re-render, such as `LiveSpecimen.tsx` or `HeadToHead.tsx` re-fetching). The first effect starts animating from `prev.current` (A) toward B and, critically, sets `prev.current = B` synchronously — *before* the animation has actually finished displaying B. If a second update to C arrives before that first animation completes, the cleanup calls `controls.stop()` (freezing `display` at whatever interpolated value it reached, call it A′, somewhere between A and B) but the new effect starts `animate(prev.current /* = B */, C, …)`, i.e. animates from B even though the visible `display` state is still A′.
- **Root cause**: `prev.current` is used as "the value we should animate from," but it is updated to the *target prop* rather than the *last rendered/interpolated display value*, so it silently desyncs from `display` whenever an animation is interrupted mid-flight.
- **Impact**: On any screen with fast-changing scores/deltas (dashboard live updates, filter changes re-triggering fetches), the number visibly snaps/jumps rather than animating smoothly, undermining the "living instrument" effect the component's own doc comment describes as the design intent.
- **Fix sketch**: Track the last-rendered value in a ref that is updated from `onUpdate`/`display` itself (or seed the next `animate()` call from `display` at effect-start via a ref synced in `onUpdate`), not from the incoming `value` prop, so restarted animations always continue from what the user is actually seeing.

## 3. RankDelta renders a false "declining" badge with "NaN" for a non-finite delta
- **Lens**: Bug
- **Severity**: Medium
- **Category**: edge-case / silent-failure
- **File**: features/shared/components/RankDelta.tsx:11-24
- **Scenario**: `delta` is computed by callers (`DashboardPage.tsx:209`, `Standings.tsx:43`) as a rank difference, e.g. `previousRank - currentRank`. If a person's previous rank is unavailable (new entrant, missing historical snapshot, a division that yields `undefined - number`), `delta` can be `NaN`. `delta === 0` is `false`, so execution falls into `up = NaN > 0` → `false`, and the component renders the **down/red** arrow with `aria-label` `t("rankDown", { n: -NaN })` and visible text `Math.abs(NaN)` → `"NaN"`.
- **Root cause**: The component has only a single explicit branch (`delta === 0`) and implicitly treats every other value as a signed non-zero number, with no `Number.isFinite` guard — so a missing/invalid input is coerced into "this politician's rank dropped by NaN places," a specific, colorable, confidently-wrong claim rather than an honest "no data" state.
- **Impact**: Because red = "signal"/attention-worthy in this app's visual language (per the component's own doc comment), a data gap is misrepresented as an actual negative ranking movement — a false civic claim about a real person, which is precisely the failure mode `DataUnavailable.tsx`'s doc comment says the brand rule forbids.
- **Fix sketch**: Add an explicit `Number.isFinite(delta)` (or `delta == null`) guard before the sign check that renders the same neutral `<Minus>` "no data" treatment (or a distinct dash) used for `delta === 0`, so unknown deltas never masquerade as measured ones.

## 4. SectionRule's entry animation can permanently fail to fire on short/no-scroll pages
- **Lens**: UI
- **Severity**: Low
- **Category**: missing-polish / animation-trigger-gap
- **File**: features/shared/components/SectionRule.tsx:14-21
- **Scenario**: `SectionRule` is used directly under page/section headings (e.g. `DataUnavailable.tsx:38`, `BudgetMirrorPage.tsx:137`) with `whileInView`/`viewport={{ once: true, margin: "-60px" }}`. On a viewport tall enough (or content short enough) that the rule sits within the initial viewport but inside that shrunk `-60px` margin band, and the page never scrolls (e.g. `DataUnavailable`'s minimal error page, or any above-the-fold heading on a large monitor), the intersection required to flip `scaleX` from 0→1 may never occur.
- **Root cause**: The `-60px` margin is a reasonable trick to delay the reveal until an element is meaningfully in view *while scrolling*, but it is applied indiscriminately to every usage including short, non-scrolling pages, with no fallback for "already relevant on mount and never going to cross that boundary."
- **Impact**: The signature red divider rule (described in its own doc comment as "sutnarovský podpis" — the site's signature visual mark) can render as an invisible zero-width bar on short pages, most visibly on the `DataUnavailable` error page where there's little content to scroll and the rule sits close to the fold.
- **Fix sketch**: Either drop the negative margin for above-the-fold/known-short contexts, or add a mount-time check (e.g. via `useInView`'s `once` + a fallback `animate` after a short timeout) so the rule still resolves to `scaleX: 1` if it was never scrolled past.

## 5. AnimatedScore updates are visually-only with no accessible live announcement
- **Lens**: UI
- **Severity**: Low
- **Category**: missing-polish / a11y-gap
- **File**: features/shared/components/AnimatedScore.tsx:35
- **Scenario**: When `value` changes after mount (live dashboard refresh, filter change re-rendering `HeadToHead`/`LiveSpecimen` with a new score), sighted users see the number animate to its new value, but the rendered `<span>` has no `aria-live` region and no `aria-label` reflecting the settled value — a screen-reader user gets nothing communicating that a score changed, and if they read the span while mid-animation they may get an intermediate, meaningless number.
- **Root cause**: The primitive was designed purely as a visual "living instrument" (per its own doc comment) without a parallel accessible-name/live-region contract, even though it's reused across every score display in the app — a systemic a11y gap replicated at every call site rather than a one-off oversight.
- **Impact**: Assistive-technology users never learn when a displayed score changes, and if AT happens to poll the DOM mid-animation, they can be given a transient non-final number as if it were the real value.
- **Fix sketch**: Wrap the span with `aria-live="polite"` gated to announce only the final value (e.g. debounce the live region text to the settled `format(value)` rather than every `onUpdate` tick), or add a static `aria-label={format(value)}` that always reflects the true target value regardless of animation state.
