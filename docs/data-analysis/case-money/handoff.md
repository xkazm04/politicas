# Money loop — fleet handoff (batch 005)

Case ① FollowTheMoney · 2026-07-25 · fleet mode (effort + law loops
concurrent) · Sonnet driver + 5 Sonnet subagents (review-order triage +
console build, review_audit CHECK migration, Q-money-13 stale-mention
cleanup, Juchelka dossier, Okamura dossier) + 2 Opus verification passes
(one per lead dossier). Everything the orchestrator needs to review and
persist. All work is inside the money boundary. **No commit made. No live
`.pglite` write. No `review_state` flipped anywhere** (all reads happened on
scratch `.pglite-copy-*` copies, deleted after use, never `./.pglite`). This
document supersedes batch 004's `handoff.md`, now historical.

## 1. Review-order triage + console session-support build (batch-005 priority #1)

**Shipped, uncommitted, in the tree:**

```
EDIT  features/money/reviewTypes.ts                # reviewTier() + reviewRank() pure helpers,
                                                     # ReviewTie.reviewTier/reviewRank, ReviewStats.tierCounts
EDIT  features/money/getVerificationData.ts         # computes reviewTier/reviewRank per tie;
                                                     # PRIMARY sort now reviewRank asc (was signalScore desc);
                                                     # stats.tierCounts added
EDIT  features/money/components/VerificationConsole.tsx  # tier badge per card, tier section headers,
                                                     # sticky filter/progress bar, per-tier reviewed/remaining
                                                     # tiles, keyboard shortcuts (j/k or ↓/↑ to move focus,
                                                     # 1/2/3 to confirm/needs-more/reject the focused card)
EDIT  scripts/case-loops/money/triage.ts            # mirrors reviewTier/reviewRank exactly (comment: must
                                                     # agree with reviewTypes.ts); merge-preserves ledger.json
                                                     # summary history instead of blind-overwriting (bug found
                                                     # + fixed this batch, see §7)
NEW   docs/data-analysis/case-money/payloads/batch-005-review-rank.json   # 211 {src,dst,reviewTier,reviewRank}
```

**Logic**: tier 0 = registry-confirmed owner-operator, 1 = registry-confirmed
manager, 2 = registry-confirmed steward, 3 = everything else (unconfirmed /
conflicting). `reviewRank = tier·1e12 + (1e12 − reachableCzk)` — a pure
per-tie value (same pattern as `signalScore`), ascending sort gives
tier-first-then-money-desc-within-tier with no global re-sort needed.

**Distribution (211 real ties, post-OSVČ-purge population)**:

| tier | class | count | max reachable CZK |
|---|---|---|---|
| 0 | registry-confirmed owner-operator | **34** | 186.6M |
| 1 | registry-confirmed manager | **20** | 2.84bn |
| 2 | registry-confirmed steward | **125** | 6.09bn |
| 3 | unconfirmed / conflicting | **32** | 674.8M |

