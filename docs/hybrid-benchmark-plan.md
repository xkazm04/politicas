# Politicas — hybrid data + LLM benchmark plan

**Goal.** Find the strongest *hybrid* paths — deterministic hard-data processing
**combined with** an intelligent LLM engine — over Politicas' large PSP datasets,
scored on **quality and efficiency**, so the winning paths become app features
generated (and re-generated) automatically by Pumper dev loops.

This plan builds on the Tier-2 eval-harness findings (see the Wellspring repo
`docs/data-analysis/tier2-eval-harness.md`): the LLM should do as little
arithmetic as possible; hand it deterministic numbers to interpret; and any tool
engine it queries **must share the canonical compute semantics** or its numbers
won't reconcile. Politicas already embodies the pattern — `lib/analysis/*` owns
every number, the LLM only names/interprets, gated against real entity IDs.

## 1. The core idea: a clean analytical layer, then business ops on top

With 406k ballots + 2k roll-calls + 7k persons, raw data is too noisy to reason
over directly. We adopt a **medallion analytical layer** (Bronze→Silver→Gold, plus
AI-era **Feature** and **Vector** layers) and split every task across a
**Semantic Plane (LLM: plan, name, interpret)** and an **Execution Plane
(deterministic: SQL/graph/stats over the full data)**.

| Layer | For Politicas | The noise it removes / value it adds |
| --- | --- | --- |
| **Bronze** (raw) | the mirrored `psp-*` datasets as-is | carries the known defects: U+FFFD charset mangling (`source_release`), the post-1995 merged abstain/not-voting **code-K** bucket (44,633 ballots), **16 voided** votes, placeholder **year-2925** membership date, empty PSP10 `title_short`/MP contacts |
| **Silver** (clean) | canonical entities + positional basis | resolve `person↔mandate↔membership↔club` (club ≠ party_list); exclude voided votes; positional basis = {yes,no} only; fold `*_norm`; drop/flag placeholder dates; charset-repair titles |
| **Gold** (business marts) | MP scorecards, club-discipline, bloc×theme, attendance | the numbers the product cites — every one deterministic + source-noted |
| **Feature** | per-MP/­per-vote feature vectors | inputs to CivicScore pillars, ML, and LLM narration |
| **Vector** | embeddings of vote titles / themes / MP profiles | powers semantic filter/join/search over votes (LanceDB / pgvector) |

**The benchmark question for every direction below:** does adding the LLM to the
deterministic layer *improve quality* (coverage, fidelity, insight) at
*acceptable efficiency* (tokens, latency), and where is the honest hard/LLM line?

## 2. What we can benchmark on ARM right now

