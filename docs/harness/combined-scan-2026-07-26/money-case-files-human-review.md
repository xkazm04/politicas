# Money Case Files & Human Review — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. Keyboard shortcuts bypass the in-flight write guard, allowing double-submission on the same tie
- **Lens**: Bug
- **Severity**: Critical
- **Category**: race-condition / double-submission
- **File**: features/money/components/VerificationConsole.tsx:108-139, 144-168 (esp. 161-164)
- **Scenario**: A reviewer has a card focused and presses `1` (confirm) then, within the same second, presses `3` (reject) — e.g. a fumbled keypress, or intentionally changing their mind before the first request resolves. The `onKeyDown` handler at line 161-164 calls `void handleDecide(shown[idx], DECISION_KEYS[e.key])` directly, with no check of the tie's current `writeStatus.phase`. Both calls fire `submitReviewDecision` concurrently against the same `src`/`dst`.
- **Root cause**: `handleDecide` (lines 108-139) only gets an in-flight guard from the mouse path, where the button is `disabled={writeStatus.phase === "pending"}` (line 506) — that JSX attribute has no effect on the keyboard code path, which invokes `handleDecide` unconditionally for any focused card regardless of an outstanding request. There is no `if (writeStatus[tie.id]?.phase === "pending") return;` guard inside `handleDecide` itself, so the guard is UI-decoration only, not an actual invariant.
- **Impact**: Two server actions race for the same `linked_to` edge; whichever `setTieReviewState` call lands last on the server wins, independent of which decision the reviewer actually intended to be final. On the human-review gate that decides whether a money tie becomes a "sourced fact," this can silently persist the opposite of the reviewer's real final decision, with the UI showing whatever the last-resolved promise happened to set (`writeStatus` line 128-137) — not necessarily reflecting server truth if requests resolve out of send-order.
- **Fix sketch**: Check `writeStatus[tie.id]?.phase === "pending"` at the top of `handleDecide` and no-op (or queue) instead of firing a second request; also guard the keyboard branch with the same shown-card's current phase before calling `handleDecide`.

## 2. No guard against re-deciding an already-written tie — a later click/keypress silently overwrites a completed decision
- **Lens**: Bug
- **Severity**: High
- **Category**: state-corruption / lost-update
- **File**: features/money/components/VerificationConsole.tsx:501-516; features/money/reviewActions.ts:59-89
- **Scenario**: A reviewer confirms a tie; `writeStatus` reaches `"done"` (line 128-129) and the note shows `zapsáno · review_state = verified`. The three decision buttons (lines 502-514) are only disabled while `writeStatus.phase === "pending"` (line 506) — once `"done"`, all three remain fully clickable. A stray click (or, worse, a second browser tab/reviewer still showing the same tie from a stale server-rendered queue) can click "Zamítnout" afterward, and `handleDecide` runs the whole optimistic-then-reconcile flow again with no check of the tie's already-resolved state.
- **Root cause**: `submitReviewDecision` (reviewActions.ts:41-90) takes no "expected current state" and never re-reads/compares the tie's existing `review_state` before calling `store.setTieReviewState` — it is a pure blind overwrite keyed only on `src`/`dst`. Combined with the client never disabling controls post-completion, there is no layer (client or server) that treats "already decided" as terminal for the UI's purposes.
- **Impact**: A `verified` tie can be silently flipped to `rejected` (or vice versa) by an accidental second click, or by two reviewers/tabs operating on the same pre-fetch queue snapshot, with the review console giving no warning that the tie was already resolved — undermining the "trust is the product" guarantee this console exists to provide.
- **Fix sketch**: Once `writeStatus.phase === "done"`, disable/replace the decision buttons with a "rozhodnuto — undo?" affordance requiring explicit confirmation; server-side, have `submitReviewDecision` read the tie's current `review_state` and reject (or require a `force`/`expectedState` param) if it is no longer `pending_review`.

