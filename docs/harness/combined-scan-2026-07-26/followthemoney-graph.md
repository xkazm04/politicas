# FollowTheMoney Graph — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. Stat tiles and ledger silently disagree when an MP fails to resolve
- **Lens**: Bug
- **Severity**: Critical
- **Category**: silent-failure / data-integrity
- **File**: features/money/getMoneyData.ts:44-116
- **Scenario**: Walk the `linked` edges loop (lines 44-61): for each `linked_to` edge, `comp = companyById.get(e.dst)` is checked and unresolved edges are dropped (`if (!comp) continue`) — but once `comp` resolves, `pendingTies`/`verifiedTies`/`distinctCompanies`/`contractCzkReachable` are all incremented unconditionally. The *person* side is never checked here. Only later, in the per-MP grouping loop (lines 64-67), does `personById.get(personId)` get checked, and if the person node isn't found (or `pspIdFromNodeId` returns null), that MP and all its ties are dropped from `mps` with a bare `continue` — silently, no log. If even one linked person fails to resolve (stale edge, term-boundary mismatch, a person node filtered out of the "person" listing), `stats.pendingTies` / `stats.companiesLinked` / `stats.contractCzkReachable` (shown in the page's aggregate tiles, FollowTheMoneyPage.tsx:56-61) keep counting that tie, while `mps` (and therefore `TiesLedger`'s `rows`/`sorted.length` footer text, and `MoneyGraph`'s featured case file) exclude it entirely.
- **Root cause**: Two independent "drop if unresolved" gates (company-side in the stats loop, person-side in the grouping loop) are applied at different points over the same edge set, so an edge that fails only the second gate is counted in the shown stats but invisible in the shown rows/graph — the two loops were written for a happy-path join that always fully resolves, not for partial resolution.
- **Impact**: A civic-transparency product whose stated thesis is "trust is the product" shows a pending-ties count or reachable-CZK total that the visible ledger table can never add up to, and in the extreme case (all tied persons unresolved but their companies resolved) the page displays non-zero real stats above a `MoneyGraph` that has fallen back to the unrelated, hardcoded "all edges verified" mock — mixing real and fictional data on the same page with no visual distinction.
- **Fix sketch**: Resolve both `companyById` and `personById` in a single pass before counting anything into `stats`; only increment `pendingTies`/`verifiedTies`/`distinctCompanies`/`contractCzkReachable` for edges that will actually surface in `mps`. Log (via `reportLoaderFailure` or a warn) when an edge is dropped for either reason so drift is visible in ops, not just silently absorbed.

## 2. `num()` silently coerces non-numeric amount props to 0, undercounting reachable money
- **Lens**: Bug
- **Severity**: High
- **Category**: silent-failure / type-coercion
- **File**: features/money/moneyLoader.ts:23-25, 151
- **Scenario**: `num(v)` returns `0` for anything that isn't already `typeof v === "number"` — it never attempts to parse. In `loadMoneyLayer`, `amount = num(e.weight) || num(ct?.props?.amount)` (line 151): when `e.weight` is `null`/`0`, the code falls back to `ct?.props?.amount`, which comes straight out of `props: Record<string, unknown>` (a JSON/jsonb blob per lib/db/types.ts:198-199) with no schema guarantee it's a JS `number` rather than a numeric string.
- **Root cause**: `num()` conflates "not a number" with "worth zero." Any contract whose amount landed in `props` as a stringified number (a very common JSON/jsonb serialization shape) is treated identically to a contract that genuinely has no known amount.
- **Impact**: The affected contract silently contributes `0` to `contractsByCompany` aggregates → `contractCzk` on the tie → `contractCzkReachable`, `reach`, and the graph's money-node amount. The UI renders a confident `—` or `0 Kč` (TiesLedger.tsx:298-300, MoneyGraph.tsx:63-64) instead of surfacing a parse problem, which for a "how much reachable public money" product directly falsifies the headline number without any error trail.
- **Fix sketch**: Have `num()` attempt `Number(v)` for strings and only fall back to `0` (with a `reportLoaderFailure`/console.warn) when the parse truly fails or the value is genuinely absent, so a data-shape drift is loud instead of read as "no money."

