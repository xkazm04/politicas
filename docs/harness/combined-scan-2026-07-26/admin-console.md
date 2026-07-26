# Admin Console — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. Admin tie counts fabricate a tie-class for unresolved companies, contradicting the review console's own "never guess" rule
- **Lens**: Bug
- **Severity**: High
- **Category**: data-integrity / silent-failure
- **File**: features/admin/getAdminData.ts:368-373
- **Scenario**: A `linked_to` edge exists whose destination company node is missing/unresolvable from `companyById` (stale edge, deleted node, id typo). The admin loop hits `const comp = companyById.get(e.dst)` → `undefined`, then `const tieClass = comp ? classifyTie(role, comp.label) : "steward";`. The edge is still counted into `ties.total`/`verified`/`pending`/`rejected` and bucketed into a `reviewTier` (via the fabricated `"steward"` class).
- **Root cause**: The real review console (`features/money/getVerificationData.ts:92-95`) explicitly does `if (!comp || pspId == null) continue; // unresolved endpoint → drop, never guess` — an unresolved company means the tie is dropped entirely, by documented design. `getAdminData.ts` reimplements the same ties→tiers pipeline but silently substitutes a default `"steward"` classification instead of dropping the edge, inventing data the rest of the codebase treats as untrustworthy.
- **Impact**: The admin dashboard's tie totals and tier breakdown can diverge from the actual `/penize/kontrola` queue the operator is meant to be monitoring (e.g. admin shows N pending ties, kontrola shows N-k because k have unresolved companies). Since this page's entire purpose is to be the trustworthy monitoring surface over the real review pipeline, a silent mismatch defeats that purpose and could mislead the operator about how much review work remains.
- **Fix sketch**: Mirror the real console's contract — skip edges with no resolvable `comp` (do not fabricate a tie class), or explicitly report them as a distinct "unresolved endpoint" bucket in `TieReviewSummary` rather than folding them into `steward`.

## 2. Forensic verdict list sorts only "high vs not-high", so `.slice(0, 8)` can hide medium-severity items behind lows
- **Lens**: Bug
- **Severity**: Medium
- **Category**: edge-case / ranking-logic
- **File**: features/admin/getAdminData.ts:409; features/admin/components/ReviewHubSection.tsx:103
- **Scenario**: `bills` contains, say, 3 "high", 10 "low", and 2 "medium" severity verdicts, with the 2 "medium" items appearing later in the underlying node iteration order than several "low" ones. `items.sort((a, b) => (b.severity === "high" ? 1 : 0) - (a.severity === "high" ? 1 : 0))` only guarantees "high" items float up; "medium" and "low" keep their original relative order. `ReviewHubSection` then renders `forensic.items.slice(0, 8)` as the visible preview.
- **Root cause**: The comparator was written as a binary high/non-high partition rather than a full severity-rank comparator (high > medium > low), so it silently under-serves the medium tier despite `SEVERITY_TONE` and the UI clearly modeling three distinct severities.
- **Impact**: The capped 8-item preview — the only part of the list an operator sees without more UI (there's no "show more") — can display low-severity noise while omitting medium-severity verdicts that actually need review attention.
- **Fix sketch**: Sort with a full rank map, e.g. `const rank = { high: 0, medium: 1, low: 2 }` and `items.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3))`.

## 3. Audit-trail badges are the only unbounded, uncapped list on an otherwise consistently-capped page
- **Lens**: UI
- **Severity**: Medium
- **Category**: component-consistency / layout-robustness
- **File**: features/admin/components/ReviewHubSection.tsx:157-170
- **Scenario**: `Object.entries(audit.byDecision)` and `Object.entries(audit.byReviewer)` are mapped to `flex-wrap` badges with no length cap. Every other data-dense list on this page is explicitly bounded: forensic verdicts use `.slice(0, 8)` (ReviewHubSection.tsx:103), and the graph node/edge breakdowns use `.slice(0, 5)` (SystemStateStrip.tsx:13-14).
- **Root cause**: The audit tile was implemented without the same "top-N" guard the sibling tiles use, even though `byReviewer`/`byDecision` are built from up to 10,000 `review_audit` rows (`getAdminData.ts:419`) and reviewer names/decision labels are free-form strings that can grow without bound over the life of the review process.
- **Impact**: As more reviewers or decision types accumulate, this tile's badge cloud grows unbounded while its sibling tiles stay compact and fixed-height — breaking the grid's visual rhythm and, in the worst case, pushing the tile far taller than its `lg:grid-cols-2` neighbor.
- **Fix sketch**: Cap both lists (e.g. top 6-8 by count with a "+N more" indicator) for visual parity with the forensic and graph-totals tiles, or wrap the badge row in a `max-h` + `overflow-y-auto` scroll container.

## 4. Audit trail's "last decision" timestamp bypasses the app's Czech date-formatting convention
- **Lens**: UI
- **Severity**: Low
- **Category**: design-system / formatting-consistency
- **File**: features/admin/components/ReviewHubSection.tsx:171
- **Scenario**: `<SourceNote>{audit.lastDecidedAt ? \`poslední rozhodnutí: ${audit.lastDecidedAt}\` : "zdroj: review_audit"}</SourceNote>` interpolates the raw ISO timestamp straight from the store (`lib/db/pglite/repositories/review.ts` → `isoTs`), e.g. `poslední rozhodnutí: 2026-07-24T18:31:09.703Z`.
- **Root cause**: Every other date surfaced on this same page goes through `czechDate()` (`VaultHeadsPanel.tsx:27`, formatting `p.date` for the vault passes list); this one caption was left as a raw `.toISOString()`-style string instead of being run through the shared formatter.
- **Impact**: A jarring, hard-to-scan raw-ISO-with-milliseconds string sits directly below/near nicely localized Czech dates elsewhere on the same screen, breaking the page's visual and locale consistency for the one human reading it.
- **Fix sketch**: Format with the existing `czechDate` (or a datetime variant of it) before interpolating, matching the convention already used in `VaultHeadsPanel`.

## 5. No loading/streaming state while `/admin` performs multiple heavy, sequential-feeling data reads
- **Lens**: UI
- **Severity**: Medium
- **Category**: missing-polish / perceived-performance
- **File**: app/admin/page.tsx:13-16; features/admin/getAdminData.ts:479-484
- **Scenario**: `Admin()` is an async server component that `await`s `getAdminData()` in full before returning any JSX. That loader does synchronous disk I/O for three ledgers plus `graph-log.md` and `frontier.md`, then (in parallel) `loadReviewHub()` — which itself calls `listKgNodes({ limit: 100_000 })` twice, `listKgEdges({ limit: 100_000 })`, and `listReviewAudit({ limit: 10_000 })` — and `loadSystemState()`, which calls `listKgNodes({ limit: 100_000 })` again.
- **Root cause**: There is no `app/admin/loading.tsx` and no `<Suspense>` boundary anywhere between the route and `AdminPage`, so the entire response is held back until every one of these reads (several of them uncapped-feeling `100_000`-row scans against the live store) resolves.
- **Impact**: As the graph grows, the operator gets a blank white tab with no feedback for however long the combined reads take, on a page whose whole job is to be the fast, at-a-glance operational surface — the opposite of the intended "one-glance strip" experience described in the file's own header comments.
- **Fix sketch**: Add an `app/admin/loading.tsx` skeleton (reusing the page's tile/grid shapes) so Next.js can stream a shell immediately, or split `getAdminData()` into independently-suspended sections (loop progress / review hub / system state) so slow store queries don't block the whole page.
