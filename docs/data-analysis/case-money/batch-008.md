# Money loop — batch 008

Case ① FollowTheMoney · 2026-07-26 · fleet mode (law + effort drivers concurrent) ·
Sonnet driver + 1 Opus verification pass (max reasoning depth). Scope: the four items
in this batch's brief — Q-money-15 (live ARES-VR re-verification of the open
population, closing C17), Q-money-16 (finish the 5 dataor-blocked corroborations),
the indirect-ownership layer's first real question, and the kiosek money-watch
channel. **No commit. No live `.pglite` write. No `review_state` change.** All work on
a case-suffixed copy (`.pglite-copy-money-b8`, retained for the orchestrator to
inspect — not yet deleted, see §7).

## Live state at batch start (verified directly against `./.pglite`, not inherited
from a stale doc)

211 `linked_to` ties: **183 registry-confirmed · 19 conflicting · 9
registry-unconfirmed**. 33 `owns_stake` edges, 20 `notice` nodes, 36 `cites` edges, 0
`concerns` edges (a real gap, see §4). These numbers differ slightly from the
brief's inherited "181/21/9" — the orchestrator had already applied 2 of batch-006's
general-sweep closures (Černochová's Komwag tie and Ženíšek's Pojišťovna VZP tie)
before this batch started, moving 2 ties from `conflicting` to `registry-confirmed`.
Live DB state is ground truth; used throughout this batch instead of the brief's
numbers.

## 1. Q-money-15 — live ARES-VR re-verification of the open population, C17

`scripts/case-loops/money/reverify-open-vs-live-ares-vr.ts`. Re-fetched ARES VR
**live** (no cache, no reuse of any prior snapshot) for all **28** currently-open
ties (19 conflicting + 9 registry-unconfirmed), same exact-birth-date match
discipline as `reconcile-ares-vr.ts` (checks `statutarniOrgany` +
`ostatniOrgany` + `spolecnici`).

**Result: 1 flip out of 28 (3.6%).** Tomio Okamura ↔ MIKI TRAVEL PRAGUE, spol. s
r.o. (IČO 25124188) — `conflicting` → `registry-confirmed`, jednatel role,
1997-04-25→ongoing (Opus-verified below; note the 1997 date is a registry-entry
date, not a proven function-start date — worded that way in the payload's
`reviewer_note`). Payload:
`docs/data-analysis/case-money/payloads/batch-008-qmoney15-live-flips.json`
(1 props-merge proposal, gated clean —
`scripts/case-loops/money/validate-batch008.ts`, 1/1).

**Honest answer to "how many flip": few — 1 of 28.** This is the expected result
per the brief's own framing; the batch-006 finding that motivated this check (C17)
was TWO specific mislabeled ties, both already fixed by batch-006 itself, not
evidence the whole open population was wrong. Re-checking the WHOLE remaining
open population confirms it mostly holds: **16 genuine confirmed negatives**
(exact-date miss AND zero surname hits across the full officer/shareholder
tree — Opus-verified, see §5), **9 still-unresolvable 404s** (structural —
special-law/church/public bodies outside the commercial register, Opus
re-verified live), and **1 flip**.

**Opus caught 2 real negative-label defects** during verification (not caught by
the driver's own review): Jana Černochová↔Nadační fond Českého rozhlasu and
Lukáš Vlček↔PRO VYSOČINU were labeled "confirmed negative" but shouldn't have
been — Černochová's VR record has 2 same-name entries with NULL birth date (the
exact-date matcher structurally can't see them — this is precisely why **P36**'s
name-similarity fallback exists, and this script regressed against it), and
Vlček's record has no officer section at all (per **C11**, absence from a
record that carries no officers is unverified, not confirmed). Both
reclassified to `unverifiedNotConfirmed` in
`docs/data-analysis/case-money/qmoney15-summary.json` — no graph harm (both
ties stayed `conflicting`, nothing was closed on a false negative), but the
label was wrong and is now corrected. Boris Šťastný↔ČLK flagged borderline
(thin 1-officer SR record) but not reclassified.

**C17 is CLOSED** by this batch — the exact remedy the contradiction called for
("a re-run against the live endpoint... is warranted") has been executed against
the FULL open population, not just the 2 ties that motivated it. Exact text to
append to `contradictions.md` §C17 is in `handoff.md`.

## 2. Q-money-16 — the 5 dataor-blocked corroborations: STILL INCOMPLETE

Retried the exact command batch-006 documented (`handoff.md` §7 lesson 4):
`curl -sS -L http://dataor.justice.cz/api/file/sro-full-{praha,brno}-2026.csv.gz
-o .dataor-cache/... --max-time 540-550`. **Two attempts each**, budgeted ~9 min per
attempt (18+ min total network budget spent this batch, within a bounded
foreground-execution discipline per the patterns.md lesson batch-006 wrote about
this exact failure mode). Both files stalled well short of completion both times;
`gzip -t` confirms both downloads are truncated/corrupt, not usable.

