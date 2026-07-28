---
name: kg_edge review_tier/review_rank are a pass-24 cache, not an authority
description: props.tie_class is a judgement to honour; props.review_tier/review_rank are a stale snapshot of a pure function and must be recomputed.
---

`linked_to` edges carry three "already computed" props. They are NOT the same kind of
thing and must not be treated alike:

- **`props.tie_class`** (211/211) is a JUDGEMENT — an analyst or reviewer looked at the
  registry and wrote it. It WINS over `classifyTie` unconditionally (`resolveTieClass`).
  5 ties disagree with the heuristic and the stored value is the investigated one.
- **`props.review_tier` / `review_rank`** (208/211) are a pass-24 SNAPSHOT of a pure
  function of class × corroboration × reachable CZK. Measured 2026-07-29 on the live
  store: **153 of 208 ranks and 4 of 208 tiers no longer match the tie they sit on** —
  the ranks encode the pre-batch-012 contract corpus (`supplies` 2 290 → 153 731 rows)
  and the tiers predate the batch-006 dataor corroboration sweep (pass 27 > pass 24).

`review_rank` is a sort key whose magnitude encodes money, so a queue mixing stored and
recomputed ranks is not ordered at all — the two vintages are incomparable, and 3 ties
carry no stored rank to begin with. `resolveReviewOrder` therefore keeps a stored key
only while it still matches the tie in front of the reader and recomputes otherwise,
reporting the count on `/penize/kontrola`.

Rule of thumb for any future "the graph already stores this, just read it": ask whether
the prop is something a PERSON decided or something a FUNCTION computed. Honour the
first; treat the second as a cache and check it against its current inputs.
