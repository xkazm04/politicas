---
name: prototype-rejection-and-labels
description: "Rejecting a variant's implementation ≠ rejecting its concept; and on canvas, ALL text must share one collision engine — verified by screenshots at two viewports."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1c9c34d2-915c-40e2-83b4-1fc1a71eda67
  modified: 2026-07-26T14:00:48.189Z
---

Two corrections from the /graf prototype rounds (2026-07-26), both from the
user, both paid for:

1. **Rejection of an implementation is not rejection of the concept.** The
   Atlas variant ("show me the whole mass") was rejected for not scaling, and
   I deleted it per the prototype skill's "rejection → delete" rule. Wrong
   call: the user wanted the *concept redesigned*, and it came back a round
   later as the Mapa variant (precomputed layout + semantic zoom). Before
   deleting a rejected variant, ask which axis was rejected — the mental
   model, or the execution.

2. **On canvas, every piece of text goes through ONE label engine.** Node
   labels, sublabels and edge labels drawn by separate code paths collide —
   "unreadable even for 1 node". The fix that held: a single priority queue
   (captions > selected/hover > focus-neighbours > rest by degree), one shared
   collision space, and a budget that grows with zoom; what doesn't fit is NOT
   drawn (it stays reachable via search/lists). Semantic zoom falls out of
   this for free.

**How to apply:** the only verification that catches these is *looking at
screenshots* — puppeteer at two viewports (1366×820 and 1920×1080), driving
real interactions, then eyeballing the PNGs. Pixel counts prove "something
drew"; only the screenshot proves it's readable. A canvas surface isn't done
until that pass is clean at both sizes.
Related: [[raf-guard-strictmode-trap]], [[konstrukt-visual-philosophy]].