## 3. Reviewer token compared with `!==` — non-constant-time comparison enables a timing side-channel
- **Lens**: Bug
- **Severity**: Medium
- **Category**: security / timing-attack
- **File**: features/money/reviewActions.ts:49
- **Scenario**: `if (!input.token || input.token !== reviewerToken) return { status: "unauthorized" };` — a network client that can call the server action repeatedly (this is a public route, not IP-restricted) can measure response latency of `!==` string comparison, which in V8 short-circuits at the first mismatched character, to recover `REVIEWER_TOKEN` one character at a time.
- **Root cause**: Plain JS `!==` on secret strings is not constant-time; the comment block frames this as a "simplest correct choice for this batch" auth model but doesn't account for the token being the only gate standing between an anonymous caller and writing `review_state`/`review_audit`.
- **Impact**: An attacker able to reach `/penize/kontrola`'s server action endpoint can, with enough requests, brute-force the shared reviewer token and gain full write access to the human-review gate, defeating the single-secret auth model entirely.
- **Fix sketch**: Use `crypto.timingSafeEqual` on fixed-length buffers (padding/hashing both sides to equal length first) instead of `!==` for the token check.

## 4. "Doplnit" (needs-more) decisions never capture what's missing — the note is hardcoded to `null`
- **Lens**: UI
- **Severity**: High
- **Category**: incomplete-workflow / missing-input
- **File**: features/money/components/VerificationConsole.tsx:126; reviewActions.ts:25-32 (SubmitReviewInput.note)
- **Scenario**: A reviewer clicks "Doplnit" on a tie that needs a follow-up (e.g. "check ARES VR for current officer status"). `handleDecide` calls `submitReviewDecision({ src: tie.src, dst: tie.dst, decision, note: null, token })` (line 126) — `note` is a literal `null` for every decision, for every tie, always. Nowhere in `ReviewCard` or the console is there a text input/textarea bound to a note value.
- **Root cause**: `SubmitReviewInput`/the write path was designed to carry a reviewer note (`note: string | null` in the type, and the live-write banner explicitly tells the reviewer "Rozhodnutí se zapisují do review_audit... každý zápis je auditovaný"), but the UI that would let a human actually type that note was never built — the wiring stops at a hardcoded `null`.
- **Impact**: "Doplnit" is the one decision whose entire purpose is to communicate what additional evidence is needed, but it persists no information beyond the bare decision — whoever revisits the tie later (including the same reviewer, days later) has no record of what was missing, making the needs-more workflow functionally a no-op beyond "not yet decided."
- **Fix sketch**: Add a small textarea (shown at least for `needs-more`, ideally for all three) in `ReviewCard`'s actions row, hold its value in component state keyed by `tie.id`, and pass it through as `note` in `handleDecide` instead of the literal `null`.

## 5. Decided ties never leave or get visually demoted in the queue — no way to hide completed cards during a long review session
- **Lens**: UI
- **Severity**: Medium
- **Category**: workflow-polish / missing-filter
- **File**: features/money/components/VerificationConsole.tsx:103-106, 304-328
- **Scenario**: The console explicitly targets a "humane 211-tie review session" (comment at line 141) with j/k + 1/2/3 keyboard flow for speed. `shown` (lines 103-106) filters only by `tieClass`, never by decided/undecided — so a tie that just received `writeStatus.phase === "done"` stays exactly where it was in the list, with only a border-color change (`decision ? "border-ink" : "border-hairline"`, line 410) and a small status note to distinguish it.
- **Root cause**: The "batch-005 review order" sort/tier grouping (lines 304-328) is static from server data and is never re-derived or re-filtered client-side as decisions land; there is no "hide decided" toggle or auto-collapse, so the reviewer's working set never visibly shrinks.
- **Impact**: Over a 211-card session, the j/k keyboard nav keeps stepping through already-resolved cards indefinitely, the reviewer has no way to see "what's actually left," and the per-tier progress counters (`decidedByTier` / `X / Y`, lines 293-300) are the only signal of remaining work — forcing mental subtraction instead of a filtered view, which is exactly the kind of friction a purpose-built review console should eliminate.
- **Fix sketch**: Add a "skrýt rozhodnuté" (hide decided) toggle that filters `shown` to exclude ties with `writeStatus.phase === "done"` (or locally-decided in stub mode), and have j/k skip decided cards by default so the keyboard flow always lands on the next actionable tie.