(Steward's much higher CZK ceiling — public-body money that is the body's
own activity, not MP enrichment — is exactly why class-priority ranking was
needed over raw signal/money order; this was the batch-001 finding this
batch's build directly operationalizes.)

**UX shipped**: tier badge next to the existing class/signal badges; a
section header wherever the tier changes as the (now tier-ordered) queue is
rendered; sticky filter+progress bar; per-tier X/Y counters reusing the
existing honest-counting rule (D3, batch 004 — only `status:"done"` writes
count when write-configured); focused-card ring in `border-signal`; footer
copy updated to state the review-order axis is separate from `signalScore`.
Existing design tokens only, no new colors, no new component files beyond
what already existed.

**Checks**: `npx tsc --noEmit` clean; scoped `eslint` clean (one
unescaped-JSX-quote and one empty-catch fixed along the way); `npx vitest
run` → **205/205** passed (194 at batch start; +11 from this batch's own +
concurrent sibling work).

## 2. Live-table `review_audit` CHECK migration (D5 closure)

**Shipped, uncommitted:**

```
NEW   scripts/case-loops/money/migrate-review-audit-check.ts
NEW   docs/data-analysis/case-money/payloads/batch-005-review-audit-check-migration.json
```

Adds the `review_audit_decision_check` CHECK constraint (`decision in
('confirm','reject','needs-more')`) to the **existing, pre-batch-004**
`review_audit` table via `ALTER TABLE`, closing the batch-004 D5 caveat
(the CHECK in `ddl.ts` only applies to freshly-created databases; the live
table, created batch 003, has none). Mirrors `purge-osvc.ts`'s exact
dry-run/`--commit`/`--confirm-live` safety-gate convention. Idempotent
(checks `information_schema.check_constraints` for the constraint name
first) and refuses to add the constraint if any existing row would violate
it (pre-check query, prints offenders, aborts).

**End-to-end test** (against `.pglite-copy-migration-test`, deleted after):
dry-run → `already exists: false`, `violating rows: 0`, prints the exact
ALTER; `--commit` → constraint applied; re-run `--commit` → `already
exists: true`, no-op, no error; a scratch insert of `decision =
'bogus-decision'` after migration correctly raises a check-constraint
violation.

**Orchestrator command for the live table**:
```
npx tsx scripts/case-loops/money/migrate-review-audit-check.ts --dry-run
# then, when ready (PGLITE_PATH left unset → targets the default ./.pglite deliberately):
npx tsx scripts/case-loops/money/migrate-review-audit-check.ts --commit --confirm-live
```

`npx tsc --noEmit` clean for the script.

## 3. Q-money-13 — stale IČO-04627695 prop-content cleanup

**Payload only, not applied** (fleet rule: no sibling props edits):

```
NEW   scripts/case-loops/money/find-stale-ico-mentions.ts     # read-only
NEW   scripts/case-loops/money/build-stale-ico-payload.ts     # read-only
NEW   docs/data-analysis/case-money/payloads/batch-005-stale-ico-mentions.json
```

**Actual count: 26 prop-content mentions across 24 distinct nodes** (not
~10 as the batch spec estimated) — **19 `psp:person:*` nodes** (effort
loop's `effort_notes`) and **5 `bill:tisk:*` nodes** (law loop's
`forensic_citations[i]` / `forensic_conflict_assessment`), 0 ambiguous
(every hit is genuinely about the purged tie, nothing off-target).

**Notable finding**: most `effort_notes` had *already independently
flagged* IČO 04627695 as a suspected data-pipeline placeholder / zero-value
non-conflict across multiple dossiers, before the batch-004 purge even
happened — the effort loop's own analysts got there first. The proposed
correction is therefore a **confirmation/closure annotation appended to the
existing text**, not a rewrite, per the "don't erase history" instruction —
representative sample (bill:tisk:43111, `forensic_citations[14]`):

> *current*: `"Graph records co-sponsor Ivan Bartoš (pspId 6433) with one
> recorded money tie, an OSVČ entity (ičo 04627695), carrying a contract
> value of 0 Kč — no actual public money flow and no connection to this
> bill's subject matter."`
>
> *proposed* (appended): `... [BATCH-005 UPDATE, driver, money-loop]:
> Money-loop batch 004 formally closed this question: IČO 04627695 is NOT
> an unresolved data-pipeline placeholder but a real, unrelated entity
> (Agrární demokratická strana, a registered micro political party) whose
> ARES obchodniJmeno field literally contains the string "OSVČ" — an
> exact-name-matching bug (pickExactIco in lib/analysis/money-feed.ts)
> incorrectly linked this company to 49 MPs whose occupation was loosely
> described as "OSVČ" in Hlídač data. All 49 zero-value linked_to edges to
> company:ico:04627695 were deleted in batch 004 as confirmed
> false_edge_suspected; the company:ico:04627695 node itself was also
> deleted (nothing else referenced it). This entry's own conclusion (no
> individuating substance / not a conflict) already stood — this note only
> formalizes closure of the data-quality question already flagged here.`

**Coordination note for the effort and law drivers** (orchestrator to
relay before applying): *"Money-loop batch 004 purged 49 false `linked_to`
edges + the `company:ico:04627695` node itself — a name-matching bug
(literal ARES string "OSVČ") that had nothing to do with any MP's real
occupation. Your dossiers/citations that mention this IČO in free text
(effort: 19 `effort_notes`; law: 5 `forensic_citations`/
`forensic_conflict_assessment`) already correctly treated it as a
non-finding — the money loop's proposed payload only appends a short
closure note confirming the purge, it does not change your original
analysis or conclusion. Please review the exact wording in
`batch-005-stale-ico-mentions.json` before the orchestrator applies it, in
case any of your dossiers want different phrasing for their own voice."*

Payload: `docs/data-analysis/case-money/payloads/batch-005-stale-ico-mentions.json`
(26 entries, `{nodeId, nodeKind, propKey, currentText, proposedText,
rationale}`).

## 4. Q-money-5 — Juchelka lead dossier (Opus-verified)

Full four-stage treatment. Subject confirmed: **Aleš Juchelka** (ANO 2011),
sitting MP (current term from 2025-10-04, Moravian-Silesian Region),
Minister of Labour and Social Affairs since **2025-12-15**.

**The actual story** (corrected from the one-line ledger note, which
implied the conflict was Juchelka's own): his ministerial advisor
**Alexandra Semancová** owned SIPTRADE s.r.o. (IČO 24225525, confirmed
100% via ARES-VR since 2012-06-04) while overseeing EU subsidy-distribution
rules her firm's clients benefited from. Broken by Seznam Zprávy/ČT24
2026-03-19; on 2026-07-24 ČT24 confirmed MPSV will **not claim** EU
reimbursement for 63.8M + 17.6M CZK (= 81.4M CZK, this dossier's own sum;
media cite a wider 103M CZK exposure figure) pending an administrative
check, funding those projects from the state budget instead. Juchelka
publicly defended Semancová ("spiknutí"/"hon na její osobu") and retained
her roughly a month post-story before she left the role; she was originally
hired by his predecessor Marian Jurečka (KDU-ČSL), so the hire itself
predates Juchelka.

**Opus verdict (independent re-fetch of all 6 primary/media sources)**:
evidence chain **HOLDS**. The ARES-VR negative ("no registry tie between
Juchelka and SIPTRADE") is independently confirmed for SIPTRADE
specifically — but the original draft over-extended it to "any
Semancová-linked entity," which Opus flagged as unverified over-reach (a
single-IČO query cannot support that claim). Three corrections required and
**applied by the driver**: (1) a self-contradictory ministerial-appointment
date fixed to 2025-12-15; (2) "reimbursement forfeited" softened to "will
not claim, pending an administrative check into whether a loss occurred"
(the ministry's actual framing); (3) the ARES-VR negative narrowed to
SIPTRADE specifically, with the broader-sweep gap now stated explicitly
rather than implied as closed. Framing verdict: honest, correctly separates
"unmanaged conflict of interest around the advisor" from "personal
enrichment by Juchelka" (Opus explicitly said not to loosen this line);
symmetry check passed (political demands labeled as such, no edge
proposed). **Final: confidence medium, safe to land as `pending_review`
annotation after the applied edits** (done — payload is post-edit).

Payload (post-Opus-edit): `docs/data-analysis/case-money/payloads/batch-005-lead-juchelka.json`.
`proposedAnnotation.edgeProposed: false` (no registry evidence ties
Juchelka to any company — correctly no graph edge proposed, annotation
only, `requiresGate: true`).

## 5. Q-money-6 — Okamura lead dossier (Opus-verified)

Full four-stage treatment. Subject confirmed: **Tomio Okamura** (SPD),
elected Speaker of the Chamber of Deputies **2025-11-05** (corrected — the
Sonnet draft had a future/impossible 2026-11-05 date).

**The claim**: Okamura held a 10% stake (20,000 CZK) in **U Machtů s.r.o.**
(IČO 27145433, restaurant "Staré časy," Prague), 2004-05-20 to 2016-02-01
per ARES-VR. HlídacíPes's original investigation reports this sale is
absent from his 2016 majetkové přiznání, inferring from the company's
turnover that the price plausibly exceeded the 100,000 CZK disclosure
threshold; no transfer document with a price was located in the public
register.

**Opus verdict (independently re-derived ARES-VR from the primary
endpoint, not from prior-batch prose)**: evidence chain **PARTIAL** —
core registry timing (2004-05-20 → 2016-02-01, 10%) holds, but Opus caught
**a fabricated successor detail that had propagated silently across two
batches**: the draft claimed Roman Wurst's share *increased* on
2016-10-29; the primary ARES-VR record actually shows Okamura's *entire*
10% stake was absorbed the **same day** (2016-02-01) by **Marcel
Zákostelecký alone** (140,000→160,000 CZK, an exact +20,000 CZK match) —
Wurst's holding is unchanged throughout, his 2016-10-29 record is a
re-registration at the same value. batch-002's earlier note ("sold to
existing co-owners Wurst/Zákostelecký") was NOT independent corroboration
of this detail, just an under-specified restatement that batch-005 then
over-specified incorrectly — corrected now to the actual registry math.
Two further corrections: **Týden.cz is not an independent second source**
— its own text credits HlídacíPes as origin, so the media basis is one
original investigation plus pickups, not "twice-independently-published"
as the draft claimed; and a Sensepocket/Hiro non-disclosure detail was
mis-dated to 2016 when HlídacíPes actually places it in spring 2017 (now
flagged as a separate, later-year matter, not evidence for the same 2016
declaration). All 5 corrections **applied by the driver**. Opus explicitly
confirmed the "what sources do/don't sustain" legal-hedging split (that a
non-disclosure-law *violation* is not established, only the media's
inference and the registry timing) was already honest and did not need
loosening — the correction, if anything, makes the ownership-timing claim
land MORE cleanly (same-day, exact-value, squarely inside calendar 2016).
**Final: confidence medium, safe to land as `pending_review` annotation
after the applied corrections** (done — payload is post-edit).

Payload (post-Opus-edit): `docs/data-analysis/case-money/payloads/batch-005-lead-okamura.json`.
Annotation only on the existing `tie:6105:27145433` — no new edge proposed
(the tie already exists in the graph); `requiresGate` implicit via
`annotation_only_proposal` type, no `review_state` change.

## 6. Process note — an agent that stopped mid-task

The Q-money-13 subagent initially ended its run with "waiting for a
background script to finish," violating the kernel's "a driver never ends
its run waiting" rule. The driver caught this (no result had landed,
report was incomplete) and resumed it via a direct message restating the
rule and asking it to diagnose/finish rather than wait; it completed
correctly on resume (§3 above). Worth a standing note for future batches:
**a subagent's own stop is not evidence of completion** — the driver must
verify a real result landed (payload file exists, report is substantive)
before treating any dispatched unit as done, same discipline as
"census-first" from batch 004's lesson 1.

## 7. Bug found and fixed (incidental, review-triage build)

`scripts/case-loops/money/triage.ts`'s `ledger.json` write was a blind
overwrite — running it to generate the `review_rank` payload this batch
wiped the `batch1`–`batch4` history nested under `summary`. Caught and
fixed within the same build pass: history restored from git HEAD, a
`batch5` entry added, and the write changed to merge-preserve prior
`summary` keys (warn-on-catch, not silent) so this cannot recur. No
external data lost — caught before finalize.

## 8. `npm run check` status

`npx tsc --noEmit` clean across all touched files. `npx vitest run` →
**205/205** (194 at batch-004 close; +11 from this batch's own additions).
Scoped `eslint` clean on all touched files (two pre-existing style issues
fixed incidentally: an unescaped JSX quote, an empty catch block). No
commit run — orchestrator's call per fleet rules.

## 9. Proposed enum / schema changes

- `ReviewTie.reviewTier: 0|1|2|3` and `reviewRank: number` — additive,
  derived/computed at read time (same pattern as `signalScore`), no DB
  schema change. A standalone persistable payload
  (`batch-005-review-rank.json`, 211 `{src,dst,reviewTier,reviewRank}`
  entries) is prepared if the orchestrator wants to persist it into
  `kg_edge.props` on next ingest — NOT written live this batch.
- `review_audit_decision_check` CHECK constraint — additive, migration
  script proven end-to-end on a copy, not yet applied live (§2, orchestrator
  action required).
- No change to `corroboration`/`tie_class`/`temporal_status` value sets.

## 10. Shared-vault additions (exact text to append — not edited myself, fleet rule)

**`patterns.md`** (proposed new entry): *"A subagent's own stop is not
evidence of completion — verify a real artifact/result landed before
treating a dispatched unit as done (money batch-005, Q-money-13 initially
stopped mid-task waiting on itself)."*

**`patterns.md`** (proposed new entry, batch-004 lesson generalized):
*"Deterministic scripts that regenerate a shared/append-only JSON file
(ledger.json, etc.) should merge-preserve prior history by default, not
overwrite wholesale — money's `triage.ts` had this exact bug for its own
`ledger.json` summary block, caught only because a build pass happened to
re-run it (batch-005 §7)."*

**`contradictions.md`** (proposed new entry): *"batch-002's Okamura/U Machtů
successor note ('sold to existing co-owners Wurst/Zákostelecký') was later
(batch-005) found to be under-specified in a way that let a wrong specific
detail (Wurst's share increasing) propagate as if corroborated across two
passes — the actual registry math (Zákostelecký alone, same-day, exact
value) was only caught by Opus independently re-deriving from the primary
endpoint rather than trusting the prior batch's prose. General lesson:
prose 'corroboration' between batches is not independent unless each pass
re-derives from the primary source."*

No other shared vault files or shared code enums touched.

## 11. Validation commands (for the orchestrator)

```
# 1. Re-check the review-order triage build:
npx tsc --noEmit
npx vitest run
npx eslint features/money scripts/case-loops/money

# 2. Live-table CHECK migration (dry-run first, always):
npx tsx scripts/case-loops/money/migrate-review-audit-check.ts --dry-run
npx tsx scripts/case-loops/money/migrate-review-audit-check.ts --commit --confirm-live

# 3. Q-money-13 stale-mention payload — review before applying, coordinate
#    wording with effort/law drivers per §3, then apply via the standard
#    props-merge persist path (never props = excluded.props wholesale-replace,
#    per kernel P44/D1):
cat docs/data-analysis/case-money/payloads/batch-005-stale-ico-mentions.json

# 4. Lead dossiers — both Opus-verified and driver-corrected, ready to
#    persist as pending_review annotation payloads:
cat docs/data-analysis/case-money/payloads/batch-005-lead-juchelka.json
cat docs/data-analysis/case-money/payloads/batch-005-lead-okamura.json

# 5. Optional: persist review_rank into kg_edge.props on next ingest:
cat docs/data-analysis/case-money/payloads/batch-005-review-rank.json
```

## 12. Lessons learned

1. **A subagent's own stop is not evidence of completion** (§6) — the
   driver must verify a real artifact landed, not just that the agent
   returned without error.
2. **Opus verification earned its keep exactly where the kernel predicts**:
   both money-touching leads about named politicians had real defects a
   Sonnet-only pass had accepted — Juchelka's over-broad registry negative
   and date inconsistency, Okamura's fabricated successor detail and
   mislabeled "independent" source. Neither was a fabrication from thin
   air; both were plausible-sounding over-extensions of a real finding —
   exactly the failure mode the doctrine warns about ("a research agent's
   confidence label is a claim to verify, not a fact").
3. **Prose "corroboration" across batches is not independent verification**
   unless each pass re-derives from the primary source (§10,
   contradictions.md entry) — this generalizes batch-002/003's own
   lessons about re-deriving ground truth rather than trusting a prior
   pass's writeup.
4. **Deterministic regeneration scripts need merge-preserve by default**,
   not just the human-write layer (§7) — this is the SAME durability
   principle as D1 (batch 004), now shown to apply to a purely
   analytical/derived artifact too, not just human-gated fields.
5. **Fleet concurrency**: 5 foreground-dispatched Sonnet subagents (review
   triage/console, CHECK migration, Q-money-13, 2 lead dossiers) + 2 Opus
   verification passes, one resumed after an incomplete stop — 8 total
   agent runs this batch, within the ≤6-8 concurrent budget per wave.

## 13. Cleanup

All scratch `.pglite-copy-*` directories (`.pglite-copy-money-batch5`,
`.pglite-copy-migration-test`, `.pglite-copy-money-q13`) were created and
deleted within their respective agent runs. No live `./.pglite` write
occurred at any point. No `.pglite-copy-<other-case>` directory belonging
to the concurrent effort/law loops was touched.