Fixed engine: **Claude Code CLI** (subscription-unmetered). Sweep axes:
**model** (`--model=haiku|sonnet|opus`) × **reasoning effort** (`--effort=low..max`).
ARM-importable compute substrates (verified): **DuckDB** ⭐ (columnar OLAP for the
406k-ballot joins), **PGlite + pgvector** (the app's own store + vectors),
**LanceDB** (embeddings / semantic ops), **better-sqlite3** (arm-D substrate),
**Qdrant client** (needs a server). Deferred to an x64 box: libSQL, Polars, Kuzu.

**Benchmark combination = {substrate} × {model × effort} × {hybrid pattern}**,
where the hybrid patterns are the four arms already built plus two new ones:

- `deterministic-only` — the baseline (`lib/analysis/*`), 0 tokens.
- `llm-narrate` — LLM interprets deterministic numbers (the Tier-2 winner).
- `llm-plan+execute` — LLM writes SQL, engine computes (arm D).
- **`semantic-operator`** — LOTUS-style `sem_filter`/`sem_join`/`sem_agg` with a
  **model cascade** (haiku proxy + opus gold) over Feature/Vector layers.
- **`extract→verify`** — LLM proposes structured facts, deterministic gate
  validates against real IDs (the existing verdict pattern, generalized).

**Metrics (two axes, every run):**
- **Quality:** fidelity to the deterministic oracle (`Σ|LLM − oracle|`),
  **fabrication** (claims/IDs not in the data — the high-stakes one for a civic
  product), coverage (% of rows handled), and insight (finds a real pattern the
  deterministic layer didn't surface).
- **Efficiency:** output tokens, latency, cache reuse, and the **cheapest
  (model, effort) that still passes** — the practical output of every sweep.

Reuse the existing harnesses (`da:slice-stats`, `da:kg-compute`, the
`validate-*-verdict` gates) as oracles; the `.pglite-copy` convention for
read-only runs while the dev server holds `.pglite`.

## 3. The 10 benchmark directions

Categories: **E** metadata enrichment · **R** finding relations · **F** in-app
feature generation. Each names the **hard** (deterministic) vs **LLM** split, the
layer it serves, quality + efficiency metrics, the ARM substrate, and the app
feature it seeds (replacing the mock `lib/civic/*` layer).

| # | Direction | Cat | Hard (Execution Plane) | LLM (Semantic Plane) | Layer | App feature |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Vote-theme taxonomy** | E | embed + cluster 179 subjects (LanceDB/pgvector); TF-IDF | name canonical themes; map 53 untitled votes | Silver/Vector | VoteTrack theme filter |
| 2 | **MP entity resolution** | E | join person↔mandate↔membership; dedup replacement rows | reconcile name/title variants; disambiguate 7,045 historical persons | Silver | clean Spis profiles |
| 3 | **Roll-call summaries** | E | SQL tally + outcome per 2,030 votes | one-line plain-Czech "what & why it matters" | Gold | readable vote ledger |
| 4 | **Bloc / coalition discovery** | R | `co_votes_with` agreement matrix (20,496 edges) + clustering | name blocs, explain the 2-bloc split, flag bridge MPs | Gold | coalition map |
| 5 | **Rebel / defection narrative** | R | `rebels_against` (203 edges), join F11 bloc×theme | characterize *why* MPs defect, cite the real votes | Gold | rebel markers on Spis |
| 6 | **Attendance mining** | E/F | join 6,425 absences × 2,030 vote timestamps → attendance % | detect systematic patterns (absent on which themes?) | Gold | Docházka pillar |
| 7 | **CivicScore generation** | F | composite pillars from deterministic metrics | per-MP narrative justification; flag outliers | Gold/Feature | /zebricek leaderboard |
| 8 | **Money / contract linking** | R | IČO join to ARES + Registr smluv (needs ingestion) | fuzzy MP↔company↔contract match, human-gated | Silver→Gold | FollowTheMoney graph |
| 9 | **Semantic-operator pipeline** | R | DuckDB execution plane over 406k ballots | `sem_filter/agg/topk` with haiku→opus cascade | Vector | (framework) — powers 1,3,4 |
| 10 | **Law ↔ roll-call linkage** | R | link vote_event to law/paragraph; text diff | explain what changed + who voted how | Silver→Gold | LawWatch diffs |

### Per-direction notes (the interesting ones)

- **#1 / #9 together** validate the whole thesis: #9 is the *framework* benchmark —
  does a LOTUS-style **model cascade** (cheap haiku proxy filters, opus adjudicates
  the uncertain tail) hit the promised token savings on real vote data vs a
  single-model pass and vs pure keyword matching? #1 is its first application.
- **#2 (entity resolution)** *builds the clean layer* — the highest-leverage
  denoising step; every other direction inherits its canonical IDs. Quality gate:
  precision/recall of identity links vs the deterministic natural keys, and a hard
  **zero-fabrication** bar (a wrong MP link in a civic product is a defamation risk).
- **#3 / #6** are the sharpest **shared-semantics** tests: the LLM must reconcile
  with the deterministic tally (#3) and the timestamp-join attendance % (#6). This
  is exactly the arm-D reconciliation finding — if the LLM's SQL parses dates
  differently than `lib/analysis`, the numbers diverge. Benchmark both the
  llm-plan+execute arm *and* the llm-narrate arm here.
- **#5 / #8** stress **fabrication** hardest (relational "why" claims, fuzzy
  cross-source joins). These are where the extract→verify pattern earns its keep;
  #8 also needs the **mass-data playground** (ARES / Registr smluv ingestion) the
  next phase is gathering.
- **#7** must preserve the app invariant `score == composite(pillars)` — the LLM
  narrates the score, never computes it. Direct path to killing the mock leaderboard.

### How each is scored

Every direction runs the matrix: `{substrate} × {haiku,sonnet,opus} × {low,high effort} × {applicable hybrid patterns}`, reported as a scorecard with the two axes (quality, efficiency) and the **recommended cheapest passing config**. The deterministic arm is always the oracle/baseline; a direction "wins" only if the hybrid beats deterministic-only on coverage/insight without fabricating and at justifiable cost.

## 4. Closing the loop — automate the winners via Pumper

A direction that proves out (quality passes, efficiency acceptable) graduates to a
**Pumper app + trigger DAG**:

1. Pumper materializes the **Silver/Gold** dataset (e.g. `politicas/mp_canonical`,
   `politicas/vote_themes`, `politicas/bloc_theme`) as a change-detected dataset,
   the deterministic layer running on-schedule.
2. A `dataset` trigger fans the **LLM enrichment** (the winning model/effort/pattern)
   only over changed rows — incremental, cache-warm, cheap.
3. The app consumes the materialized Gold layer through the typed `Store` (replacing
   `lib/civic/*` mock), each number source-noted per the brand rule.

That is the "automated development loop": pick a direction → benchmark the hybrid
path on ARM → materialize as a Pumper dataset+trigger → the app feature regenerates
itself as new votes land. The benchmark tells us *which* paths are worth automating
and *at what model/effort* — so we spend Opus only where Haiku won't do.

## 5. Suggested sequence (ARM, now)

1. **#3 roll-call summaries** — smallest, purest llm-narrate test; sweep model×effort
   to find the floor (is haiku enough to summarize a vote from its tally+title?).
2. **#1 + #9** — stand up the Vector layer (LanceDB/pgvector embeddings of vote
   titles) and the semantic-operator cascade; benchmark the efficiency claim.
3. **#2 entity resolution** — build the Silver canonical-MP layer everything reuses.
4. **#4/#5** — relations on top of the KG that already exists (blocs/rebels).
5. Defer **#8/#10** to the mass-data playground (ARES, Registr smluv, law texts).

## First mapped point — #9 `sem_filter` cascade (2026-07-23)

Harness: [`scripts/hybrid-bench/`](../scripts/hybrid-bench/) (`npm run hybrid:semop`).
Task: `sem_filter` 377 PSP10 vote titles for **personnel/appointments**
(elect/appoint/establish people to bodies). Gold reference = opus/high on all
(137/377 positive). Scored vs gold:

| Arm | acc | precision | recall | F1 | out-tok | LLM calls | opus calls |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| deterministic (keywords) | 0.865 | 0.978 | 0.642 | 0.775 | 0 | 0 | 0 |
| proxy — haiku-all | 0.934 | 1.00 | 0.818 | 0.900 | 22,385 | 6 | 0 |
| cascade (τ=0.75) | 0.939 | 1.00 | 0.832 | 0.908 | 22,713 | 7 | 1 |
| gold — opus/high | 1.00 | 1.00 | 1.00 | 1.00 | 14,030 | 6 | 6 |

**What it maps:**
1. **The LLM's value is RECALL, not precision.** Keywords are precise (0.978) but
   miss **36%** of personnel votes — paraphrases with no keyword verb, e.g.
   *"zřízení stálých komisí"*, *"změny ve složení orgánů PS"*,
   *"stanovení počtu poslanců ve stálých delegacích"*. The LLM catches these.
2. **The cheap model is the workhorse.** haiku-all recovers most of the gap
   (F1 0.775→0.90, recall→0.818, precision 1.00, **zero opus calls**).
3. **The cascade barely fires** — only **2/377** escalated, because haiku was
   confidently right almost everywhere. +0.008 F1 for 1 opus call. **A cascade
   only pays off when the cheap model has a real *uncertain tail*; this task
   didn't.** Measure the escalation rate before assuming cascade savings.
4. **Output-token count is a misleading efficiency metric** — opus/high was
   *terser* (14k) than verbose haiku (22k). The real levers are **opus-calls**
   and **$-weighted** cost (opus ≈15–30× haiku per token → haiku/cascade far
   cheaper on $ despite more tokens) and wall-clock.
5. **Caveat:** gold = a model reference, not human truth; haiku's "misses"
   (recall < 1) are unverified against a labeled set.

**Design-space verdict for sem_filter:** the strong path is **haiku-all**, not the
cascade — it recovers the paraphrase recall keywords miss, at the cheapest tier,
with near-zero false positives. This is a **Silver-layer** enrichment (vote
type/theme tagging) that Pumper can materialize cheaply. Reserve opus/cascade for
predicates where haiku's confidence genuinely splits.

### `sem_agg` — session summaries (2026-07-23)

Task: summarize 8 PSP sessions (5–154 votes each). Aggregate arms **count** from
the raw votes; the narrate arm is handed the deterministic tally. Truth = the
deterministic tally (genuine hard ground truth here, not a model reference).

| Arm | mode | count-exact | dominant-outcome | out-tok | calls |
| --- | --- | ---: | ---: | ---: | ---: |
| haiku-aggregate | aggregate | **100%** | 100% | 11,206 | 8 |
| opus-aggregate | aggregate | **100%** | 100% | **3,364** | 8 |
| haiku-narrate | narrate | — (given) | 100% | 5,242 | 8 |

**What it maps:**
1. **Count fidelity is a non-problem here** — every arm, every session (including
   154 votes), exact. This **scopes the Tier-2 "don't let the LLM do arithmetic"
   rule**: it applies to *derived/multi-step* metrics (percentages, rubric
   formulas), NOT to *tallies the model can read off explicitly-labeled rows*.
2. **The differences live in the NARRATIVE, and tier decides it.** opus-aggregate
   wrote the most accurate, substantive prose (named the confidence vote + the
   rejected opposition amendments) **and was the cheapest** on output tokens
   (terse). **haiku-narrate — handed correct facts — hallucinated a defunct
   institution** ("Plenární schůze **ČNR**", the Czech National Council abolished
   1993; this is the Poslanecká sněmovna) plus an invented month. Correct numbers,
   wrong prose.
3. **Opposite tier verdict from `sem_filter`:** classification → the cheap model
   wins; narrative synthesis → the **strong model (opus)** wins on factual
   accuracy *and* token cost. **Tier choice is operator-dependent** — a key map
   result.
4. **For the app** (brand rule: every number cites its source), the deterministic
   tally stays the cited number regardless; narrate mode's value is
   provenance/auditability, not correctness rescue — and the benchmark shows the
   narration won't contradict the counts (dominant-outcome 100%).

Measurement caveat: input-token counts are unreliable (prompt caching → the CLI
reports only uncached input); output-tokens + calls are the signal.

**Design-space verdict for sem_agg:** narrate over the **deterministic tally** (for
cited numbers), and use **opus** for the prose — it is both more factually accurate
and terser; **haiku is unsafe for civic narrative** (institutional hallucination
despite correct facts).

### Derived-aggregate probe — where aggregation actually breaks (2026-07-23)

Simple counts were 100% at both tiers because reading off labeled rows is trivial.
This probes **derived** aggregates over the per-vote `yes/no` counts — a sum, a
column max, an argmin over computed margins — to find the real boundary. Truth is
the deterministic computation.

| Arm | n_votes | acceptance% | max_no | **total_yes (sum)** | closest_margin (argmin) | closest-title | out-tok |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| haiku | 100% | 100% | 100% | **75%  (±81)** | 100% | 100% | 29,012 |
| opus/high | 100% | 100% | 100% | **100%** | 100% | 100% | 24,110 |

**What it maps:**
1. **The breaking operation is ACCUMULATION, not "arithmetic" broadly.** Selection
   (max, **argmin**), count, and single-step ratio are **100% at both tiers**. Only
   the **sum over rows** fails — and only for haiku, only on the largest-magnitude
   sums (154-vote session off 478 ≈3%; a big-value 74-vote session off 170; every
   ≤87-vote / smaller-magnitude sum was exact). So error tracks the **magnitude of
   the accumulation**, not merely row count.
2. **Tier rescues it.** opus/high summed **every** session exactly, including 154
   large numbers — reasoning effort fixes accumulation — and was again **terser**
   (24k vs 29k tokens). Strong model = more accurate *and* cheaper here.
3. **Refined rule (supersedes the blanket Tier-2 warning):** the LLM is reliable
   for **selection / count / ratio** over row sets at any tier; **large sums need
   opus/high**; and for a **cited** number, still push to the deterministic engine
   (guaranteed-exact + source-noted, per the brand rule). *SQL sums; the LLM
   selects and narrates.*

**Combined #9 verdict across three probes — match the model tier to the OPERATION:**

| Operator | Nature | Use |
| --- | --- | --- |
| `sem_filter` | classification | **haiku** — cheapest, recovers recall, ~no false positives |
| `sem_agg` (prose) | narrative synthesis | **opus** — factual + terse; haiku hallucinates institutions |
| derived aggregate | computation | **deterministic** for cited sums; LLM fine for select/count/ratio; **opus** for large sums |

The through-line: **cheap model for classification, strong model for narrative +
accumulation, deterministic engine for any guaranteed cited number.**

### `sem_join` — entity linking (2026-07-23)

Task (proxy for the cross-source directions #8/#10): match 30 **noisy person-name
queries** to a 60-person registry. 20 positives = registry members perturbed with
initial+surname (`Petr Bachna`→`P. Bachna`), a surname typo, reorder+title, or
diacritics-strip; 10 **decoys** = people NOT in the registry (correct answer =
null). Truth = the person id / null; deterministic baseline = a fold+sort
normalizer.

| Arm | pos-acc | neg-abstain | fabrication | out-tok |
| --- | ---: | ---: | ---: | ---: |
| deterministic | 50% | 100% | 0 | 0 |
| haiku | **100%** | **100%** | **0** | 4,105 |
| opus | **100%** | **100%** | **0** | 1,815 |

**What it maps:**
1. **Both tiers ace it** — 100% correct links (including initials + typos the
   normalizer can't touch) *and* 100% correct abstention on decoys, **zero
   fabrication**. The cheap model suffices; opus is just terser (1,815 vs 4,105).
2. **The deterministic normalizer gets 50%** (the reorder/diacritics/title noise)
   but misses initials + typos — where the LLM adds real recall — and never
   fabricates (an exact match can't link a decoy).
3. **Important limitation — fabrication was NOT stressed.** The decoys were random
   *distinct* people, so "no match" was easy. The real civic risk in #8/#10 is
   **adversarial near-collisions** — a decoy sharing a surname with a registry
   member. Next probe: **hard negatives** (same-surname, different person) to test
   whether the LLM over-links under pressure. That is the actual fabrication test;
   this run only shows the operator works when candidates are clearly distinct.

**Adversarial follow-up — same-surname decoys (2026-07-23):** re-ran with
near-collision negatives (decoys sharing a surname with a registry member).
**deterministic held** (neg-abstain 100%, **0 fabrication** — an exact match can't be
fooled by a different first name); but **haiku, sonnet/medium, and opus/low ALL
dropped to 80% abstention and fabricated 2/10 links (~7%)** — linking a same-surname
*different person* to a registry member. **Tier did not help** (all three identical).
Under realistic near-collisions the LLM over-links at ~7% **regardless of model** —
the high-stakes civic error the easy run hid. **Requirement for #8 (money) and #10
(law): use the LLM for recall, but never auto-commit an LLM entity-link — gate every
link through a deterministic verifier + human confirmation.** (The app's existing
FollowTheMoney "human gate" is thus validated as necessary, not optional.)

### Reasoning × model roster — does reasoning or model drive it? (2026-07-23)

Re-ran the two tier-sensitive probes across **haiku · sonnet/medium · opus/low ·
opus/high** (opus/high kept only on the compute probe, as a reasoning-gradient
reference).

**Derived aggregate (the sum):** all four combos scored **100% exact on every
field this run — including haiku.** But the *prior* single haiku run got the sum
**75%** (failed the two largest sessions) on the *same data + prompt*. So:
- **Arithmetic reliability is stochastic, and haiku is the flaky one** (75%→100%
  run-to-run). opus was 100% both runs; sonnet/medium and opus/low were 100% here.
  → **n=1 cells hide variance; repeats are required** — the flip proves it.
- **Reasoning level made no difference at the Opus tier:** opus/low == opus/high ==
  100%. The earlier "opus/high fixes the sum" was really "Opus is more *reliable*
  than haiku," not "high reasoning fixes arithmetic."
- **Efficiency sweet spot = sonnet/medium:** full accuracy at the lowest output-token
  cost (14.4k vs opus/low 26.7k, opus/high 37.2k, haiku 40.2k).

**sem_agg narrative:** all combos accurate (dominant-outcome 100%, sampled summaries
factually correct). haiku verbose (5.8k tokens) vs sonnet/medium 1.9k · opus/low
1.7k · opus/high 1.8k. The prior haiku "ČNR" hallucination **did not reproduce**,
and the automatic hallucination metric proved **unreliable** (a uniform 25% = my
year-check false-flagging *legitimate* forward-references — a 2026 budget in a 2025
session; the reliable institution check found nothing). Hallucination is therefore
**inconclusive** here and needs a better detector / human eval.

**Answer to the hypothesis:** reasoning level mattered *less* than expected —
**model choice + run-to-run variance dominate**, and **sonnet/medium is the
efficiency sweet spot** for both narrative and arithmetic (opus/high rarely worth
its tokens; haiku cheapest for classification but flaky on arithmetic, verbose on
prose).

**#9 verdict — activity → (model, reasoning). Match the combo to the OPERATION:**

| Operator | Nature | Best combo |
| --- | --- | --- |
| `sem_filter` | classification | **haiku** — cheapest, recovers recall, ~no false positives |
| `sem_agg` (prose) | narrative synthesis | **sonnet/medium** — accurate + terse + cheapest; opus overkill, haiku verbose |
| derived aggregate | computation | **deterministic** for any cited number; if LLM, **sonnet/medium+** (haiku is flaky — variance); reasoning level irrelevant at Opus |
| `sem_join` | entity linking | **haiku** for recall; but ALL tiers fabricate ~7% under near-collisions → **gate every link** (deterministic verify + human) |

**Methodology flag:** every cell above is **n=1**. The derived haiku 75%→100% flip
is proof that variance is real and repeats are mandatory before trusting any single
scorecard — the same lesson the Tier-2 harness recorded. Next: add repeats
(≥3/cell) to pin variance; the adversarial-`sem_join` probe (same-surname decoys);
then materialize a winning path — the haiku `sem_filter` vote-type tags — as a
Silver-layer Pumper dataset (§4).

## References

- [Semantic Operators — LOTUS (arxiv 2407.11418)](https://arxiv.org/abs/2407.11418) · [lotus-data.github.io](https://lotus-data.github.io/) · [github/lotus-data](https://github.com/lotus-data/lotus)
- [Compiling NL queries into semantic-operator pipelines (arxiv 2606.04641)](https://arxiv.org/pdf/2606.04641) · [FDABench — data agents over heterogeneous data (arxiv 2509.02473)](https://arxiv.org/pdf/2509.02473)
- [Medallion architecture (endjin, 2025)](https://endjin.com/blog/2025/05/what-is-the-medallion-architecture) · [Beyond Bronze/Silver/Gold — AI era Feature + Vector layers](https://medium.com/@vishal.dutt.data.architect/beyond-bronze-silver-gold-evolving-the-medallion-architecture-for-the-ai-era-77d3cca78745)
- Related in-repo: `docs/knowledge-graph-loop.md`, `docs/data-analysis/*`; Wellspring `docs/data-analysis/tier2-eval-harness.md` (the engine/substrate harness this reuses).
