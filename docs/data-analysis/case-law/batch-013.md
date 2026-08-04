# Case ③ Law loop — batch 013 (2026-08-04)

Solo run, third batch of the day. Army: 3 Sonnet verdict groups, 2 Sonnet collision readers,
1 Sonnet jargon-sweep agent, 1 fresh Opus adversarial auditor (max effort, three rounds).

**The pass in one line:** the two data debts closed (the amends undercount and tisk 87's missing
text), 10 more verdicts landed on the churn-6/7 head (three mediums, all state-power findings),
the §35c null kept the §35ba collision complex honest — and the audit cycle both caught a
false registry claim about a sitting minister on the LIVE product and turned the jargon rule
into code that retroactively cleaned 13 earlier verdicts.

## P1 — census completion (pass 46)

Root cause diagnosed, not assumed: the batch-008 census was CORRECT (10 statutes for tisk 250,
7 for tisk 69) — the regen could not emit five edges because the graph had no law node for the
targets, and it SAID so in its own `missingLawNodeCensus` (132/2010; 330/2025, 387/2024,
505/1990, 539/1992). The batch-005 node ingest predates that census; the five fell between the
passes. Fix: `ingest-missing-laws.ts` (parameterized `--in/--out`) resolved 5/5 against the
e-Sbírka registry; `apply-census-completion-013.ts` — the insert-capable, node-then-edge apply
path the backlog (D3/D4) called for, in miniature — applied 5 nodes + 5 edges live (pass 46).
Live graph: 288 → 293 laws, 577 → 582 amends; re-triage moved exactly the 2 affected rows.

## P2 — tisk 87 ingested (141/141)

The cached index always listed the print's PDFs; the original fetcher's header heuristic
skipped them. Fetched idd 267037 (1,7 MB), pdftotext'd, re-ran the summary builder:
**141/141 bills carry a summary** (tisk 87: „Nový zákon o zemských znacích a vlajkách.",
method new_act). The loader reads the payload file, so the gap closed with no further wiring.

## P3 — 10 verdicts on the churn-6/7 head (3 medium / 7 low)

Targets: 205, 90, 68, 206, 73, 174, 53, 109, 62, 140 — including the 68⊂90 containment family,
written as a pair (the delta is where 90's findings live). Mediums:
- **tisk 90** (public-finance omnibus, medium/3): bod 13 **abolishes the statutory quarterly
  budget-execution report outright**, substituting ministry press releases; several further
  materials move from the plenary's agenda to the budget committee alone (recipients — the DZ
  is explicit nothing was ever "approved"); and a new Hlava VIII (§31–32) lets the government
  exceed total budgeted spending by up to 10 % below a declared emergency.
- **tisk 206** (procurement-review reform, medium/4): the court fee for challenging an ÚOHS
  decision rises 3 000 → 50 000 Kč; and for challenges to tender conditions — the one moment a
  supplier can stop a bad procurement before award — the kauce moves from flat 100 000 Kč to
  1 % of estimated value, up to 10 000 000 Kč (the finding the audit cycle first overstated,
  then erased, then restored with line-derived wording).
- **tisk 73** (zálohový systém, medium/3): the retailer "handling fee" has no statutory floor,
  unlike producer-facing charges; the DZ itself concedes waste companies lose PET/aluminium
  resale revenue. Hladík's Brno ties disposed as steward roles with the adjacency named.
Also: tisk 53's enactment-order dependency text-proven (its own new provisions cite a §2174a
its civil-code article never creates, closing on an unassigned „…/2025 Sb."); tisk 140/141
CORRECTED from "near-duplicates" to two INCOMPATIBLE §3 rewrites from the same regional
submitter (141 alone raises the shared-tax share 10,23 → 10,97 %); honest negatives elsewhere.

## P4 — collision wave: an honest null and 3 confirmations