**Sharper finding than batch-006's "slow connection" framing**: `sro-full-praha-2026.csv.gz`
stalled at **70,995,968 bytes on attempt 1 and 70,997,242 bytes on attempt 2** —
within ~1.2KB of each other, on two independent curl processes run minutes
apart. That is NOT the signature of random network flakiness (which would stall
at unrelated byte offsets); it is the signature of a **fixed server-side or
proxy cutoff around ~71MB** (a reverse-proxy idle/total-time limit, a CDN
response-size cap, or similar) that both attempts hit identically. This
reframes the problem: a longer `--max-time` alone will NOT fix it (both
attempts had budget left when they stalled), and a genuinely different
approach is needed next batch — HTTP Range/resume requests (`curl -C -`,
untried this batch — unknown whether dataor's server honors it), a different
transfer path, or splitting the request some other way. `sro-full-brno-2026.csv.gz`
reached ~65MB on attempt 1; attempt 2 was still in flight/incomplete when this
batch closed out (see handoff.md for its final status if it landed after this
was written).

**Honest gap, not resolved this batch.** This reproduces batch-006's exact finding
rather than fixing it — the connection-side network-budget problem is
structural to this environment, not a one-off. The 5 ties this blocks
(Bauer↔TAMPA, Kučera↔Sirius Praha, Šafránková↔Pražská VŠPS — `sro-full-praha`;
Jurečka↔AGRO 2000 — `sro-full-brno`; **Okamura↔MIKI TRAVEL is now closed via
Q-money-15's independent ARES-VR path instead**, so this is 4 remaining, not
5) stay open via the dataor channel. A future batch should either widen the
`--max-time` budget further (both attempts here used 540-550s — untested
whether e.g. 25-30 min would clear it) or find dataor's per-court/form
splitting granularity to shrink these two files (Praha and Brno are the two
largest jurisdiction files in the catalog by construction — a size-driven
problem, not fixable by retry alone).

## 3. The indirect-ownership layer's first real question

`scripts/case-loops/money/indirect-ownership-exposure.ts`. Given the 33
`owns_stake` edges, computed: which MP-tied companies sit under a parent that
ALSO owns OTHER companies holding public contracts (sibling-level indirect
exposure the direct `linked_to` join can't see).

**Result: 26 raw leads, 0 with a sibling NOT already independently tied to an
MP** — every sibling company holding public contracts under a shared parent
was already directly tied via its own `linked_to` edge (the AGROFERT cluster:
Babiš tied directly to AGROFERT, Synthesia, AND IMOBA already; the rest are
municipal ownership structures — Praha/Plzeň/kraje own multiple utilities,
each with its own MP board-seat tie).

**Opus verdict: PARTIAL / under-derived** — the arithmetic holds but the
"0 genuinely new exposure" framing overclaims. The result is near-tautological
by construction: the company universe checked is built FROM `linked_to` ties,
so almost any sibling found will already be tied. **Two dimensions were never
examined**: (1) **parent-level exposure** — of 24 distinct parents, 8 are
PRIVATE and NOT MP-tied (B.S.-KINGS s.r.o., UNICO Pardubice a.s., Rybářství
Třeboň Hld. a.s., Léčebné centrum sv. Markéty a.s., Lázně Luhačovice a.s., DEZA
a.s., ČSOB, České dráhy) — contracts flowing to those parents THEMSELVES
weren't checked (the public-body parents are correctly out of scope — they're
the contracting authority, not MP money); (2) **descendant/multi-hop
exposure** was available in the already-fetched data (B.S.-KINGS → IF Holding
→ IF FACILITY; AGROFERT HOLDING → AGROFERT → Synthesia → SynBiol → IMOBA) and
unused. **Corrected conclusion**: sibling-level exposure is 0 by construction;
parent-level and descendant-level are the real open question, not yet
examined. **What breadth would change it**: widen the fetch to the 8 private
non-MP-tied parents' own contract exposure, and extend one hop further on the
already-cached AGROFERT and B.S.-KINGS chains.

**Data-integrity flag (Opus-caught):** `chainsExamined` has 39 rows for 33
declared `owns_stake` edges — duplicate child←parent rows (MERO ČR ×2, AGROFERT
←AGROFERT HOLDING ×2, Operátor ICT ×2, Plzeňské MDP←Město Plzeň ×3). Needs
reconciling in the `owns_stake` payload before "33" is quoted again as a clean
edge count. Not fixed this batch (read-only analytical pass, source payload is
batch-006's, not this batch's to edit without re-opening that batch's scope).

Full corrected verdict + integrity flag recorded in
`docs/data-analysis/case-money/qmoney-indirect-exposure-b8.json`
(`opusVerdict` field).

## 4. kiosek as the money WATCH channel

`scripts/case-loops/money/kiosek-watch.ts` — the repeatable check: does ANY
court-notice IČO (via `concerns` edges, notice→company) match ANY MP-tied
company IČO. Designed to re-run every batch or whenever kiosek ingests a new
slice, not a one-off script.

**Current hits: 0 — but the check is a zero-power baseline, not a finding**
(Opus verdict). Two reasons: (a) **the live-graph half is vacuous** — 0
`concerns` edges exist in the graph at all, despite `concerns` being a live
`KG_EDGE_RELS` member since batch 007 and `cites` (the law-side sibling
relation) already carrying 36 edges. Kiosek's money-relevant half was
apparently never persisted — **flagged as a real gap for the orchestrator /
case-sources driver**, not this batch's boundary to fix (`lib/analysis/kg-money*`
+ `money-feed*` is money's boundary; the kiosek ingest lives in case-sources).
(b) The secondary check against case-sources' still-unapplied
`kiosek-payload.json` (24 `concerns` proposals, 20 distinct IČOs) also returned
0 — genuine, but every one of those 24 proposals already carries
`targetExists: false` (none of the 20 IČOs is even a graphed company node), so
0 was arithmetically guaranteed before the join ran, and 20 notices against 195
tied companies is a very low-power sample regardless.

**This confirms and generalizes batch-006's finding** (kiosek's IČOs are a
disjoint population from tied companies, monitoring not enrichment) rather
than contradicting it — but the honest framing is "no evidence yet, in either
direction, because the test currently has no power," not "confirmed clean."
The watch script itself is real infrastructure (re-runnable, reads both the
live graph AND the pending-proposal file) — power grows automatically as
kiosek volume grows and once `concerns` edges land live.

Output: `docs/data-analysis/case-money/kiosek-money-watch-b8.json`.

## 5. Opus verification (P51) — full verdict

One pass, maximum reasoning depth, three tasks: verify the Q-money-15 flip,
sanity-check the ownership-exposure conclusion, general batch QA. Full verbatim
verdict:

> **Task 1 — Okamura ↔ MIKI TRAVEL flip: HOLDS (fully independently
> reproduced).** Re-fetched ARES VR live (HTTP 200, current). Birth date
> re-derived independently from psp.cz open data (04.07.1972, no collision
> with Hayato Okamura). Ambiguity check clean (4 distinct birth dates in the
> whole record, all four 1972-07-04 hits are Tomio Okamura). Role correct
> (jednatel, not owner — `spolecnici` are all legal persons, so `tie_class`
> stays `manager`). Validity dates correct for a non-obvious reason (4 chained
> record versions, gapless — flattener risk noted for future records with
> gaps). Independent-channel claim TRUE — this is ARES VR REST, not dataor.
>
> **Spot-check of 18 confirmed negatives (Opus swept all 18): 2 defects
> found** — Černochová/Nadační fond (null-birthdate entries invisible to the
> exact matcher, P36 regression) and Vlček/PRO VYSOČINU (no officer section at
> all, C11 case). Šťastný/ČLK flagged borderline. The other 16 genuine.
>
> **9 still-unresolvable 404s: HOLD** — independently re-fetched, all 9 return
> NENALEZENO live, structural.
>
> **Task 2 — "0 genuinely new indirect leads": PARTIAL / under-derived.** [full
> text folded into §3 above]
>
> **Task 3 — general batch QA: PARTIAL.** qmoney15-summary.json 404 set holds;
> confirmedNegatives needed the 2 corrections above. kiosek-money-watch-b8.json
> — the live-graph half is vacuous (0 vs 195, not a test); the proposal-file
> half is real but arithmetically guaranteed to be 0 given `targetExists:
> false` on all 24 proposals; 20 notices is very low power regardless. Keep as
> a repeatable watch, label current output a zero-power baseline.
>
> **Net:** one money-touching claim verified and it holds cleanly, including
> dates and channel-independence; two negative-label defects corrected (one a
> real P36 regression); one conclusion re-scoped from "0 exposure" to "0
> sibling-level exposure, parent/descendant unchecked."

Both corrections (qmoney15 negative-label reclassification, ownership-exposure
verdict) applied directly to their JSON artifacts this batch (`opusVerdict`
fields) — this is read-only analysis, not a graph write, so no gate was
needed to apply them.

## 6. Validation commands (for the orchestrator)

```bash
# 1. Gate the one graph-write proposal this batch produced:
PGLITE_PATH=./.pglite-copy-money-b8 npx tsx scripts/case-loops/money/validate-batch008.ts
# → 1/1 live-flip proposal validates.

# 2. Full suite / typecheck:
npx tsc --noEmit    # clean, no errors
npx vitest run      # unchanged from batch 006 (no test-touching code this batch)

# 3. Inspect the payload before persisting:
cat docs/data-analysis/case-money/payloads/batch-008-qmoney15-live-flips.json
```

## 7. Cleanup

`.pglite-copy-money-b8` **NOT deleted** — left in place for the orchestrator to
re-run the gate command directly rather than re-copying `./.pglite`. Safe to
delete after the orchestrator applies the payload. `.dataor-cache/`'s two
partial/truncated `sro-full-{praha,brno}-2026.csv.gz` files were left in place
(harmless — `fetchDatasetCsv`'s cache convention only trusts a decompressed
`.csv`, never a `.csv.gz`, so a truncated `.gz` cannot be silently treated as
valid data by any downstream script) rather than deleted, so a future batch's
retry doesn't need to re-download the ~65-70MB that DID transfer if the server
ever supports range requests (`curl -C -`, untried this batch).