## 3. Adjacent top-bar nav links use unrelated, inconsistent color pairings
- **Lens**: UI
- **Severity**: Medium
- **Category**: design-system consistency
- **File**: features/money/FollowTheMoneyPage.tsx:99-110
- **Scenario**: The header has two same-level nav links, `kauzy` (line 99-104: `text-signal … hover:text-ink`) sitting immediately next to `kontrola vazeb` (line 105-110: `text-cobalt … hover:text-signal`). They share layout, weight, and case treatment but use two entirely different base colors and two different hover destinations (one fades toward ink, the other toward signal).
- **Root cause**: The two links were evidently added at different times/by different passes without pulling from a shared "secondary nav link" style, so each picked whichever accent color felt locally right.
- **Impact**: Two equally-weighted navigation actions read as if they have different semantic importance (signal usually means "flagged/highlight" elsewhere on this page, e.g. the ochre pending banner and signal stat highlights), creating an unintentional visual hierarchy and undermining the page's otherwise strict Sutnar-style color discipline (color = meaning) documented throughout this codebase's other components.
- **Fix sketch**: Give both links one shared "top-nav link" class (single accent color + single hover target), reserving `signal` vs `cobalt` distinction only where it actually encodes different meaning (e.g., unverified vs. review-tool destination) — or pick one consistent scheme deliberately and comment why they differ if that's intentional.

## 4. Kauzy teaser card bypasses the i18n system with inline hardcoded strings
- **Lens**: UI
- **Severity**: Medium
- **Category**: i18n / design-system consistency
- **File**: features/money/FollowTheMoneyPage.tsx:190-195
- **Scenario**: Every other string on this page and its children goes through `useTranslations` (`t(...)`, `tc(...)`, `tcom(...)`), but the "kauzy / open leads" teaser card hardcodes both locales directly in the component: `{locale === "en" ? "kauzy / open leads" : "kauzy / rozpracované podněty"}` and the longer description right below it.
- **Root cause**: A one-off addition (the teaser link to `/penize/kauzy`) was written inline instead of adding two keys to the `money` translation namespace like every neighboring string.
- **Impact**: This copy is invisible to the translation tooling/pipeline (e.g. translation-polish passes, locale audits, future third-locale additions) and will silently drift out of sync with the rest of the page's tone/terminology since it's not reviewed alongside the catalog. It also means a translator fixing wording elsewhere on `/penize` has no way to find or edit this block.
- **Fix sketch**: Move both strings into the `money` namespace (e.g. `money.sections.ledger.kauzyTeaser.title/body`) and call `t(...)` like the rest of the file.

## 5. Graph nodes remove the focus outline with no accessible replacement
- **Lens**: UI
- **Severity**: Medium
- **Category**: accessibility / missing polish
- **File**: features/money/MoneyGraph.tsx:128-135, 237-244
- **Scenario**: Both `RealGraph` and `MockGraph` render each entity as an SVG `<g tabIndex={0} onFocus={...} style={{ cursor: "pointer", outline: "none" }}>`. Tabbing through the graph with a keyboard moves focus between nodes (confirmed by `onFocus={() => setHover(n.id)}`), but `outline: "none"` strips the browser's default focus ring and no `:focus-visible` style (ring, halo, offset) is substituted — the only feedback is the same subtle fill/label-color change also used for mouse hover.
- **Root cause**: `outline: none` was applied to kill the default rectangular SVG focus box for visual cleanliness, but no deliberate focus-visible affordance was added to replace it, so keyboard users lose a clear, high-contrast indicator of which node currently has focus.
- **Impact**: Keyboard-only users (and screen-magnifier users) navigating this "hover-lit edges" money graph have a materially harder time telling which node is focused versus merely connected/lit, on a feature whose entire value proposition is precise attribution of specific ties — reducing accessibility exactly where legibility matters most.
- **Fix sketch**: Replace the blanket `outline: none` with a `:focus-visible` rule (e.g. a `stroke`/halo circle drawn only when `n.id === focusedId` and the user is in keyboard mode, or simply restore a themed outline via CSS `outline-color`/`outline-offset` instead of removing it outright).
