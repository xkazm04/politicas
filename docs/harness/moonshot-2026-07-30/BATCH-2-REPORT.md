# Batch 2 — Provenance & Trust — Report

> 5/5 features shipped, 5 atomic commits. Gates: tsc 0 · lint 0 errors (30 doctrine warnings = the planned inventory) · tests 698 → **785/785** (67 files) · `next build` green.
> Cumulative: 10/35 accepted moonshots shipped across 2 batches.

## Commits

| Item | Commit | Scope | New tests |
|---|---|---|---|
| 2A Provenance Capsule | `78991c4` | features/shared/provenance, SourceNote, app/zdroj | 30 |
| 2B Tamper-Evident Ledger | `2d1095d` | lib/db/pglite (ledger, DDL, review repo) | 2 suites |
| 2C Deník důkazů | `6844bb9` | features/dukazy, app/dukazy, admin cross-link | 21 |
| 2D Doctrine Compiler | `cb52e85` | eslint-rules ×2 + config + RuleTester precedent | 25 cases |
| 2E Numbers That Testify | `f52a8b6` | lib/claims, lib/format (additive), app/svedectvi | 14 |

## What shipped

1. **Provenance Capsule** — SourceNote gains an opt-in `provenance` prop (byte-identical without it): focus-trapped receipt popover + Exponát-grade `/zdroj/[ref]` page showing kg endpoints, human-gate status (absent review_state never renders verified), sources, ClaimReview JSON-LD. Weights render unrounded.
2. **Tamper-Evident Ledger** — review audit rows are hash-chained (pinned canonical JSON, domain-separated sha256) inside the existing write transaction; `verifyAuditChain` reports first divergence; idempotent Merkle sealing per ingest run; heads exposed via `LedgerRepository`. Additive DDL with in-place upgrades.
3. **Deník důkazů** (`/dukazy`) — court-gazette public feed of every verification decision with `#z-<id>` anchors, SourceNote + registry links per entry, RSS 2.0 + JSON Feed 1.1 routes; reviewer raw notes never published (test-pinned); honest unreadable-vs-empty distinction.
4. **Doctrine Compiler** — `require-source-citation` + `no-raw-number-display`: rendered figures without provenance are now lint violations (warn in features/**, error in clean app/**, labs exempt); escape hatches (`data-undisclosed` badge convention, `// citation-ok:`); 29-warning inventory recorded for escalation.
5. **Numbers That Testify** — `lib/claims` claim shape + `formatCitable`/`f.cite`: same visible numbers, machine-readable `data-claim-*` + gated ClaimReview JSON-LD that structurally refuses unverified figures; reference exhibits at `/svedectvi`.

## Follow-ups carried

- **Claim-shape reconciliation**: 2A defined its ClaimReview builder locally (2E's `lib/claims` landed in parallel) — consolidate to `lib/claims` in a later batch.
- Doctrine warning inventory (30) to burn down; escalate warn→error per-directory as files come clean.
- Capsule call-site adoption (threading `provenance` into money/profile surfaces) is later-batch work, as is Deník důkazů linking chain heads once admin renders LedgerRepository heads.

## Next

Batch 3 — The Daily Record: Deník republiky (merged) · Evidence Permalinks · Bitemporal Graph · Data Releases · Kariérní spis.
