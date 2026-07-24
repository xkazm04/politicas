# Case ② Effort — Batch 002 (Sonnet-majority experiment)

**Term** PSP10 (207 MPs) · **army** 30 · **coverage** 50/207 (24.2 %) · **mean signal** 0.744
**Engine** PGlite SQL on `.pglite-copy-effort` (R4, population < 100k) · **no live write, no commit** (fleet).
**Models** batch-002 model-tiering policy: driver + ENTIRE army on Sonnet (6 grouped agents × 5 MPs, 0 Opus) +
**1 Opus reflection call** (`effort: xhigh`) for cross-unit synthesis and the quality verdict — the batch's
one deliberate departure from batch 001 (4 Opus solo + 4 Sonnet groups). Every rendered claim carries
`{claim, url, accessedAt: 2026-07-24}`; primary registries (psp.cz, ARES/justice, Hlídač, vlada.gov) outrank
media. Public-role facts only.

## Q-effort-1 — the deterministic pre-filter, made real

Batch 001's headline lesson: 4 Opus dossiers were spent proving the Case-①×② absentee-manager crossover
false on MPs who never took their seat. Batch 002 ships the fix directly in `triage.ts`:
`never_cast_ballot = participation_rate===0 && committee_count===0`, computed over the **full 207-MP
population** before the absentee lens runs, not just the army subset.

**Result: 4 total across the population (unchanged), 0 new this batch.** The 4 are the same Zarzycký,
Brabec, Kubis, Kučerová batch 001 already fully enriched. Consequence: the absentee-manager lens in
batch 002's triage pool is now **empty** — every genuine `absentee_manager_lead` flag that exists (4 total:
Zarzycký, Brabec, Faltýnek, Karpíšek) was already covered in batch 001, so zero army slots were spent
re-proving a known false positive. The pre-filter did its job by finding nothing to do — see the Opus
reflection (§5) for why "0 new" is still informative but bounded.

## Triage (deterministic, re-ranked)

Resumed from `ledger.json`'s 20 batch-001 units (excluded from the pool). Added two lenses this batch:
**component divergence** (one-sided score composition — high on one of the 6 weighted components, low on
the rest, restricted to mid-band scores 35–75) and split **quiet-workhorse** into fixed
legislative-authorship / oversight-institutional slots (the two positive-symmetry flavours batch 001 found
should not collapse into one label).

Army of 30 = 6 top-composite + 4 bottom-composite (phantom-filtered) + 4 quiet-workhorse-legislative +
4 quiet-workhorse-oversight + 5 contested-vote-rebellion overlap + 6 component-divergence + 1 high-triage
filler. Full ranking in `triage.json`.

## Headline finding — a NEW structural class: the replacement MP

Batch 001 found the **never-sworn phantom mandate** (elected, relinquished before the oath). Batch 002's
enrichment surfaced a distinct, ADJACENT class the `never_cast_ballot` filter does *not* catch, because
these MPs genuinely cast ballots: **the mid-term replacement**.

| MP | pspId | reason | what happened |
|---|---|---|---|
| Jana Demjanová | — | replacement | Took the seat Richard Brabec relinquished 2025-10-08 (batch-001 phantom mandate) — sworn 2025-11-03, 100 % participation, 10 % absence since. A real, fully-attending MP; her zero bills/leadership/speeches after 9 months is a genuine divergence, not an artifact. |
| Jiří Penc | — | replacement | Took the seat Petr Kubis declined (hejtman Karlovarského kraje from 2025-12-08, another batch-001 phantom). 100 % attendance, 1 speech, 0 bills. |
| Josef Nerušil | — | replacement | Sworn in only 24.3.2026, replacing Markéta Šichtařová (see below) — roughly 4 months of tenure vs ~9.5 for term-long MPs. |
| Jiří Kotlík | — | replacement | Sworn in 23.6.2026, replacing Josef Kott (departed for the Supreme Audit Office/NKÚ) — ~5 weeks of tenure at the time of this batch. |

**Consequence for the product:** `contribution.ts` has no tenure normalization — a legitimately active MP
seated weeks ago scores identically on rate-based components to a full-term underperformer. This is the
single most actionable steering item for batch 003 (see ledger.md).

## Dual-mandate cluster generalizes beyond ODS/money

Batch 001 found one dual-mandate case (Karpíšek, ODS, with a real if mostly office-held money angle).
Batch 002 finds **four**, all **ANO2011**, only one (Bouška) with a money angle:

- **Jiří Bouška** — sitting mayor of Mladá Boleslav + regional councillor + MP (triple mandate); 100 %
  attendance, zero legislative output; largest linked-money figure in the batch (~3.56B CZK across four
  entities) — the Opus reflection flagged this as under-traced relative to its size and recommends an
  Opus verification pass for money-crossover units specifically.
- **Jiřina Klčová** and **František Bureš** — both new MPs simultaneously serving as deputy mayors
  (Pardubice / Kladno); 100 % participation, zero bills, near-zero speeches, no money angle.
- **Otto Vopěnka** — 1st deputy governor of Vysočina region alongside his seat; 100 % attendance, zero
  bills; a regional outlet's inquiry about his silence went unanswered (reported factually, not asserted
  as evasion).

Dual-mandate is now a party-agnostic structural class decoupled from money — the product should treat it
as such rather than an ODS-specific pattern.

## Confirmed patterns from batch 001

- **Officer-by-office money recurs**: Bohuslav Niemiec's 278.8M CZK CEVYKO a.s. link is a Havířov
  municipal waste-processing entity he sits on by virtue of being deputy mayor — same structural shape as
  batch 001's Zarzycký/Karpíšek. Miroslav Žbánek (former mayor of Olomouc) shows the same pattern with
  municipal companies. Both `pending_review`, neither asserted as personal enrichment.
