# Case ③ Law loop — batch 015 (2026-08-05)

Solo run. Army: 3 Sonnet verdict groups, 2 Sonnet collision readers, 1 Sonnet build agent,
1 fresh Opus adversarial auditor across FOUR rounds. Closure gated the pass-49 write throughout,
and it earned its keep three times over.

**The pass in one line:** the collision census reached FULL COVERAGE, the dependency map got its
product surface, the restored old verdicts were finally swept clean for readers — and the audit
cycle forced the loop's biggest methodological upgrade yet: whole-artifact invariants (digits,
syntax) in place of per-string pattern gates, after the auditor showed every code gate green
while a false ownership claim, two fabricated quotations and a falsified CZK figure sailed
through.

## Milestones

- **Collision census: 100 % coverage.** The final 12 pairs close-read; the partitioned universe
  (176 pairs from the 582-edge topology) is fully read — a line of work open since batch-005.
  Final wave: 3 confirmed (67×234 — the Babiš omnibus's narrow addition vs the architects'
  wholesale rewrite of their own home statute; 89×90 — the public-finance omnibus DELETES the
  pension-reserve odstavec bill 89 rewrites; 64×162 earlier in the queue) plus the honest
  RECLASSIFICATION of 13×16 under its own quotes (commuting edits — coordination-risk), leaving
  §604 as hub-and-spokes around tisk 64, not a fully confirmed triangle. The 111×207 pair
  gained a second-statute co-touch (359/1999). /zakony/kolize renders **136 pairs, 63
  confirmed, czechPending 0**.
- **The dependency map renders.** `getDependencyData` + `DependencyRadar` on /zakony: 18
  companion edges across 10 bills, every excerpt centered on the placeholder it evidences
  (18/18 verified via the real loader), every row marked „odvozeno · čeká na kontrolu", the
  weak 250→62 edge unlinked with a dashed „vazba nejistá" badge, out-of-corpus companions
  chamber-neutral („tisk 777 (mimo korpus)"), the spot-check scope MEASURED (1 of 18) rather
  than claimed, 23 unclears disclosed as a count. A concurrent session's half-landed i18n
  conversion (11 missing keys in both catalogs) was reverted to the surface's inline-Czech norm.
- **The old 27 verdicts are reader-clean.** The restore-resurrected jargon (urns in prose,
  batch ids in five declensions, filenames, prop names) swept across 18 bills / 28 strings
  (pass 49), each rewrite triple-gated: jargon + Czech + the new invariants. Render now shows
  **79 forensic blocks · 0 withheld** — the first zero since the render gate existed.

## Verdicts — 10 on the churn-4/5 head (pass 49, coverage 79/141)

3 medium / 7 low after the audit cycle:
- **tisk 74** (medium/3): the ČIŽP self-execution power's §1a explicitly EXCLUDES remedial
  orders under 167/2008 — the very statute the bill's stated purpose is to make enforceable.
- **tisk 215** (medium/3): §107a koncentruje standing to challenge university regulations
  solely in the minister; the once-lost §124a repeal traced to its general replacement.
- **tisk 171** (medium/3): the cross-chamber collision — the senate bill edits the exact
  odstavec the government bill (246) wholesale-rewrites, same effective date, no
  cross-reference; found independently from both sides and the mechanics reconciled.
- **tisk 161** (low/4 after correction): the batch's cautionary tale. The CEVYKO tie was
  elevated to medium as a „genuine private on-topic tie" — and CEVYKO is MUNICIPALLY owned
  (Havířov 35 % + a 45-municipality association), Niemiec on its dozorčí rada: the SOMPO class
  exactly. Corrected to a named-but-not-elevated municipal disposition; and the verdict's
  sharpest finding turned out to be one nobody went looking for — the bill's operative text
  grants relief „o 10 %" while its own DZ mostly (not „důsledně" — it also says „o 10 %"
  once) argues „o 10 procentních bodů": 54 % vs 50 % against a ~60 % target, uncommented.
- tisk 218's rider accusation was KILLED by the audit (the DZ discloses SAFE in its own §1.7)
  and the verdict honestly strengthened by its removal (confidence 3→4).

## The audit cycle — four rounds, and what it proved

Round 1: NOT READY, 12 blocking (CEVYKO false premise; a batch self-contradiction on CEVYKO's
sector; counts that don't close; a refuted accusation; the sweep falsifying „15 000 Kč" → „000
Kč" and stripping an identifier; fabricated quotations; missing i18n keys; truncated evidence
excerpts). Round 2: REOPENED (fixes introduced N-defects — splice wounds, a filename destroyed
„safely", grammar breaks). Round 3: REOPENED narrowly (the last two fabricated quotes and my
own two splice wounds). Round 4: **CLOSED**, with the auditor crediting the syntax invariant's
RELATIVE form (absolute parenthesis balance would false-positive on Czech legal enumeration
markers „písm. m)").

**The durable yield is the invariant set, now code in `sweep-old27-015.ts` and doctrine:**
1. A rewrite may never alter a digit sequence (allowlist: enumerated id drops, urn→číslo).
2. A rewrite may never worsen parenthesis balance nor introduce a mid-sentence stop.
3. Sponsor arithmetic must close against the payload.
4. Any guillemet quotation must be locatable verbatim (whitespace-normalized) in the cached text.
Every per-string gate was green in every round that carried the falsehoods — whole-artifact
invariants are what closed the gap.

## Not done — disclosed

- The sweep's residual jargon outside its rule set („v grafu případu law", „churn 6",
  „gatovanému", „uzel" — the auditor's inventory) — next batch's sweep scope.
- M18's duplicate dependency rows + a colocated test for the dependency loader.
- `public-copy.ts`'s hyphen hole (effort-case-owned; flagged to that loop).
- 62 bills still pending verdicts; §-level sector attribution still deferred.

## Metrics

| | |
|---|---|
| units | 10 verdicts + 12 pairs (census CLOSED) + 28-string sweep + 1 surface build |
| verdicts total | 69 → **79** (3 medium / 7 low new; mediums 16 of 79) |
| collision census | **176/176 pairs read — full coverage**; 136 render (63 confirmed) |
| withheld strings at render | 16 → **0** |
| audit rounds | 4 (NOT READY 12B → REOPENED → REOPENED → CLOSED) |
| graph writes | pass 49: 10 verdicts + 18 swept bill nodes |
| new invariants | digit + syntax (code), quotation-locatable + arithmetic-closure (doctrine) |

## Files

New: `scripts/case-loops/law/{prepare-batch-015,provenance-probe,extract-old27-jargon-015,sweep-old27-015}.ts`,
`features/lawwatch/getDependencyData.ts`, `features/lawwatch/components/DependencyRadar.tsx`,
`payloads/{batch-015-targets,batch-015-collision-queue,batch-015-old27-jargon,batch-015-old27-sweep,batch-015-verdicts-combined}.json`,
`payloads/verdicts-015/` (10), `payloads/collision-close-reads-batch015-g{A,B}.json`,
`batch-015-audit.md`, this note.
Modified: `lib/analysis/law-verdict.ts` (unicode-safe batch rule), `getCollisionData.ts`
(batch-015 wired), `LawWatchPage.tsx` + `app/zakony/page.tsx` (dependency section),
`prepare-collision-queue-012.ts` (--batch), `ledger.json`, `graph-log.md` (pass 49).
