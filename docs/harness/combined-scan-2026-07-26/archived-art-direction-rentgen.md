# Archived Art Direction (Rentgen) — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. "Pět nástrojů" cards drop the navigable hrefs that the shared data model provides
- **Lens**: Bug
- **Severity**: Medium
- **Category**: dead-affordance / data-contract drift
- **File**: features/labs/rentgen/VariantRentgen.tsx:345-374 (compare features/landing/components/SystemModules.tsx:68-74)
- **Scenario**: A user reaches `/rentgen` (it is a live, reachable route — only `noindex`, not access-restricted) and lands on the "Pět nástrojů. Jeden graf." section. Each of the five `MODULES` entries (`CivicScore`, `VoteTrack`, `FollowTheMoney`, `BudgetMirror`, `LawWatch`) carries an `href` (`/zebricek`, `/hlasovani`, `/penize`, `/rozpocty`, `/zakony`) pointing at real, shipped pages in the app. The winning landing page (`SystemModules.tsx`) renders these as `motion.a href={m.href}` links. Rentgen instead renders each module as a plain `motion.div` with a hover background change (`hover:bg-[#141b24]`) but no `href`, `<a>`, `onClick`, or `cursor-pointer` — the data is read but the navigation half is simply never wired up.
- **Root cause**: The component consumes the shared `MODULES` data structure (`@/lib/civic/data`) that was designed with `href` as a first-class field for cross-linking to the real feature pages, but the Rentgen JSX only destructures `name`/`tag`/`description`/`metric` and never touches `m.href`.
- **Impact**: Cards visually shift color on hover (implying interactivity) but do nothing — a silent dead end. Since Rentgen is kept as a "living reference," anyone using it to sanity-check UX (including future implementers copying this pattern) inherits a broken navigation affordance.
- **Fix sketch**: Wrap each module card in `<a href={m.href ?? "#"}>` (or apply `m.href` as the `motion.div`'s wrapping anchor) mirroring `SystemModules.tsx`, or explicitly comment that Rentgen module cards are intentionally non-interactive stat tiles and remove the hover-bg cue that implies otherwise.

## 2. Money-graph's "hover to reveal" instruction is unreachable — state initializes lit and can never return to idle
- **Lens**: Bug
- **Severity**: Low
- **Category**: dead-code / state-machine gap
- **File**: features/labs/rentgen/VariantRentgen.tsx:45, 110-121, 148-157
- **Scenario**: `MoneyGraph` initializes `hover` to `"mp"` (`useState<string | null>("mp")`), so on first paint `node` already resolves to the "K. Hruška" entity and the caption panel shows the `▸ K. Hruška — poslanec · ANO · N hran v záznamu` branch. The `<g>` node elements register `onMouseEnter` and `onFocus` to *set* `hover`, but nothing ever calls `setHover(null)` (no `onMouseLeave`, no `onBlur`, no click-to-deselect) — so once mounted (or after any interaction), `hover` can only ever be reassigned to another node id, never cleared.
- **Root cause**: The fallback UI branch `{node ? (...) : (<span>najeďte na uzel a stopa se rozsvítí</span>)}` (line 156) was written assuming an idle (`hover === null`) state that the component never actually enters, because the initial value is a real node id and no code path resets it.
- **Impact**: The onboarding hint "hover over a node to light up the trail" never displays to any user in any session — dead, unreachable UI copy that miscommunicates the interaction model (it looks pre-lit/exploratory rather than idle-until-touched).
- **Fix sketch**: Either initialize `hover` to `null` and let the first render show the idle prompt, or add `onMouseLeave`/`onBlur` handlers that reset to `null` (or back to the `"mp"` default) so the idle branch is actually reachable and the copy matches real behavior.

## 3. `useReducedMotion()` is read but only honored by 2 of the page's ~5 animated blocks
- **Lens**: UI
- **Severity**: Medium
- **Category**: accessibility / motion consistency
- **File**: features/labs/rentgen/VariantRentgen.tsx:175, 204-254, 266-271, 314-319, 346-351
- **Scenario**: `const reduceMotion = useReducedMotion();` is declared once at the top of `VariantRentgen` and passed into the `initial` prop of the ranking rows (line 268: `reduceMotion ? false : { opacity: 0, x: -8 }`) and the evidence-log lines (line 316). The hero block — headline "Prosviťte stát", subhead, and CTA buttons (lines 204-254) — and the five module cards (lines 346-351) run the exact same kind of `initial={{opacity:0,y:...}} animate/whileInView` transitions unconditionally, ignoring `reduceMotion` entirely.
- **Root cause**: The reduced-motion guard was applied ad hoc to the two lists added later (ranking + log) rather than centralized (e.g. a shared `motionProps(reduceMotion)` helper or a `MotionConfig reducedMotion="user"` wrapper), so new/other animated elements in the same tree don't inherit the guard.
- **Impact**: A user with `prefers-reduced-motion: reduce` set still gets the largest, most prominent motion on the page — the hero fade/slide-up and the five-card grid entrance — defeating the purpose of the guard that's already present in the same file.
- **Fix sketch**: Wrap the page in Framer Motion's `<MotionConfig reducedMotion="user">` (removes the need for manual `reduceMotion ? false : …` branches everywhere), or thread the existing `reduceMotion` value into every `motion.*` `initial` prop in the file for consistency.

## 4. GREEN "verified/good" signal color is reused for a line reporting an unreviewed score drop
- **Lens**: UI
- **Severity**: Medium
- **Category**: design-system / semantic color misuse
- **File**: features/labs/rentgen/VariantRentgen.tsx:171 (compare 158-160, 286-296, 404)
- **Scenario**: Throughout the page, `GREEN` (`#3ad99b`) is used consistently as a "this is fine / verified" signal: the graph footer "● všechny hrany datované + doložené", the sources table "● ověřeno" status, the nav's "feedy živě" live-indicator, and the ranking bars/scores for MPs above 60. The last evidence-log line, however, uses the same `GREEN` for: `"pilíř integrity přepočten: 68 → 61, čeká na lidskou kontrolu"` flagged `"nezveřejněno do ověření"` — i.e. a score *decline* that is explicitly *not yet verified/published*.
- **Root cause**: The log-line color was presumably chosen for "this is the well-behaved, transparent line" (the system correctly withheld an unverified number) rather than following the page's own established score-severity convention (RED/AMBER/GREEN tied to good/bad values used two sections above in the ranking table).
- **Impact**: A reader visually scanning the evidence log for red flags will read this line as "fine" (green) when its content is actually a caution/pending-review item — undermining the page's stated premise ("Prosviťte stát" / forensic transparency) by using its own signal-color vocabulary inconsistently on the one line most likely to be scanned for risk.
- **Fix sketch**: Use `AMBER` (the file's existing "needs attention / possible conflict" color, already used for two other log lines) for this entry, reserving `GREEN` strictly for confirmed-good/verified states as it is everywhere else on the page.

## 5. SVG money-graph mixes `role="img"` with focusable, stateful child nodes that have no visible focus ring or accessible name
- **Lens**: Bug
- **Severity**: Medium
- **Category**: accessibility
- **File**: features/labs/rentgen/VariantRentgen.tsx:70, 113-121
- **Scenario**: The `<svg role="img" aria-label="Graf peněžní stopy...">` declares the whole graphic as a single, flat, non-interactive image to assistive tech. Its child `<g>` elements, however, are individually `tabIndex={0}` with `onMouseEnter`/`onFocus` handlers that change page state (which node is "lit", the caption text below), and each explicitly sets `style={{ outline: "none" }}` with no replacement focus style.
- **Root cause**: `role="img"` was added (reasonably) to give the SVG a single readable label, but the interactive per-node behavior was layered on top without accounting for the fact that `role="img"` semantics tell screen readers to ignore descendant content/interactivity — so a screen-reader user tabbing through the page lands on 7 stops that announce nothing beyond the outer image label, while a sighted keyboard-only user tabs through 7 invisible stops (no outline, and the "lit" color change is subtle amber/circle-radius, not a standard focus indicator).
- **Impact**: Keyboard and screen-reader users cannot meaningfully use the money-graph's core interaction (the page's stated hero feature — "najeďte na uzel a stopa se rozsvítí") — for screen readers the nodes are effectively invisible; for sighted keyboard users there is no clear affordance showing which of the 7 nodes currently has focus.
- **Fix sketch**: Drop `role="img"` from the `<svg>` (or move it to a decorative background layer) and give each interactive `<g>` `role="button"`, a real `aria-label` (e.g. node label + sub), and a visible focus style (e.g. `focus-visible:outline focus-visible:outline-2` in the node's amber) instead of `outline: "none"` with nothing replacing it.
