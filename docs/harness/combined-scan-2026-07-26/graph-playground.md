# Graph Playground — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. Fullscreen toggle never re-fits the view, leaving the graph mis-positioned
- **Lens**: Bug
- **Severity**: High
- **Category**: resize/viewport race
- **File**: features/graph/components/GraphStage.tsx:402-439
- **Scenario**: Open the playground, pan/zoom to some position, then click the fullscreen button (`toggleFullscreen`, line 519). The wrapper's `ResizeObserver` (lines 402-406) fires with a much larger `size.w/size.h`, which resizes the canvas backing store (lines 415-424) and calls `schedule()` — but nothing recomputes `viewRef.current.x/y/k`. The same happens in reverse on exit-fullscreen (canvas shrinks back down).
- **Root cause**: `viewRef` (pan/zoom offsets) is only ever recalculated by `fitView()`, which is triggered solely by `fitKey` changes (line 437-439) or by the explicit `fitBounds`/`focusId` effects. Entering/exiting fullscreen changes the canvas dimensions dramatically but is not wired to any of those triggers, so the offset computed for the old viewport size is reused verbatim against the new size.
- **Impact**: After toggling fullscreen the graph appears shifted into a corner (fullscreen) or zoomed/cropped oddly (exit), instead of staying centered on the content the user was looking at — a jarring UX break in the app's flagship full-viewport feature, and it silently "fixes itself" only if the user manually hits the Fit button.
- **Fix sketch**: In the `fullscreenchange` handler (or in the size-effect), call `fitView()` (or re-anchor around the previous world-center point) whenever `isFull` changes, so the same world region stays centered across the size jump.

