# App Shell & Navigation — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. Stale `present` set causes the "on this page" nav to flash empty on every client-side route change
- **Lens**: Bug
- **Severity**: High
- **Category**: race-condition / state-staleness
- **File**: features/shell/useActiveSection.ts:26-43 (interacts with features/shell/AppShell.tsx:33)
- **Scenario**: User is on `/hlasovani` (declared anchor ids: `denik`, `linie`, `rebelie`, `temata`) and clicks the sidebar link to `/rozpocty` (ids: `zrcadlo`, `dluh`, `skupina`). AppShell stays mounted (it lives in the layout), so `useActiveSection` doesn't remount — it just re-runs its effect because `key` (the joined id string) changed.
- **Root cause**: `present` and `active` are only reset *inside* the `requestAnimationFrame` callback of the effect, not synchronously when `ids`/`key` changes. Between the route-driven re-render (new `declared` sections from `sectionsFor(pathname)`) and the next animation frame, React still renders with the **previous** `present` Set. `AppShell.tsx` computes `sections = declared.filter(s => present.has(s.id))` — since the old and new id sets almost never overlap (ids are page-specific), this filter yields an empty array for one frame. Both `Sidebar` and `MobileNav` conditionally render the entire "on this page" block based on `sections.length > 0`, so the block visibly disappears and then reappears a frame later.
- **Impact**: A visible flash/layout-shift of the expanded module's sub-content on essentially *every* navigation between two different modules — the most common navigation pattern in the app. Reads as broken/janky chrome even though nothing is functionally lost.
- **Fix sketch**: Reset `present` (and `active`) to `null` synchronously when `key` changes, e.g. via `useState` lazy-init keyed on `key` or by calling `setPresent(null)` at the top of the effect body before scheduling the `requestAnimationFrame`, so the AppShell falls back to "show all declared" (its documented null-state behavior) instead of "show none," while the next frame's real measurement resolves.

## 2. Mobile nav panel stays open after browser back/forward navigation
- **Lens**: Bug
- **Severity**: Medium
- **Category**: state-desync
- **File**: features/shell/MobileNav.tsx:21,42,78
- **Scenario**: On a phone-width viewport, user taps the hamburger to open the panel, then instead of tapping a link uses the OS/browser back gesture (or a hardware back button) to navigate to a previous route.
- **Root cause**: `open` is local `useState` that is only ever set to `false` inside each `<Link onClick>` handler (line 78) or the toggle button. It is never synchronized to `pathname`. Any navigation that doesn't go through one of those `onClick` handlers (back/forward navigation, a link followed from elsewhere, programmatic `router.push`) leaves `open` unchanged.
- **Impact**: After a back/forward navigation the expanded panel remains visibly open over the new page, showing nav content for a page the user didn't explicitly request to browse from — confusing and looks like a stuck/broken menu.
- **Fix sketch**: Add `useEffect(() => setOpen(false), [pathname])` so any pathname change collapses the panel regardless of how navigation occurred.

## 3. Metric chip visibility rule diverges between desktop Sidebar and MobileNav for the active module
- **Lens**: UI
- **Severity**: Medium
- **Category**: design-system inconsistency
- **File**: features/shell/Sidebar.tsx:64-68 vs features/shell/MobileNav.tsx:92-96
- **Scenario**: Navigate to any module page, e.g. `/zebricek` (CivicScore). On desktop the sidebar row for the active module suppresses its metric chip (`{!open && labels.metric(entry) && …}`), presumably because the expanded sub-content below already gives context. On mobile, the exact same row in the drawer's module list renders the metric chip unconditionally (`{labels.metric(entry) && …}`), including for the currently-active entry.
- **Root cause**: Both components consume the same shared `labels.metric()` helper from `sidebarParts.tsx`, but each hand-rolls its own conditional around it instead of sharing one "should this row show its metric" rule — the desktop variant encodes an `!open` guard the mobile variant lacks.
- **Impact**: The same navigation affordance behaves differently depending on viewport width; a user who switches from desktop to mobile mid-session sees an extra metric on the active entry that wasn't there before, undermining the app's stated "one shared shape, not two divergent lists" design intent (per the file's own header comment).
- **Fix sketch**: Factor the visibility rule into `useNavLabels()` (e.g. `labels.metric(entry, { isActive })` returning `null` when active) or pass an explicit `active` flag consumed identically by both components.

## 4. Mobile nav drawer has no Escape-to-close and no focus management
- **Lens**: UI
- **Severity**: Medium
- **Category**: accessibility / missing polish
- **File**: features/shell/MobileNav.tsx:40-107
- **Scenario**: A keyboard or screen-reader user taps/activates the hamburger button, the drawer expands with `aria-expanded` correctly toggled, but there is no keydown handler for `Escape`, and focus is never moved into the panel (e.g. to the first link) nor returned to the toggle button when it closes via a link click.
- **Root cause**: The component only wires `onClick` handlers for opening/closing; keyboard affordances (`Escape` to dismiss) and focus placement, which are baseline expectations for any disclosure/drawer pattern, were never implemented.
- **Impact**: Keyboard-only users have no fast way to dismiss the open drawer short of tabbing all the way through its links or the toggle button again; screen-reader users get no cue that focus should move into newly-revealed content, degrading an otherwise well-labeled (`aria-label`, `aria-expanded`) component.
- **Fix sketch**: Add a `keydown` listener (or `onKeyDown` on the wrapping div) that closes on `Escape` and returns focus to the toggle button; optionally move focus to the first interactive element in the panel on open.

## 5. Brand mark SVG is duplicated verbatim in two files instead of sharing one component
- **Lens**: UI
- **Severity**: Low
- **Category**: component-architecture / duplication
- **File**: features/shell/MobileNav.tsx:27-31 and features/shell/sidebarParts.tsx:48-52
- **Scenario**: The identical three-shape logo mark (`rect` fill-signal background, `circle` fill-paper, vertical `rect` fill-ink) is hand-copied into `MobileNav`'s header link and into `sidebarParts.tsx`'s exported `BrandBlock` (used by desktop `Sidebar`), differing only in the wrapper's size classes (`h-6 w-6` vs `h-7 w-7`) and text size.
- **Root cause**: `sidebarParts.tsx` already exists as the shared home for cross-variant chrome pieces (its own header comment says variants "should differ by composition... not by each one writing 'Politicas' differently"), but the brand mark itself wasn't extracted into a parameterized version of `BrandBlock`, so `MobileNav` re-implements it inline.
- **Impact**: Any future tweak to the mark (color token rename, viewBox adjustment, accessibility label) has to be applied in two places; missing one leaves desktop and mobile showing subtly different logos — exactly the drift the file's own design principle was meant to prevent.
- **Fix sketch**: Export a `BrandMark({ className })` from `sidebarParts.tsx` (just the `<svg>`), have both `BrandBlock` and `MobileNav`'s header link render it with their own sizing classes.
