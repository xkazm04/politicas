# Velin Dashboard — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. Pinning a node with no matching event shows "no matches" text and a full dimmed list at the same time
- **Lens**: Bug
- **Severity**: High
- **Category**: contradictory empty-state / state consistency
- **File**: features/dashboard/components/GraphFeedPanel.tsx:37-84
- **Scenario**: In `StateGraphCanvas`, click the vote node for roll call `h-409` ("sn. tisk 471 — Rozpočet krajské dopravní infrastruktury"). This node exists in the graph (it's one of the three `FEATURED_VOTES` built by `lib/civic/stateGraph.ts`, chosen because it has a rebel vote) but no entry in `EVENTS` references `rollCalls: ["h-409"]` — the only roll-call refs in the feed data are `h-412` and `h-391`. Once pinned, `GraphFeedPanel` renders the "no matches" placeholder (line 66-70) **and**, immediately below it, still renders every row in `events.map(...)` (line 71-84), each dimmed to `opacity-40` since none contains the pinned id.
- **Root cause**: `matches` (line 37-39) is used only to decide whether to show the empty-state message; the actual row list at line 71 always iterates over the full unfiltered `events` array. The two branches were written to be complementary ("empty banner OR full list") but nothing makes them mutually exclusive, and the dataset already contains a node (`h-409`) with zero backing events, so the contradiction is not theoretical — it is reachable today with two clicks.
- **Impact**: The panel simultaneously claims "nothing happened for this selection" and displays every event as if slightly relevant, undermining the dashboard's stated evidence-first design promise that dimming ≠ removal ≠ "nothing here." Users lose trust in the filter and can't tell whether the graph-feed link is broken or the data is incomplete.
- **Fix sketch**: Either drop the standalone empty-state branch and let the fully-dimmed list speak for itself (consistent with "fading, never disappearing"), or, if a genuine empty message is wanted, replace the unconditional `events.map` with `matches.length === 0 ? events : events` logic that suppresses the dimmed re-render when `matches.length === 0` (e.g. don't render rows at all in that case) so the message and the list are never shown together.

## 2. "Global" feed rows are dimmed exactly like excluded rows, contradicting their own label
- **Lens**: UI
- **Severity**: High
- **Category**: visual-semantic mismatch
- **File**: features/dashboard/components/GraphFeedPanel.tsx:74-82; features/dashboard/components/FeedRow.tsx:65-69
- **Scenario**: Pin any node in the graph, then look at feed rows that have no `refs` at all (aggregate events such as the quarterly recompute). `showGlobalMark` correctly tags them with the ochre "globalRow" label to say "this counts regardless of filter" (FeedRow.tsx:65-69), yet `GraphFeedPanel` still computes `dim={pinned !== null && !nodeIds.includes(pinned)}` (line 78) for these same rows — since `nodeIds` is `[]`, `.includes(pinned)` is always false, so every global row gets `opacity-40` applied identically to genuinely-filtered-out rows.
- **Root cause**: The dim predicate only checks "does this row's node list include the pinned id," with no carve-out for the zero-node/global case that the code elsewhere treats as a distinct, always-relevant category (see the file-header comment in GraphFeedPanel.tsx explaining dimming should only mean de-emphasis, never exclusion-by-implication).
- **Impact**: A user scanning a filtered feed sees the "this is a global row, still relevant" tag sitting on a visually washed-out line indistinguishable from truly irrelevant ones — the two pieces of UI actively disagree, so most users will just read the opacity and ignore the label.
- **Fix sketch**: Exclude global rows (`nodeIds.length === 0`) from the `dim` condition, or give them a third visual treatment (full opacity + the ochre tag) so "always relevant" and "filtered out" are never rendered the same way.

## 3. Crosshair "show in graph" always jumps to the first ref, silently discarding the rest
- **Lens**: Bug
- **Severity**: Medium
- **Category**: ambiguous data selection
- **File**: features/dashboard/components/FeedRow.tsx:71-81
- **Scenario**: An event whose text describes a company gaining a second contract has `refs: { mps: ["hruska-k"], ties: [0, 1] }`, which `nodesForRefs` expands to `[person, company0, money0, company1, money1]` (order: mps, then ties in array order). Clicking the row's crosshair button calls `onPick(nodeIds[0])`, which always pins the MP node — never the company/money node the sentence is actually about — regardless of which tie or fact the row's text emphasizes.
- **Root cause**: `onClick={() => onPick(nodeIds[0])}` treats the array's incidental construction order (mps → ties → rollCalls → lawChanges → parties, per `nodesForRefs`) as if it encoded relevance, when it's really just insertion order.
- **Impact**: For any multi-node event, the "jump to graph" affordance can pin a node the user didn't intend to inspect, forcing an extra manual click on the graph itself to find the node the row was actually about — defeating the stated purpose of the crosshair ("zaměřovač... připne uzel v grafu").
- **Fix sketch**: Either pin the full match set (highlight all `nodeIds`, not a single id) or let event data specify a `primaryRef`/`focusNodeId` used for the crosshair instead of defaulting to array position 0.

## 4. Keyboard focus on graph nodes has no per-node indicator, only a shared neighbourhood glow
- **Lens**: UI
- **Severity**: Medium
- **Category**: accessibility / focus visibility
- **File**: features/dashboard/components/StateGraphCanvas.tsx:143-165
- **Scenario**: Tab through the state graph with a keyboard only (no mouse). Each node `<g>` has `tabIndex={0}` and explicitly sets `className="outline-none"` (line 162), removing the browser's default focus ring. The only feedback wired to `onFocus` (line 152) is `onHover(n.id)`, which lights up the whole neighbourhood (`lit`) via the same code path a mouse hover would use (line 47, 140). When several nodes share edges (e.g. an MP connected to two companies and a vote), 3-4 shapes all render "lit" simultaneously and look identical — there is no glyph-level distinction for "this is the one currently focused" vs. "this is a neighbour of the focused node."
- **Root cause**: The design conflates "hover preview" and "keyboard focus" into the same `hover` state and the same lit/unlit binary glyph treatment (`GraphGlyph`'s `focused` prop is driven only by `pinned === n.id`, line 165, not by keyboard focus), so keyboard users get neighbourhood-level feedback but no node-level focus marker, while the CSS focus ring that would normally supply that is deliberately suppressed.
- **Impact**: Keyboard-only and screen-magnifier users cannot visually locate which of several highlighted shapes their focus is actually on; they must read the status bar text below the canvas and mentally map it back onto the SVG, which is slow and error-prone on a graph with many similarly-styled nodes.
- **Fix sketch**: Give the SVG node group a visible focus style (e.g. `focus-visible:outline` re-enabled, or draw the same signal-colored selection ring used for `focused` on any node that currently has DOM focus, not just the pinned one) so keyboard focus is distinguishable from mere neighbourhood-lighting.

## 5. Feed rows highlight on hover even when nothing in the row is clickable
- **Lens**: UI
- **Severity**: Medium
- **Category**: misleading affordance
- **File**: features/dashboard/components/FeedRow.tsx:42-46
- **Scenario**: Aggregate feed events with no `mpId` and no matched graph node (e.g. a quarterly-recompute row) render without a `Link` (line 52-61 falls to the plain-text branch) and without a crosshair button (the `onPick && nodeIds.length > 0` guard at line 71 fails). Yet the row's outer container unconditionally carries `hover:bg-paper-strong` (line 43), so mousing over it still highlights the whole row exactly like an interactive one.
- **Root cause**: The hover style is applied at the row-container level regardless of whether the row actually contains a link or button, rather than being scoped to (or conditional on) the presence of an actionable child.
- **Impact**: Users get a false "this is clickable" signal on rows that do nothing when clicked, which is a small but repeated trust-eroding inconsistency in a product whose whole pitch is precise, evidence-first affordances (the same doctrine invoked in this file's own header comment about not hiding actions under a full-row click).
- **Fix sketch**: Make the hover background conditional (`(event.mpId || (onPick && nodeIds.length > 0)) ? "hover:bg-paper-strong" : ""`), or scope the hover effect to the actual interactive children (Link/button) via `group-hover`-style targeting instead of the row background.
