# LawWatch — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. `primaryParagraph` truncates multi-letter paragraph suffixes, risking false collision-cluster merges
- **Lens**: Bug
- **Severity**: High
- **Category**: data-correctness / grouping-logic
- **File**: features/lawwatch/getCollisionData.ts:181-188 (used at line 221 `keyOf`)
- **Scenario**: A collision pair has `sharedParagraph = "35ba odst. 1"` (this exact case is discussed in the file's own comments — the "§35ba/§35c 586/1992 complex"). `primaryParagraph` runs `/^(\d+[a-z]?)/.exec("35ba odst. 1")`, which greedily consumes digits `"35"` then at most **one** trailing lowercase letter `"b"`, yielding `"35b"` — silently dropping the `"a"`. If another, genuinely distinct pair on the same statute cites plain `"35b …"`, both pairs now hash to the same cluster key (`"586/1992§35b"`) and get merged into one `CollisionClusterView`, even though they concern different sub-paragraphs.
- **Root cause**: The regex only allows a single optional trailing letter, but Czech legal paragraph suffixes are not always single-letter (`35ba`, `35bb`, etc. are common under `zákon 586/1992`). The docstring only sanity-checked the single-letter case (`"35c odst. 1" → "35c"`) and never verified multi-letter suffixes round-trip.
- **Impact**: This is the app's flagship "kolize tisků" forensic-adjacent feature, which the code goes to great lengths elsewhere to keep honest (grep-verified evidence, explicit "never a verdict" framing, incidental-pair exclusion). A silent mis-cluster here would misrepresent which bills are actually colliding on which clause — exactly the kind of civic-trust error this feature is designed to avoid.
- **Fix sketch**: Change the capture to consume all trailing lowercase letters: `/^(\d+[a-z]*)/`. Add a regression check (or unit test) asserting `primaryParagraph("35ba odst. 1") === "35ba"` and `primaryParagraph("35bb, 35bc") === "35bb"`.

## 2. `/zakony/[cislo]` loads the full law graph twice per request, doubling load on a documented single-connection PGlite
- **Lens**: Bug
- **Severity**: Medium
- **Category**: reliability / redundant-work
- **File**: app/zakony/[cislo]/page.tsx:14-40
- **Scenario**: For a single navigation to `/zakony/112`, Next.js invokes both `generateMetadata` (line 18, calls `getLawData()`) and the page component (line 31, calls `getLawData()` again) — two independent, un-deduplicated calls, each re-running `listKgNodes`/`listKgEdges`/`listPersons` across bills, laws, organs, amends and assigned_to edges.
- **Root cause**: `getLawData()` (features/lawwatch/getLawData.ts:209) is a plain async function, not wrapped in React's `cache()`/`unstable_cache`, so Next.js has no way to dedupe the two call sites within one request. The page's own comment block explicitly documents that PGlite here is "single-connection ... held elsewhere" and that a null return must be read as "graf nedostupný" rather than "tisk neexistuje" — i.e. the code already anticipates connection contention as a real failure mode, yet doubles the number of concurrent connection attempts per request.
- **Impact**: Best case, wasted DB work on every dossier page view. Worst case (under concurrent traffic or a slow PGlite acquire), the second call is more likely to lose the single-connection race and return `null`, causing a real, existing tisk to render the "data unavailable" fallback instead of its dossier — a false negative the page's own contract was written to avoid.
- **Fix sketch**: Wrap `getLawData` in React's `cache()` (from `"react"`) so both call sites within the same request share one in-flight/resolved promise, or have `generateMetadata` short-circuit without loading the full graph (e.g. a lightweight `findBillTitleByCislo` that only needs `cislo`/`title`).

## 3. Bill-browser facet/origin filter badges show global counts, not counts under the currently-combined filter
- **Lens**: UI
- **Severity**: Medium
- **Category**: filter-consistency / misleading-affordance
- **File**: features/lawwatch/components/BillBrowser.tsx:66-77 (origin counts) and 90-110 (facet counts)
- **Scenario**: Select an origin, e.g. "senátní návrh" (few bills). The "Stav" facet row still shows counts computed over **all** bills regardless of the selected origin (`data.bills.filter(x.test).length` at line 93, `data.originCounts[o]` at line 76 — neither reruns against `rows`/the other active filter). A user picks "senátní návrh" then sees "posudek · 12", clicks it, and gets "Žádný tisk neodpovídá filtru." even though the badge just told them 12 exist.
- **Root cause**: The two filter rows compute their counts independently against the unfiltered dataset instead of against the dataset filtered by the *other* active dimension, so the numbers on screen don't describe what clicking the button will actually produce once combined with the currently active filter.
- **Impact**: Users lose trust in the filter counts (a "silent lie" in the UI, not just a code one) and may conclude the tool is broken when a combination legitimately yields zero results.
- **Fix sketch**: Compute facet counts against the origin-filtered subset (and vice versa) — e.g. `const originFiltered = origin ? data.bills.filter(b => b.origin === origin) : data.bills;` then run each facet's `.test` over `originFiltered` for its badge count, and symmetrically compute origin badges over the facet-filtered subset.

## 4. Cyclic prev/next bill navigation wraps silently at the ends with no visual cue
- **Lens**: UI
- **Severity**: Medium
- **Category**: navigation / affordance
- **File**: features/lawwatch/getLawData.ts:374-384 (`findBillByCislo`), rendered in features/lawwatch/BillDossierPage.tsx:46-69
- **Scenario**: On the highest-`cislo` bill's dossier, `nextCislo` computes `(idx + 1) % n` which wraps to the very first bill in the register. The rendered link reads identically to every other "další tisk · N" link — nothing distinguishes "this jumps back to the start" from "this is the true next print."
- **Root cause**: `findBillByCislo`'s doc comment justifies the modulo wrap as making prev/next feel like "browse the register" rather than dead-ending, but the UI layer never surfaces that a wrap happened — the two nav tiles in `BillDossierPage.tsx` only render a static label/icon regardless of whether `cislo` is a true neighbor or a wrap-around.
- **Impact**: A user methodically paging through prints via "další tisk" will, at the boundary, be silently teleported back to print #1 with no indication they've completed a full loop — easy to misread as "there's a bug, it looks the same as before" or to lose track of where they've already been.
- **Fix sketch**: Have `findBillByCislo` also return whether `prevCislo`/`nextCislo` is a wrap (`idx === 0` / `idx === n-1`), and render a distinct label/tooltip on those tiles (e.g. "další tisk · N (zpět na začátek)") or disable wrap-around entirely and show the existing "—" placeholder state at the true ends instead.

## 5. CollisionsPage renders raw numbers while every sibling LawWatch surface uses `useFormat().int()`
- **Lens**: UI
- **Severity**: Low
- **Category**: design-system consistency / i18n-number-formatting
- **File**: features/lawwatch/CollisionsPage.tsx:96-115 (stat tiles + `data.batchesRun`)
- **Scenario**: `LawWatchPage.tsx` and `BillBrowser.tsx` route every displayed count through `f.int(...)` (a `useFormat()` helper) for locale-correct number rendering. `CollisionsPage.tsx`'s stat grid (`data.confirmedPairCount`, `data.coordinationRiskPairCount`, `data.clusterCount`, `data.nWayClusterCount`) and its `SourceNote` (`{data.batchesRun} dávky close-readu`) interpolate the raw numbers directly, never importing `useFormat`.
- **Root cause**: `CollisionsPage.tsx` was built as a standalone route (per its own header comment) without reusing the same numeric-formatting convention established on `/zakony`, so the two pages of the same feature group diverge on a basic presentation primitive.
- **Impact**: Currently cosmetic (all values are small integers so `f.int` vs raw string look identical), but it's a live standardization gap: any future increase in cluster/pair counts into the thousands would render un-grouped on this page while every other LawWatch surface would show thousands separators, and it signals the two pages weren't reviewed against the same design-system checklist.
- **Fix sketch**: Import `useFormat` in `CollisionsPage.tsx` and wrap the four stat-tile values and `data.batchesRun` in `f.int(...)`, matching `LawWatchPage.tsx`'s pattern exactly.
