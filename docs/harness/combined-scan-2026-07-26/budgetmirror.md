# BudgetMirror — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. Chart series keyed by translated strings can collide or silently swap
- **Lens**: Bug
- **Severity**: High
- **Category**: i18n data-integrity / fragile keying
- **File**: features/budget/BudgetMirrorPage.tsx:100-111, 234, 243
- **Scenario**: `townSeriesLabel = t("townLabel")` and `peerSeriesLabel = t("peerMedianLabel")` are used both as the object keys built in `trendData` (line 105-109) and as the Recharts `dataKey` props on the two `<Line>` elements (lines 234, 243). Currently `cs.json`/`en.json` give distinct strings ("město"/"medián vrstevníků", "town"/"peer median"), so it happens to work. But nothing enforces uniqueness: a future locale, a copy-edit that makes the two strings equal (or differ only by case/whitespace after a translation-tool round trip), or a locale where both keys resolve to the same short word, will make `trendData` objects collapse to a single property — the second line's data silently overwrites the first in every row.
- **Root cause**: Using translated, human-editable copy as the structural key of a data array (and as the chart's `dataKey`) conflates presentation strings with data-shape identity. There is no assertion or fallback guarding against key collision.
- **Impact**: One of the two trend lines silently disappears from the debt chart (Section 02) with no error, no console warning, no visual placeholder — a silent failure that could go unnoticed through a full translation review since the code renders "successfully."
- **Fix sketch**: Use stable, non-translated keys for the data (`"town"`, `"peer"`) and pass a `name={...}` (localized) to each `<Line>`/via `Tooltip`'s `formatter`/`legendFormatter` for display text, decoupling the object/dataKey identity from translation content.

## 2. Metric bar width silently saturates at a hardcoded max, hiding actual magnitude differences
- **Lens**: Bug
- **Severity**: High
- **Category**: edge case / misleading data visualization
- **File**: features/budget/BudgetMirrorPage.tsx:60, 185, 193, 201, 301
- **Scenario**: `MetricDuo`'s `width()` clamps to 100% via `Math.min(100, ...)` against a caller-supplied `max` (14000 for debt, 30 for capex, 3000 for saldo), and the peer-group table (line 301) independently hardcodes `/14000` again for the debt bar. None of these maxima derive from the actual data range. If any town's debt-per-capita grows past 14000 Kč (current max is 12600, i.e. only ~10% of headroom left) or saldo exceeds 3000, its bar renders visually identical (full-width) to a value far beyond the cap — two towns with wildly different debt burdens would show the same bar.
- **Root cause**: Magic-number ceilings duplicated in two places (MetricDuo props and the table's inline literal) instead of being derived from `Math.max(...TOWNS.map(...))` or a single shared constant; no safeguard or visual cue (e.g. an overflow marker) when a value exceeds the assumed ceiling.
- **Impact**: As soon as one town's underlying figures update past the assumed ceiling, the comparison bars — the core visual of this page — silently become inaccurate and mislead viewers about relative fiscal health, with no error surfaced.
- **Fix sketch**: Compute maxima once from the live `TOWNS` data (e.g. `Math.max(...TOWNS.map(t => t.debtPerCapita)) * 1.1`) and share a single constant between `MetricDuo` calls and the table's bar, eliminating the duplicated literal.

## 3. Negative saldo values render as an ordinary bar, losing the deficit signal
- **Lens**: UI
- **Severity**: Medium
- **Category**: missing polish / data encoding
- **File**: features/budget/BudgetMirrorPage.tsx:60, 76, 199-203
- **Scenario**: Kolín has `saldoPerCapita: -400` (a deficit). If selected, `MetricDuo`'s number turns red via the `better` check (line 64), but the bar directly below it (line 76: `<span className="h-3 bg-ink" style={{ width: width(town) }} />`) uses `Math.abs(v)` for width and always renders in solid `bg-ink` — visually indistinguishable from a positive surplus bar of similar magnitude. The only deficit cue is the red number above it.
- **Root cause**: `width()` takes `Math.abs(v)` to keep the bar sizing formula generic across metrics, but this strips sign information that the surrounding text still conveys — the bar and number fall out of sync in what they communicate.
- **Impact**: A user scanning the bars (the primary visual affordance of this section) rather than reading the exact number can mistake a town in deficit for one with a comparable surplus, undermining the "at a glance" purpose of the metric duo.
- **Fix sketch**: Color the town bar conditionally (e.g. `bg-signal` when `town < 0` for saldo-type metrics, matching the number's color logic) so bar and number never disagree.

## 4. Peer-table rows are mouse-only interactive controls with no keyboard/AT path
- **Lens**: UI
- **Severity**: Medium
- **Category**: accessibility / interaction-pattern inconsistency
- **File**: features/budget/BudgetMirrorPage.tsx:280-286
- **Scenario**: Each `<tr onClick={() => setSelectedId(tw.id)}>` in the peer group table is a second way to change the selected town, duplicating the button strip above (lines 150-162). The buttons correctly expose `type="button"` and `aria-pressed`; the table rows have no `role="button"`, `tabIndex`, `onKeyDown`, or `aria-pressed`/`aria-current` equivalent — a keyboard or screen-reader user cannot select a town from the table at all, and there is no indication the row is a selectable control beyond a `cursor-pointer` CSS hint and hover background.
- **Root cause**: The interactive affordance was bolted onto a semantic `<tr>` element styled with `cursor-pointer`, mirroring visual hover behavior but not the accessible-control contract already established elsewhere on the same page.
- **Impact**: Keyboard-only and screen-reader users lose an entire input path that mouse users have, and the currently-selected row (`bg-paper-strong`) is not announced as selected to assistive tech.
- **Fix sketch**: Wrap the row's interactive surface in a real control (e.g. a `<button>` inside the first cell spanning the row via CSS, or add `role="button" tabIndex={0]` + `onKeyDown` handling Enter/Space + `aria-pressed={tw.id === selectedId}`) to match the accessibility contract of the town-selector buttons.

## 5. Debt-trend chart has no legend — line identity relies entirely on hover
- **Lens**: UI
- **Severity**: Low
- **Category**: missing polish / chart affordance
- **File**: features/budget/BudgetMirrorPage.tsx:217-250
- **Scenario**: The `LineChart` in Section 02 renders two series (solid signal-colored "town" line, dashed steel "peer median" line) but includes no `<Legend />` — the only place the mapping between color/dash-style and meaning is disclosed is the `Tooltip`, which requires hovering a specific point. A user glancing at, printing, or screenshotting the chart (a civic-transparency use case where sharing static views is common) sees two unlabeled lines.
- **Root cause**: Chart was built with only a `Tooltip` for series identification; no static, always-visible key was added even though the surrounding page already has a full localized-label vocabulary (`townSeriesLabel`/`peerSeriesLabel`) ready to feed a legend.
- **Impact**: Reduced comprehension for any non-interactive viewing (screenshots, print, quick glance), which matters for a public transparency tool meant to be shared/cited.
- **Fix sketch**: Add a small custom legend row above/below the chart using the same `townSeriesLabel`/`peerSeriesLabel` strings and matching stroke styles (solid vs. dashed swatch), or use Recharts' `<Legend />` with a custom renderer to match the page's typographic style.
