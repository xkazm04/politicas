# Case ② Effort — Batch 002 handoff (fleet)

For the orchestrator holding the single-writer resources (live `.pglite`, shared vault,
git). Everything below is validated on `.pglite-copy-effort`; nothing here was committed
or written live. **The copy is disposable** — recreate + re-verify with the commands in §1.
Batch 001 (pass 14, 20 MPs + PSP9 restoration) is already live and committed
(`30226a0`) — this handoff is additive on top of that state.

---

## 1. Graph payloads (validated; re-verify command included)

### 1a. Person-node enrichment props — 30 MPs (`payloads/batch-002-props.json`)
Namespaced `effort_*` props on existing `psp:person:*` nodes (merged from 6 grouped-agent
payloads, `payloads/batch-002-group-{A..F}.json`, already folded into the single
`batch-002-props.json`). **No** contribution number is proposed. Persist as a read-merge
onto the person node's `props` (same pattern as batch 001), tagging provenance
`{track:"effort", pass:<assigned>, method:"deterministic|enrichment", ref:"effort-batch-002", computedAt}`.
`review_state` stays `pending_review` — annotations never flip the human gate.

Re-verify id-membership + closed-vocabulary before persisting:
```
cp -r .pglite .pglite-copy-effort
PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/gate.ts payloads/batch-002-props.json
# expect 30/30 PASS, 0 DROP
```
(`gate.ts` now takes a payload-file argument, defaulting to `batch-001-props.json` for
backward compatibility, and additionally validates `effort_low_score_reason` against the
closed vocabulary — a batch-002 gate hardening.)

### 1b. KNOWN DATA-QUALITY ISSUE in the payload — reviewer TODO before persist
**Bohuslav Niemiec (id in payload)** — `effort_notes` states his CEVYKO a.s. link carries
**IČO 08599254**, but the dossier's own cited firemniprofil URL shows **72160340**. The
enrichment agent did not reconcile this (Opus reflection §5 caught it on review). One of
the two is wrong. **Recommend**: before persisting, either re-verify the correct IČO
against ARES directly, or persist the prop with the IČO field omitted/marked uncertain
rather than picking one blind. This is the one concrete quality lapse this batch — see §5.