- **`leadership_count` undercounts club-office roles again**: Pavel Žáček's ODS club vice-chairmanship
  (since Feb 2026) is invisible to the index, echoing batch-001's Faltýnek undercount — two instances
  across two batches now reads as systemic, not coincidence.
- **Executive-role score artifact**: Robert Plaga, sitting Minister of Education since 15.12.2025
  (his second stint, previously 2018–2021), tagged `effort_low_score_reason: minister` — the same shape as
  batch 001's Fiala (prime_minister).

## Positive symmetry — more quiet workhorses, both flavours

- **Legislative-authorship**: Martin Kupec (Constitutional Commission vice-chair), Jan Síla (from PSP9's
  loudest SPD interpellator — 52 interpellations, 175 speeches — to a nearly silent VZP supervisory-board
  member and Health Committee vice-chair), Jana Hanzlíková (ex-deputy minister, two co-signed bills already
  law), Miroslav Žbánek.
- **Oversight-institutional**: Miroslav Krejčí (chairs both the hybrid-threats commission and the NÚKIB
  cybersecurity oversight commission), Miroslav Samaš (PSP9→PSP10 score jump 28.8→63.4, now chairs the
  Defense Ministry's acquisitions subcommittee), Pavel Žáček (concentrated pure security/intelligence
  oversight — Dozimetr inquiry, GIBS/BIS/ÚZSI commissions).
- **Genuine institutional overlap found**: Jiří Mašek (chairs Health Committee, sits on VZP's board) and
  Jan Síla (elected VZP supervisory-board member) — two MPs from different groups converging on the same
  health-insurer oversight seat, a real cross-cutting structural finding, not asserted as coordination.

## Honest score-floor resolutions (non-phantom, non-replacement)

- **Markéta Šichtařová (SPD, 30.3)** — resigned her mandate 11.3.2026 (~5 months served) in protest of the
  EU Digital Services Act advancing to second reading — a principled truncated mandate, `declined_mandate`,
  extending batch 001's Beran precedent to mid-term voluntary resignation (not pre-oath).
- **Radek Vondráček** — verified via psp.cz he is no longer Speaker of the Chamber (that was PSP8,
  2017–2021); now chairs Foreign Affairs + ANO club vice-chair, and is this batch's strongest legislative
  author (first submitter on 4 tisky, two already law).

## Gate

`scripts/case-loops/effort/gate.ts payloads/batch-002-props.json` on the copy: **30 / 30 PASS, 0 DROP** —
every proposal targets a real `psp:person:*` node, is `effort_*`-namespaced, touches no deterministic-owned
number, and every `effort_low_score_reason` value is in the closed vocabulary (added this batch as a gate
check). `effort_low_score_reason` distribution this batch: `dual_mandate` ×4, `replacement` ×4,
`declined_mandate` ×1, `minister` ×1.

## Data-quality issue found (flagged, not resolved)

Niemiec's dossier text states IČO 08599254 for CEVYKO a.s.; its own cited firemniprofil URL shows
72160340. One is wrong. Left as a reviewer TODO in the payload rather than silently picking one — the
single concrete lapse the Opus reflection identified, and it is on a money-touching claim (see §Opus
reflection below and handoff.md).

## Opus reflection (the one Opus call this batch, effort: xhigh)

Full text preserved in `handoff.md` §5. Summary: **Sonnet-majority held batch 001's quality bar** on
effort-only dossiers — zero contradictions found across four MPs whose stories cross-reference batch 001
directly (Demjanová↔Brabec, Penc↔Kubis, the Bendl/Haas ODS bill-slate overlap, the Činčila/Brzesková
pension-novela split). The mean-signal dip (0.771→0.744) is judged **composition, not decay** — batch 002
deliberately worked deeper into the structural tail where "this low score is an artifact" is the correct,
low-drama finding. The two real gaps found (CEVYKO IČO mismatch, an under-traced 3.56B CZK Bouška figure)
were **both on money-touching claims** — the reflection's concrete recommendation for batch 003: keep the
Sonnet-majority army, but route money-crossover/accusatory units through an Opus verification pass, since
that is precisely where the two failure modes appeared.

## Metrics

| metric | value |
|---|---|
| units done / total | 30 / 207 (batch), 50 / 207 (cumulative) |
| mean signal (yield proxy) | 0.744 |
| cost/unit | 6 Sonnet grouped agents (5 MPs each) + 1 Opus reflection; ~19,100 tokens/MP army average, 572,979 total army tokens, 151 tool calls, ~35 agent-minutes (~7 min wall-clock, 6-way parallel) |
| gate pass rate | 30/30 (100 %) |
| citations | 98 across 30 dossiers |
| cross-cutting leads | 25 |
| new phantom mandates (Q-effort-1) | 0 (4 total, unchanged from batch 001) |
| new structural class discovered | `replacement` (4 MPs) |
| dual-mandate cluster | 4 MPs, all ANO2011 (batch 1 had 1, ODS) |

## No silent truncation

- Army selection is exhaustive over the 187-MP remaining pool per the coded lens thresholds — no MP
  matching a lens was skipped for space; the 30 target was met by lens picks plus 1 high-triage filler.
- The CEVYKO IČO discrepancy is logged, not resolved either way (§ above) — flagged for the reviewer.
- PSP9 term-over-term data used where available: 13/30 army MPs are continuing PSP9 MPs with complete
  prior-term profiles; the other 17 are new-to-PSP10 or the profile lacked full PSP9 coverage — both cases
  degrade honestly to the single-term view, never a fabricated comparison.
