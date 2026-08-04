---
name: language-gate-false-positives-on-registry-czech
description: The Czech language gate calls 14/211 genuinely Czech money-tie notes English — never use it to WITHHOLD registry prose, only to gate copy we author
metadata:
  type: project
---

`lib/analysis/language-gate.ts` is a stopword-frequency classifier over two closed
word lists. That works on the law-forensics verdicts it was built for (long, fluent
prose) and **misfires on short registry Czech**, which is dense with words that are
English homographs:

- `OR` = obchodní rejstřík — but `or` is an English stopword.
- `evidence` (jiná evidence, evidence subjektů) — an English stopword too.
- `ARES VR`, `IČO`, `s.r.o.` contribute no Czech signal either.

Measured 2026-08-04 over the 211 `linked_to` ties: `isCzechSafe()` returns **false
for 14 of 211** `props.reviewer_note` values, and every one of them is Czech. Below
16 tokens the gate switches to `english >= 2 && english >= czech`, so two homographs
in one clause are enough.

Consequence, and the rule taken from it: **the gate binds copy WE write, not evidence
the graph carries.** `features/money/tieFlags.test.ts` runs every flag sentence in the
dictionary through `isCzechSafe`; the stored analyst notes are rendered in full on both
`/penize/[pspId]` and `/penize/kontrola` and are NOT withheld. Withholding a reviewer's
own evidence on a false positive is worse than the defect the gate exists to prevent —
and on the console it would hide the only registry finding the tie carries.

If a future pass wants render-time withholding for graph prose, it needs a classifier
that scores registry vocabulary, not this one.