### 1c. Deferred edge ideas (carried over from batch 001, reinforced this batch — NOT persisted)
- `officer_by_office` pattern recurred TWICE this batch (Niemiec→CEVYKO a.s., Havířov
  municipal waste entity; Žbánek→former-mayor Olomouc municipal companies), on top of
  batch 001's Zarzycký/Karpíšek instances. Four total instances across two batches now —
  the deferred `link_kind` prop on `linked_to` (money loop's boundary) is increasingly
  well-evidenced. Still deferred pending the money loop's decision (their edge semantics).
- No new edge rel proposals this batch beyond what batch 001 already deferred.

---

## 2. Shared-vault additions (exact text to append — I did not edit these files)

### → `frontier.md` (Case ② section)
```
- [effort] `contribution.ts` has no tenure normalization: batch 002 found 4 "replacement"
  MPs (Demjanová←Brabec, Penc←Kubis, Nerušil←Šichtařová, Kotlík←Kott) seated mid-term who
  genuinely cast ballots (so never_cast_ballot correctly does not filter them) but score
  low purely on shorter tenure vs a full-term MP. Needs a `mandate_start_date`-aware
  normalization or at minimum a tenure-annotation so the bottom/divergence triage lenses
  stop reading short tenure as low effort. (opened 2026-07-24, batch 002)
- [effort] `componentDivergence` (batch-002 triage lens) is near-degenerate in a young
  term — most MPs cluster 0.4-0.48 on the metric as currently defined, per the kernel's
  own discriminative-power guardrail this needs re-tuning (club-relative, paired with
  participation) before batch 003 relies on it. (opened 2026-07-24, batch 002)
- [effort] `leadership_count` undercounts club/party-office roles (not just committee
  chairs) — TWO independent instances now (Faltýnek batch 001, Žáček batch 002). Should
  `computeContribution`'s leadership dimension include club vice-chair / whip roles?
- [effort] CEVYKO a.s. IČO discrepancy in the Niemiec batch-002 dossier (08599254 vs cited
  URL's 72160340) — needs ARES reconciliation before persist. See handoff §1b.
```

### → `feature-opportunities.md`
```
- [effort · batch 002] SHIPPED (build, this batch): honest low-score-reason badge on
  /poslanec — lib/analysis/low-score-reason.ts (pure, 5 tests) + client component
  features/profile/components/LowScoreReasonBadge.tsx, wired into ProfilePage.tsx. Reads
  `effort_low_score_reason` (closed 10-value vocabulary) + `effort_public_role`; renders a
  positive-tone correction for declined_mandate/replacement, neutral tone for structural
  reasons (minister, dual_mandate, etc.), and nothing at all when absent — generalizes
  the originally-scoped "phantom mandate badge" (O-effort-2) to the full vocabulary since
  batch 002 populated 6 new reason types across 30 MPs (10 total MPs now carry a reason
  across both batches; will light up further as later batches enrich more of the 207).
- [effort · batch 002, still open] O-effort-3 quiet-workhorse surface on /zebricek (label
  + filter) remains unshipped — batch 002 added 6 more quiet-workhorse examples across
  both flavours (Kupec/Síla/Hanzlíková legislative; Krejčí/Samaš/Žáček oversight), so the
  evidence base for this build is now even stronger for batch 003 to pick up.
- [effort · batch 002] Money-crossover verification pass: the Opus reflection recommends
  routing money-linked units (linkedCompanies>0, contractCzk above threshold) through an
  Opus verification step even in an otherwise-Sonnet army — both quality gaps this batch
  (CEVYKO IČO, under-traced Bouška 3.56B CZK figure) were on money claims.
```

### → `patterns.md`
```
- [effort, 2026-07-24, batch 002] REPLACEMENT-MP TENURE ARTIFACT: distinct from batch
  001's never-sworn phantom-mandate class, mid-term replacements (Demjanová, Penc,
  Nerušil, Kotlík) genuinely serve and vote but score low purely on shorter tenure —
  contribution.ts has no tenure normalization. A second, ongoing (not closed) young-term
  floor artifact class alongside phantom mandates.
- [effort, 2026-07-24, batch 002] DUAL-MANDATE GENERALIZES BEYOND ODS/MONEY: batch 001's
  only instance (Karpíšek) was ODS with a money angle; batch 002 finds 4 more, all
  ANO2011, only one (Bouška) with a money angle (Klčová, F. Bureš, Vopěnka have none) —
  dual-mandate is a party-agnostic structural class, not an ODS-or-money-specific one.
- [effort, 2026-07-24, batch 002] OFFICER-BY-OFFICE MONEY RECURS: Niemiec/CEVYKO,
  Žbánek/Olomouc municipal companies — 2 more instances on top of batch 001's
  Zarzycký/Karpíšek (4 total across 2 batches). Increasingly well-evidenced case for the
  deferred `link_kind` prop on `linked_to` (money loop's boundary — not persisted here).
- [effort, 2026-07-24, batch 002] SCORE RISES AS SPEECH COLLAPSES (term-over-term): all 5
  continuing MPs with complete PSP9 comparisons in this batch's army show PSP10 scores
  rising despite 80-95% drops in floor-speech volume — the index weights committee
  participation/leadership far above rhetoric. Visible for the first time now that PSP9
  trend data is wired (batch-001 build).
```

### → `contradictions.md`
```
(none new this batch — the Opus reflection specifically cross-checked 4 threads that
directly reference batch-001 facts — Demjanová↔Brabec, Penc↔Kubis, Bendl/Haas bill-slate
overlap, Činčila/Brzesková pension-novela split — and found zero contradictions. Recorded
here as a positive finding per the kernel's "absence of signal is a finding" rule, not
because there is a contradiction to log.)
```

### → `graph-log.md`
```
- pass <assigned> (effort track, batch 002): effort_* enrichment props on 30 person nodes
  (payloads/batch-002-props.json, gate 30/30). Q-effort-1 never_cast_ballot pre-filter
  now runs every batch in triage.ts (0 new phantom mandates this batch; 4 total unchanged
  from pass 14). New effort_low_score_reason values this batch: dual_mandate ×4,
  replacement ×4 (a NEW structural class — see patterns.md), declined_mandate ×1,
  minister ×1. No new node kinds / edge rels.
```

---

## 3. Proposed enum / schema changes

1. **`effort_low_score_reason` vocabulary is UNCHANGED this batch** — all 10 values from
   batch 001's proposal (`{minister, deputy_pm, prime_minister, opposition_leader,
   replacement, new_mp, dual_mandate, genuine_absentee, low_legislative_output,
   declined_mandate, unknown}`) covered every case batch 002 needed, including the new
   `replacement`-MP class (the vocabulary already had `replacement`, just unused in batch
   001). No addition needed.
2. **Gate hardening**: `scripts/case-loops/effort/gate.ts` now validates
   `effort_low_score_reason` against the closed vocabulary (drops any value outside it) —
   a real structural improvement, not just a batch-002 artifact; recommend keeping this
   gate check permanently.
3. **Proposed i18n keys** (I could not edit `messages/*.json` — fleet shared).
   `LowScoreReasonBadge` currently uses inline Czech literals (10 badge/detail pairs per
   `lib/analysis/low-score-reason.ts`), matching the TrendPanel precedent. Fold into the
   `profile` namespace when convenient — the full Czech copy is already written and
   pure-function-testable in `low-score-reason.ts`; i18n-izing is a mechanical follow-up,
   not a new copywriting task.
4. **Boundary note**: `lib/analysis/low-score-reason.ts` is a new case-owned module under
   `lib/analysis/` that falls outside the literal `lib/analysis/contribution*` glob named
   in the case boundary, but is conceptually effort-owned (referenced only from
   `features/profile` and `features/civicscore`, analogous to `contribution-trend.ts`).
   Flagging for the orchestrator's awareness — no conflict occurred, no other loop touched
   this path.

---

## 4. Commit plan (per-case; suggested)

One atomic Conventional commit inside the effort boundary:

**Files (all inside boundary):**
- `docs/data-analysis/case-effort/` — ledger.md, ledger.json, batch-002.md, handoff.md,
  triage.json, dossier-inputs.json, payloads/batch-002-props.json,
  payloads/batch-002-group-{A..F}.json
- `lib/analysis/low-score-reason.ts` + `low-score-reason.test.ts`
- `features/civicscore/getLeaderboardData.ts` (effortLowScoreReason/effortPublicRole wired
  onto `LeaderboardEntry`)
- `features/profile/components/LowScoreReasonBadge.tsx`
- `features/profile/ProfilePage.tsx` (renders the badge)
- `scripts/case-loops/effort/` — triage.ts (batch-aware + never_cast_ballot pre-filter +
  componentDivergence lens), extract-dossiers.ts (+ contributionPsp9 field), gate.ts
  (payload-arg + closed-vocabulary check)

**Suggested message:**
```
feat(effort): batch 002 — never_cast_ballot pre-filter + 30-MP Sonnet army + low-score badge

Q-effort-1 ships: a deterministic never_cast_ballot pre-filter now runs before the
absentee-manager lens every batch (0 new phantom mandates found; the 4 from batch 001
were exhaustive). 30-MP army on Sonnet-majority (0 Opus, vs batch 001's 4) plus one Opus
reflection call — quality held (0 contradictions vs batch 001 across 4 cross-referencing
threads); the only gaps found were on money-touching claims, steering batch 003 toward a
targeted Opus verification pass for money-crossover units. Discovers a new "replacement
MP" tenure-artifact class distinct from never-sworn phantom mandates. Ships a generalized
low-score-reason badge on /poslanec (10-value vocabulary, was scoped to phantom mandates
only). Gate 30/30; npm run check green (166/166 tests, +6 new).
```
**Do NOT commit** the disposable `.pglite-copy-effort`. Note: during this batch's `npm run
check`, a transient repo-wide typecheck failure was observed and self-resolved on retry —
traced to a momentary stray file (`scripts/case-loops/law/_tmp-verify-diff.ts`) from the
concurrently-running LAW loop's fleet session, outside this case's boundary and not
investigated further. Confirms money+law loops are live-concurrent in this working tree;
the orchestrator may want each case's `npm run check` run in isolation before trusting a
repo-wide green.

---

## 5. Lessons learned (calibrates the skill / kernel) — includes the Opus reflection

**Full Opus reflection (the one Opus call this batch, `effort: xhigh`), verbatim:**

### 1. Quality verdict — did Sonnet-majority hold the bar?
Yes, with one specific and instructive exception. The strongest dossiers are genuinely
batch-001-grade: Vondráček (signal 0.90) establishes first-předkladatel status on four
tisky with per-tisk psp.cz citations; Niemiec reproduces batch-001's signature
IČO→civic-office move (278.8M CZK CEVYKO a.s. traced to a Havířov municipal-executive
seat); Krejčí's dossier caught its own tool failure and cross-verified via a psp.cz press
release. The failures cluster on money-touching claims: a real citation inconsistency
(Niemiec's CEVYKO IČO text vs its own cited URL), an under-traced 3.56B CZK Bouška figure
(a fifth the size of Niemiec's link got a full trace; Bouška's got one paragraph), and an
over-signaled single-citation dossier (Síla, 0.85 on one URL). The mean-signal dip
(0.771→0.744) is composition (deeper into the honest-artifact structural tail), not decay.

### 2. Cross-unit synthesis
NEW: the `replacement` tenure class (4 MPs); dual-mandate generalizes beyond
ODS/money into ANO with no money angle (4 MPs); score rises as speech collapses
term-over-term across all 5 continuing MPs with complete PSP9 data. CONFIRMS/STRENGTHENS
batch 001: officer-by-office money (2 more instances), leadership_count undercount (2nd
independent instance), `flagged_conflict` and PSP10-interpellations=0 both look like data
artifacts, not behavior.

### 3. Contradictions check
Zero contradictions with batch 001 across four directly-continuing threads — Demjanová's
account of Brabec matches batch-001 exactly (date, reason); Penc↔Kubis matches; the
Bendl/Haas ODS bill-slate overlap was correctly de-duplicated, not double-counted; the
Činčila/Brzesková pension-novela was correctly split into guarantor vs co-sponsor credit.
A name-collision hazard (František Bureš, ANO vs Jan Bureš, ODS) was kept distinct.

### 4. Q-effort-1 verdict
"0 new" is informative but bounded: it confirms batch 001's phantom-mandate census was
complete and the pre-filter now stops re-dossiering it. But that class is essentially
closed (new entries only if someone resigns pre-oath), while the replacement-MP class this
batch found is open and growing (Kotlík sworn just weeks before this batch ran). Keep
`never_cast_ballot` running every batch as cheap insurance, but the interesting filter now
is tenure normalization.

### 5. Steering for batch 003
Keep Sonnet-majority for the enrichment army; route money-crossover units
(linkedCompanies>0 AND contractCzk above a threshold) through an Opus verification pass —
that is precisely where Sonnet was thinnest. Down-weight pure top-score slots (routine
party-slate co-signers, low novelty); keep fixed allocation for quiet-workhorse +
structural-tail lenses (richest cross-cutting yield). Fix `componentDivergence`
(near-degenerate at the high end in a young term — make it club-relative, pair with
participation) and tenure-normalize the bottom lens.

### 6. Lessons for the skill/kernel — the model-tiering answer
**Recommendation: continue Sonnet-majority for the army, but restore Opus specifically for
the money-crossover subset (and any top-signal accusatory claim).** Concrete evidence, not
a hedge: Sonnet held on effort-only dossiers (enrichment depth, citation discipline,
honest headlines, perfect factual consistency with batch 001 across four continuing
threads). Both failure modes were on money-touching or high-stakes claims. So: **Opus is
earned by claim type (money-linked or accusatory), not by unit rank.** At ~19,100
tokens/MP the Sonnet army is cheap enough that spending Opus on the ~5-6 money-crossover
units per batch is affordable and directly buys down the one error class that surfaced.

**Driver-level lessons (mine, on top of the reflection):**
- The batch-aware `triage.ts` (reads prior `ledger.json`, auto-increments batch, excludes
  done units) worked cleanly for a second-batch resume — this pattern should be the
  template for money/law's own batch-002 triage scripts if they haven't already converged
  on it independently (they appear to be running batch 002 concurrently as I write this).
- Grouped Sonnet agents (5 MPs/group, 6 groups, ≤6 concurrent) held quality with the same
  pre-extraction discipline as batch 001 (`dossier-inputs.json`, now carrying
  `contributionPsp9` too) — zero agents needed to open the PGlite copy directly.
- Merging N group-payload files into one gate-able `batch-NNN-props.json` via a small node
  script (id-membership cross-check against `triage.json`'s army list before gating) is a
  clean, cheap step worth keeping as the standard batch-finalize pattern.
