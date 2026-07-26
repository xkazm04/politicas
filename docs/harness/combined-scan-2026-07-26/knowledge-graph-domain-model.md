# Knowledge Graph Domain Model — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. Rejected money-linkages are treated as "unverified" instead of excluded from the trail
- **Lens**: Bug
- **Severity**: Critical
- **Category**: derivation-miscategorization
- **File**: lib/analysis/kg-money.ts:277-297
- **Scenario**: A human reviewer sets a `PersonCompanyLink.state` to `"rejected"` (a person was falsely matched to a company by the automated IČO join). `moneyTrails()` still adds that company to the person's `companies` set and sums its contracts into `totalAmount`/`contractCount`; the only effect of the rejection is `fullyVerified = false` (the same flag a merely-`pending_review` tie gets).
- **Root cause**: The check `if (l.state !== "verified") cur.verified = false;` treats every non-"verified" state as "not yet verified" rather than distinguishing "not yet reviewed" (`pending_review`, legitimately still tentative) from "explicitly refuted by a human" (`rejected`, which should never contribute to a trail at all). The file's own header stresses this module is "the MOST SENSITIVE part of the graph" governed by a human gate, but the gate's negative outcome is silently downgraded to "shown but flagged" instead of "excluded."
- **Impact**: A FollowTheMoney trail can present a contract-value total and company list that includes a link a human explicitly rejected as false, merely labeled "not fully verified" rather than removed — the opposite of what the review gate is for, and a direct contradiction of "TRUST IS THE PRODUCT, NEVER FABRICATE."
- **Fix sketch**: Skip links with `state === "rejected"` entirely when building `byPerson` (`if (l.state === "rejected") continue;`), and keep the existing "any non-verified → fullyVerified=false" logic only for the remaining `pending_review` case.

## 2. Force-layout positions collapse to NaN when the canvas box has zero width or height
- **Lens**: Bug
- **Severity**: High
- **Category**: division-by-zero / edge-case
- **File**: lib/kg/layout.ts:69, 102-125
- **Scenario**: A caller (typical in React: measuring a container ref before its first paint, or a graph panel collapsed to 0×0) invokes `forceLayout(nodes, edges, { width: 0, height: 0 })` with ≥2 nodes and at least one edge. `k = Math.sqrt((0*0)/n)*0.62 = 0`. In the edge-attraction step, `force = (d*d)/k/d` divides by `k === 0`, yielding `Infinity` for `fx`/`fy` on every connected node pair.
- **Root cause**: The repulsion term has an explicit `d2 < 0.01` guard against zero distance, but neither `k` (derived from `width*height`) nor the edge-force division has any floor — `k` can legitimately be 0 whenever `width` or `height` is 0, which the function's public options (`Partial<LayoutBox>`) permit outright. Once `dx[a]`/`dy[a]` become `Infinity`, the per-step `Math.sqrt(dx*dx+dy*dy) || 1` also evaluates to `Infinity` (not falsy), so `dx[i]/d` becomes `Infinity/Infinity = NaN`, and `xs[i] += NaN` poisons the coordinate permanently — `Math.max(pad, Math.min(width-pad, NaN))` stays `NaN` for every remaining iteration.
- **Impact**: Every connected node's final position is `NaN`, so `r2(xs[i])` returns `NaN` and the returned `Point` has `NaN` coordinates. Any consumer that draws with these (canvas `translate(NaN, NaN)`, SVG `cx=NaN`) silently renders nothing for that node with no error — a graph that "loads" empty/blank with clickable-but-invisible content, the exact class of bug the glyph.ts header calls out as historically real for this codebase.
- **Fix sketch**: Floor `k` (e.g. `Math.max(k, 1)`), or guard the box dimensions at the top of `forceLayout`/`simulate` (`width = Math.max(width, 1)`, same for height) before deriving `k`.

