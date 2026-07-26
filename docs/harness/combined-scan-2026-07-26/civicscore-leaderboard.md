# CivicScore Leaderboard — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. Unclamped participation/attendance rates can blow component bars past 100%
- **Lens**: Bug
- **Severity**: High
- **Category**: data-integrity / edge-case
- **File**: features/civicscore/getLeaderboardData.ts:104-120 (specifically lines 113 and 117)
- **Scenario**: `componentPoints()` derives all six weighted components from raw per-MP rates. Four of them (`committee`, `legislative`, `speech`) are explicitly passed through `clamp01(...)` before multiplying by their weight, but `participation` (`participationRate * CONTRIBUTION_WEIGHTS.participation`) and `attendance` (`(1 - absenceRate) * CONTRIBUTION_WEIGHTS.attendance`) are not. If `participation_rate` or `absence_rate` ever land outside `[0,1]` in the graph (unit mismatch — e.g. a future ingest pass stores a 0–100 percentage instead of a 0–1 fraction, or `absence_rate` goes slightly negative due to a counting quirk), the resulting point value exceeds its component's weight.
- **Root cause**: Inconsistent guarding — the function assumes every input rate is pre-normalized to [0,1], but only enforces that assumption for 3 of 6 components. There is no schema/type-level guarantee upstream that `participation_rate`/`absence_rate` stay in range (`num()` only checks "is it a finite number", not range).
- **Impact**: Every consumer of `components` assumes points ≤ weight (that's the entire visual contract of `MiniBreakdown` in LeaderboardTable and the mirrored bars in HeadToHead, both of which render `width: {points}%` / `width: {points/weight*100}%`). A single bad rate silently produces bar widths >100%, visibly breaking the leaderboard's 207-row breakdown bars and/or the head-to-head comparison for the affected MP(s), with no error, no log, no guard — a pure "success theater" failure mode this codebase otherwise takes pains to avoid (per the loader's own doc-comments about never fabricating/exceeding true values).
- **Fix sketch**: Wrap both `participationRate` and `(1 - absenceRate)` in `clamp01(...)` for symmetry with the other four components, and consider asserting/logging when a raw rate falls outside [0,1] so a future bad ingest is caught at the source rather than only visually.

## 2. Head-to-head crowns a "leader" even when the two MPs are tied
- **Lens**: Bug
- **Severity**: Medium
- **Category**: edge-case / logic
- **File**: features/civicscore/components/HeadToHead.tsx:71-93
- **Scenario**: `const leader = diff >= 0 ? a : b;` — when `a.score === b.score`, `diff` is `0`, which satisfies `diff >= 0`, so `a` (the first-picked MP) is unconditionally rendered as the "leader" via `t.rich("leadLine", { name: leader.name..., diffLabel: "0.0 pts", ... })`. With 207 real MPs ranked to one decimal, exact score ties are plausible (several MPs can share the same `contribution_score`), so a user comparing two tied MPs sees a headline sentence declaring MP A "leads by 0.0 pts" — a self-contradictory claim (a 0-point lead is not a lead).
- **Root cause**: The comparison logic treats "leader" as a strict-inequality concept but implements it with `>=`, collapsing the tie case into "a always wins" instead of handling it as a distinct third state.
- **Impact**: Misleading headline copy on a "transparency" feature whose entire premise is honest, non-fabricated framing of real data — presenting a tie as a lead undermines exactly the trust the surrounding code comments (in getLeaderboardData.ts) are careful to protect elsewhere.
- **Fix sketch**: Branch on `diff === 0` explicitly and render a dedicated tie message (e.g. "shodné skóre") instead of routing ties through the leader-line copy.

## 3. Component bar highlight color disagrees with the rounded number actually shown
- **Lens**: Bug
- **Severity**: Medium
- **Category**: display-computation mismatch
- **File**: features/civicscore/components/HeadToHead.tsx:98-131
- **Scenario**: For each component row, the rendered numbers are rounded integers — `const va = Math.round(pa)`, `const vb = Math.round(pb)` — but the "which side wins this component" text color is computed from the *unrounded* raw points: `pa > pb ? "text-signal" : "text-ink"` (line 107) and `pb > pa ? "text-signal" : "text-ink"` (line 129). Given real per-MP rates, `pa` and `pb` frequently differ by a fraction (e.g. 12.4 vs 11.6) that both round to the same displayed integer, or differ only after the decimal in a way invisible post-rounding.
- **Root cause**: Two different precisions are mixed — the rounded value drives what the user reads, the unrounded value drives what the user sees highlighted — with no reconciliation between the two.
- **Impact**: A user can see two identical numbers (e.g. "12" and "12") side by side where one is colored signal (implying "this MP won this category") and the other is plain ink, with no visible justification — an unexplainable, confidence-eroding inconsistency in a comparison UI whose whole job is to make per-component winners legible.
- **Fix sketch**: Base the color decision on the same rounded values used for display (`va > vb` / `vb > va`), or explicitly show a "tie" state when `va === vb` regardless of the sub-decimal difference.

## 4. Head-to-head bars discard the component color-coding taught by the leaderboard legend
- **Lens**: UI
- **Severity**: Medium
- **Category**: design-system standardization / component reuse
- **File**: features/civicscore/components/LeaderboardTable.tsx:28-35, 216-231 vs features/civicscore/components/HeadToHead.tsx:110-128
- **Scenario**: LeaderboardTable establishes a color language for the six contribution components via `COMPONENT_FILL` (cobalt = participation, signal = committee, ochre = legislative, ink = speech, steel = attendance, cobalt/50% = leadership) and reinforces it with an explicit legend row (`!compact` block) and every row's `MiniBreakdown`. A user scrolls down to section 02 "Souboj" (HeadToHead) expecting the same six components — but every bar there is rendered as flat `bg-ink` (lines 112 and 123), regardless of which component it represents.
- **Root cause**: HeadToHead was built independently from LeaderboardTable's color system (`COMPONENT_FILL` is defined in and scoped to LeaderboardTable.tsx, never imported/reused) rather than sharing the established per-component palette.
- **Impact**: The two views of the identical six-component breakdown, sitting on the same page one section apart, look unrelated — the user has to re-learn "which bar is which" in the head-to-head instead of transferring the color association just built while scanning the legend/table, undermining the page's own internal design consistency.
- **Fix sketch**: Export `COMPONENT_FILL` (or the `components` array's color) from a shared module and apply it to the `motion.span` bar fills in HeadToHead instead of the hardcoded `bg-ink`.

## 5. Head-to-head component-comparison bars get squeezed illegible on narrow mobile widths
- **Lens**: UI
- **Severity**: Medium
- **Category**: responsive design
- **File**: features/civicscore/components/HeadToHead.tsx:106-133
- **Scenario**: Each component row uses `grid-cols-[3rem_1fr_auto_1fr_3rem]` with the center label column set to `min-w-[7.5rem]` (120px) holding text like "Práce ve výborech × 20". On a small phone viewport (e.g. 360px wide, minus the page's `px-6` padding ≈ 312px content width), the two fixed 3rem number columns (96px) plus the 120px label leave roughly 96px total for *both* proportional bar columns combined — the two bars that are the actual visual point of the head-to-head comparison shrink to slivers a few pixels wide, while the label text dominates the row.
- **Root cause**: The grid template mixes content-driven fixed/min-width columns (label, numbers) with the flexible `1fr` bar columns without any narrow-viewport adjustment (no responsive column stacking, no shortened/wrapped label, no `min-width` cap relative to viewport), so the primary data-viz element loses its allotted space first as the viewport shrinks.
- **Impact**: On mobile — a primary usage surface for a public transparency site — the head-to-head's core visual (proportional bars per component) becomes too thin to compare meaningfully, degrading the feature's usefulness for exactly the readers who most rely on scannable visuals.
- **Fix sketch**: Stack each component row into two lines on small screens (label on its own line, bars+numbers below spanning full width), or drop the `min-w-[7.5rem]` on the label in favor of a responsive clamp/truncate so the bar columns retain a usable minimum width.