16 pairs (backlog 44 → 28): **3 confirmed / 11 coordination-risk / 2 incidental**, P49 32/32
after one deterministic excerpt repair. The §35c candidates do NOT extend the §35ba complex
(three different odstavce — a null recorded as a finding). Confirmed: 56×67 byte-identical
duplicate instruction into §156 odst. 3 (283/2021); 64×89 mutually exclusive definitions at
the same insertion anchor (218/2000 §3); 64×65 a REVERSED-direction renumbering collision
(tisk 65's deletion cascade erases the písmeno tisk 64 targets). The 68⊂90 family held on two
more statutes with a refinement: byte-identical inserted text, different wrapper sentences.

## The audit cycle — three rounds, and two structural yields

Round 1 (NOT READY, 4 blocking + 9 major): verdict-90's plenary-approval claim inverted the
DZ; its quarterly-report claim was backwards (the truth — outright abolition — was stronger);
verdict-206 misplaced the kauce change; **and the persisted batch-012 verdicts attributed
Tomáš Kocour's registry record to Lukáš Vlček** — a false present-tense claim about a sitting
minister, live on the product. Round 2 (closure, REOPENED): the 206 rebuild had overcorrected
into the mirror-image false claim; the new jargon gate covered only one of the three tokens
its motivating finding named; a new NKÚ §5 odst. 2/3 mixup found in 90. Round 3: final scoped
closure on the auditor-prescribed wording.

**The SOMPO resolution is the batch's method lesson.** Five reads of one ARES VR document
disagreed (two WebFetch small-model reads, two auditor parses, one naive grep) — the naive
grep missed the UPPERCASE, decomposed-diacritics entries, the corpus's own NFC lesson striking
in a new place. The truth came only from downloading the raw JSON and structurally parsing it
NFC-normalized: **Vlček předseda 27. 2. 2020 – 31. 10. 2024 (vymaz 4. 2. 2025); Kocour předseda
since 3. 12. 2024.** Verdicts 69/56 rewritten accordingly (past tense, dated, method stated).

**M6 became code.** `lib/analysis/law-verdict.ts` now rejects pipeline jargon (prop
identifiers, origin enums, cache paths, graph urns in prose, batch/pass refs) in reader-facing
fields, with tests. The rule retroactively failed 13 live batch-011/012 verdicts; a scoped
sweep (agent + deterministic follow-up after the regex was widened per the closure audit,
29 replacements, JSON-validity asserted) purged them meaning-preservingly. All three batch
gates green: 12/12 · 10/10 · 10/10.

## Persist & manifestation

Pass 47: **28 verdicts** in one write — 10 new (batch-013) + 12 corrected (batch-011) + 6
corrected (batch-012, incl. the B4 registry correction). Verdict coverage **49 → 59/141**
(82 pending). Ledger synced. Loaders run, not assumed: **59 forensic blocks · 0 withheld ·
141/141 summaries · 108 collision pairs (59 confirmed) · czechPending 0**.

## Process note (from the final closure, carried as batch-014 doctrine)

Pass 47 persisted BEFORE the final closure check ran. The check came back clean, so nothing was
published in error — but the ordering meant it could not have blocked a bad write, and both
prior rounds in this very batch found remediation introducing fresh defects (C1 was itself
introduced while fixing B3). **Batch-014 rule: the closure check gates the write** — no persist
until the auditor's closure verdict on the final file state is CLOSED.

## Not done — disclosed

- 28 collision pairs remain unread.
- §-level sector attribution still needs the amended-§ census.
- The tisk-53↔16 and 250-companion enactment-order dependencies suggest a DEPENDENCY census
  (bills whose annexes bake in other pending bills) — a new deterministic pass candidate.
- Repo-wide typecheck unchanged (another session's file).

## Metrics

| | |
|---|---|
| units | 5 nodes + 5 edges (P1) + 1 ingest (P2) + 10 verdicts + 16 pairs + 13-file retro sweep |
| verdicts total | 49 → **59** (3 medium / 7 low new; mediums now 8 of 59) |
| summaries | 140 → **141/141** |
| confirmed collisions rendered | 56 → **59** (108 pairs total) |
| audit rounds | 3 (NOT READY → REOPENED → final closure); 1 false registry claim caught on LIVE content |
| graph writes | pass 46 (5+5 census completion) + pass 47 (28 verdicts) |
| new code gates | pipeline-jargon rejection in the verdict contract (tests 11/11) |

## Files

New: `scripts/case-loops/law/{prepare-batch-013,apply-census-completion-013}.ts`,
`payloads/{batch-013-targets,batch-013-collision-queue,batch-013-missing-law-nodes,batch-013-pass47-combined}.json`,
`payloads/verdicts-013/` (10), `payloads/collision-close-reads-batch013-g{A,B}.json`,
`batch-013-audit.md`, this note.
Modified: `lib/analysis/law-verdict.ts` + test (jargon gate), `ingest-missing-laws.ts` +
`prepare-collision-queue-012.ts` + `gate-verdicts-011.ts` + `update-ledger-011.ts`
(parameterized), 18 × verdicts-011/012 files (corrections + sweep),
`features/lawwatch/getCollisionData.ts`, `payloads/bill-summaries-cz.json` (141/141),
`.data/law-collision-cache/tisk-87/` (PDF + text), `ledger.json`, `graph-log.md` (passes 46–47).