## 3. Duplicate contract rows silently produce duplicate graph nodes (no dedup, unlike companies)
- **Lens**: Bug
- **Severity**: Medium
- **Category**: graph-construction / data-quality
- **File**: lib/analysis/kg-money.ts:107-113, 115-138
- **Scenario**: `contracts` contains two `Contract` rows with the same `id` (a duplicate natural key from the upstream feed) — the same class of defect `lib/analysis/context-model.ts` documents as already observed in this corpus ("55 exact duplicate natural keys in PSP10" for excuses). `buildMoneyGraph` pushes a `MoneyNode` for `contractUrn(ct.id)` on every iteration of the `contracts` loop with no guard.
- **Root cause**: `ensureCompanyNode()` explicitly dedups companies via the `emittedCompanyNode` Set before pushing a node, but the contract branch of the same loop has no equivalent guard — it unconditionally does `nodes.push({ id: contractUrn(ct.id), ... })` and `supplies++` for every row, including exact-duplicate rows.
- **Impact**: The `nodes` array (and `stats.contracts`/`stats.supplies` counts) contains two entries with the identical `id`; any consumer keying nodes by id (a Map, a DB upsert-by-id, a renderer deduping by id) will silently drop one, while raw counts like `stats.supplies` and `contractsWithoutKnownSupplier` are inflated versus the true distinct-contract count.
- **Fix sketch**: Track emitted contract ids in a Set the same way `emittedCompanyNode` does, and skip re-pushing (and re-counting) a contract id already emitted.

## 4. Anti-hallucination prose sweep rejects legitimate verdicts that cite their own newly-declared node
- **Lens**: Bug
- **Severity**: Medium
- **Category**: silent-failure / validation-inconsistency
- **File**: lib/analysis/kg-verdict.ts:256-277, 306-313
- **Scenario**: A subagent proposes a genuinely new `person` node (e.g. a committee member not yet ingested) with `id: "psp:person:9999"`, declares it in `nodes`, and — as any reasonable rationale would — mentions `"psp:person:9999 chairs the committee"` in `summary` or an edge's `rationale`. The edge-endpoint check (line ~267-276) explicitly allows `declared.has(id)` as valid. The prose sweep at the bottom of the function does not.
- **Root cause**: `citedEntityUrns(input)` is checked only against `known` (`if (!known.has(cited)) errors.push(...)`), never against `declared` — the same set the edge-endpoint validation deliberately unions in with `known`. The two anti-fabrication checks in the same function apply inconsistent rules to the same category of id.
- **Impact**: A correct, non-hallucinated verdict that both proposes a new entity and refers to it by id in prose is deterministically rejected with a false "hallucinated MP/organ reference" error, discarding valid graph-expansion work (exactly the `KG_FRONTIER_KINDS: "expand-node"` case this module exists to support) purely because of where the id appears (JSON field vs. free text).
- **Fix sketch**: Build the `known ∪ declared` set once before the edges pass and reuse it for the final `citedEntityUrns` sweep as well, e.g. `const knownOrDeclared = known ? new Set([...known, ...declared]) : null`.

## 5. `traceGlyph`/`glyphPath` render "ring" as an indistinguishable solid "circle"
- **Lens**: UI
- **Severity**: Medium
- **Category**: glyph-geometry
- **File**: lib/kg/glyph.ts:31-34, 58-62
- **Scenario**: A caller renders a node with `shape: "ring"` through the documented batch-fill contract described in this file's own header ("stovky značek se nasypou do JEDNÉ cesty a vykreslí jedním `fill()`"), or requests the SVG path via `glyphPath("ring", r)` for a legend/inspector entry, expecting a hollow annulus distinct from `"circle"`.
- **Root cause**: Both `case "circle": case "ring":` fall through to the exact same drawing code in `traceGlyph` (`ctx.moveTo(r,0); ctx.arc(0,0,r,0,Math.PI*2)`) and the exact same path string in `glyphPath` (`M ${-r} 0 a ${r} ${r} 0 1 0 ${r*2} 0 ...`). Neither adds a second, reverse-wound inner arc/circle to cut a hole via the nonzero/even-odd fill rule, so there is no code path that produces an actual ring shape — `"ring"` is a distinct enum member with zero distinct geometry.
- **Impact**: Any node kind mapped to the `"ring"` glyph (per the module's own kolo/čtverec/kosočtverec/… taxonomy comment, shapes are meant to be the print-safe, color-independent signal of entity kind) is visually identical to a `"circle"` node once filled — defeating the stated purpose ("barva ho jen zesiluje — graf tak přežije i tisk v šedé") for exactly the case (grayscale/print, or two kinds sharing a similar color) the shape distinction exists to cover.
- **Fix sketch**: In `traceGlyph`, draw the outer circle then a second, oppositely-wound inner circle at a fixed inner radius (e.g. `r * 0.55`) for the `"ring"` case so a nonzero-fill leaves a hole; mirror the same two-arc construction in `glyphPath`'s `d` string using `fill-rule="evenodd"`-compatible winding.
