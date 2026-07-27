---
name: ico-node-id-canonical-form
description: Company KG nodes are keyed `company:ico:<8-digit ZERO-PADDED IČO>` — unpadded ids silently duplicate nodes and break every IČO join.
metadata:
  type: project
---

A Czech IČO is always 8 digits, and this graph's company identity is
`company:ico:<ico zero-padded to 8>`. Every `contract.props.supplierIco` is
8-padded too, so **any join written against an unpadded IČO returns a silent
false negative**, not an error.

Money batch 009 (2026-07-27) found 8 nodes written unpadded by batch-006's
`owns_stake` ingest — one of them, `company:ico:2867681` (IF Holding a.s.),
was a **duplicate** of the canonical `company:ico:02867681`, which split one
real ownership chain across two node identities so multi-hop traversal stopped
dead at it. Fixed by `scripts/case-loops/money/canonicalize-ico-nodes.ts`
(idempotent; merges into the canonical node; refuses to move human-gated
`linked_to` edges).

**Why:** the convention is enforced nowhere in code — it lives in the habits of
whoever wrote each ingest, so every new source that mints company nodes can
reintroduce it, and the failure mode is a quiet zero rather than a crash.

**How to apply:** pad to 8 when minting or looking up a company node id, and
when a new adapter creates company nodes, run the canonicalization script's
detection query (`ico.length < 8`) before trusting any IČO-keyed result.
Related: [[kg-has-no-source-urls]], [[registr-smluv-token-free-access]].