## 2. A transient DB-not-ready hiccup permanently disables the graph for the process lifetime
- **Lens**: Bug
- **Severity**: High
- **Category**: silent failure / caching
- **File**: features/graph/graphLoader.ts:67, 118-126, 185, 205-259, 265, 487-489
- **Scenario**: On a cold server start, the very first request to `/graf` races `getStore()` before PGlite has finished initializing (or any other transient error occurs inside `buildIndex`/`getMapData`/`getTrails`). The `catch { return null; }` blocks (lines 118-120, 256-258, 487-489) swallow the error, and the result — `null` — is memoized forever via `indexPromise ??=`, `mapPromise ??=`, `trailsPromise ??=` (module-level singletons, lines 67/185/265).
- **Root cause**: The memoization pattern is designed for "data doesn't change without a batch job, so cache for the process lifetime" (per the file's own comment), but it does not distinguish a genuine empty/absent dataset from a one-off transient failure. Once a `null` is cached, every subsequent request (`getGraphSeed`, `mapAction`, `trailsAction`, `searchGraphAction`) is stuck on that `null` with no retry path short of a full process restart.
- **Impact**: A single bad tick at boot (slow disk, PGlite lock contention, etc.) makes the entire Graph Playground show "unavailable"/empty for all users indefinitely, even though the data is present and would succeed on the very next call — and there is no logging of the swallowed error to even notice this happened.
- **Fix sketch**: Don't memoize a failed attempt: only cache the promise once it resolves to a non-null value (e.g. reset `indexPromise = null` in the catch block before returning null, or store the resolved value rather than the promise so failures can be retried on the next call), and log the caught error instead of silently discarding it.

## 3. NodeSearch leaves its debounce timer and in-flight request running after unmount
- **Lens**: Bug
- **Severity**: Medium
- **Category**: cleanup / stale state update
- **File**: features/graph/components/NodeSearch.tsx:40-63
- **Scenario**: User types a query in the search box, then immediately switches variants via the footer switcher (or the parent otherwise unmounts `NodeSearch`, e.g. leaving the page) within the 140 ms debounce window. The pending `setTimeout` (line 62) still fires after unmount, invokes `run(value)`, which calls `searchGraphAction` and then calls `setHits`/`setActive`/`setBusy` (lines 51-56) on a component that no longer exists.
- **Root cause**: There is no `useEffect` cleanup anywhere in the file to clear `timerRef.current` on unmount, and the `reqRef` guard only protects against *out-of-order* responses racing each other — it does nothing to stop the timer/request from firing at all after unmount.
- **Impact**: Wasted server round-trips after the user has already navigated away, and in React dev mode a "setState on an unmounted component" warning; more importantly it establishes a pattern (present in the app's one and only combobox) that will keep leaking timers as this component is reused elsewhere.
- **Fix sketch**: Add a mount-scoped `useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); reqRef.current++; }, [])` so both the pending debounce and any in-flight response are invalidated on unmount.

## 4. The graph's only keyboard path to nodes doesn't support keyboard users properly
- **Lens**: UI
- **Severity**: Medium
- **Category**: accessibility / missing polish
- **File**: features/graph/components/NodeSearch.tsx:78-97, 125-151
- **Scenario**: A keyboard-only user opens the search combobox and presses ArrowDown repeatedly through more than ~6 results (the list is `max-h-80 overflow-y-auto`, line 118). The highlighted row (`i === active`, line 135) moves past the visible viewport of the `<ul>` with nothing scrolling it into view, so the user loses track of which item is selected. A screen-reader user gets no `aria-activedescendant` pointing at the active `<li id=...>` at all — `role="combobox"`/`aria-controls` are set (lines 94-96) but the active option is never announced.
- **Root cause**: The component's own header comment explicitly frames it as "the only keyboard path to nodes" because `<canvas>` can't be operated by keyboard, so this widget is load-bearing for accessibility — but the arrow-key handler (lines 78-91) only updates local `active` state without any `scrollIntoView` call, and the `<li>` options (line 129) never get stable `id`s wired back to the input via `aria-activedescendant`.
- **Impact**: The one accessible substitute for canvas interaction silently fails exactly the population it exists to serve — keyboard/screen-reader users cannot reliably tell which result is about to be picked on Enter, undermining the app's own stated accessibility rationale for this component.
- **Fix sketch**: Give each option a stable id (e.g. `graph-search-opt-${i}`), set `aria-activedescendant` on the input to the active option's id, and call `optionRefs[active]?.scrollIntoView({ block: "nearest" })` whenever `active` changes via keyboard.

## 5. Trasy's floating panel duplicates the shared overlay chrome instead of reusing it, drifting from Mapa's
- **Lens**: UI
- **Severity**: Medium
- **Category**: component-architecture reuse / design-system standardization
- **File**: features/graph/VariantTrasy.tsx:96-142 (vs. features/graph/components/StageOverlays.tsx:19-30 `TopLeft`)
- **Scenario**: Compare the two variants side by side. `VariantMapa` places its search + trail-lens list inside the shared `<TopLeft>` wrapper (`w-[22rem] max-w-[calc(100%-6rem)]`, positioned `left-3 top-3`, `StageOverlays.tsx:19-21`). `VariantTrasy` hand-rolls an equivalent "trail index" card with its own one-off wrapper (`absolute bottom-16 left-3 top-3 ... w-[21rem] max-w-[85vw]`, `VariantTrasy.tsx:97`) that never calls into `TopLeft`, `StatChip`, or any shared primitive for its list container.
- **Root cause**: Both panels serve the same role (a bordered, ink-framed card pinned to the canvas' top-left carrying the primary control), but were implemented independently across the two variants instead of sharing `StageOverlays.tsx`'s components — the same file both variants already import for `StatChip`/`LegendOverlay`/`InspectorDrawer`.
- **Impact**: The two supposedly-comparable variants now have visibly different panel widths (21rem vs 22rem), different max-width clamps (85vw vs calc(100%-6rem)), and different vertical extents (Trasy's panel reaches all the way to `bottom-16`, Mapa's doesn't) — a design-system inconsistency a user bounces between via the footer switcher, and a maintenance trap where a future spacing/border tweak to one card silently doesn't apply to the other.
- **Fix sketch**: Extract the "bordered index/lens card" shape into `StageOverlays.tsx` (parameterized by max-height/columns) and have both `VariantMapa`'s trail-lens block and `VariantTrasy`'s trail list consume it, so they share one width/spacing/border definition.
