# Case loops — the shared kernel for the golden-trio analyst-builder loops

> **STATUS 2026-07-25: RUNNING — batch 006.** The manifestation pause is CLOSED.
> Four frontend executors landed list→detail routes at real volumes across all
> three cases plus the `/admin` progress/review hub — and the pause's decisive
> find was that **PGlite never opened inside the Next runtime**: every surface
> had been silently serving mock data while the loops looked perfectly healthy
> (fixed with `serverExternalPackages`; verified by a build resolving 207 real
> MP profiles). That is why cycle step 6 now exists. Batch 006 adds two external
> sources cleared during the pause: **dataor** (bulk OR export — operator
> accepted the non-commercial + GDPR-controller conditions) and **kiosek**
> (úřední desky — unanonymized IČOs + statute citations; feeds BOTH cases).

> **That STATUS line is MACHINE-READ.** `/admin` derives whether the case loops
> run from it (`features/admin/loops/loopState.ts` → `parseLoopsStatus`, read by
> `getAdminData.loadLoopsStatus`). The vocabulary is exactly two tokens —
> `RUNNING` and `PAUSED`; the date is optional. Anything else, or a missing
> line, is **„stav smyček nečitelný"**: the console then asserts neither a pause
> nor a run, and the case loops render „neznámo". Keep the shape
> `**STATUS <YYYY-MM-DD>: <TOKEN> — …**`. Until 2026-08-12 a hardcoded
> `LOOPS_PAUSED = true` constant overrode this line and reported a pause over
> running loops for the eighteen days since it flipped to RUNNING.

The third generation of the loop family, and the design doc the three case skills
(`.claude/skills/{money-loop,effort-loop,law-loop}.md`) extend. Read this before
running any of them.

| Generation | Skill | Question | Unit |
|---|---|---|---|
| 1 | `data-analysis` | is the data any good? | slice (source×term×entity) |
| 2 | `knowledge-graph` | what structure does it hold? | frontier item (one question) |
| **3** | **case loops** | **what VALUE does it hold — and ship it** | **population unit** (tie, contract, MP, bill) |

Everything proven in generations 1–2 carries over unchanged: the vault as memory,
deterministic-owns-numbers / LLM-interprets, schema-gated verdicts, atomic pass
finalization, self-awareness metrics. Generation 3 adds three things: **unit
ledgers** over enumerable populations, a **triage-ranked batch engine**, and
**build phases** — the loop doesn't just propose features, it implements them.

**The mentality.** Large open datasets + a strong LLM with web search + a hard
deterministic gate = the capability the state portal can never assemble: we can
*identify relations no one else can* and represent them with product-grade UX.
The value is DISCOVERED as analysis progresses — the app's feature principles
exist, but the loops decide what is worth building from what the data shows.

## The batch cycle

```
resume → triage → dispatch army → gate + persist → reflect → build-review → loop
```

1. **Resume.** Read **`docs/data-analysis/case-<x>/STATE.md`** — the short current-state
   page (headline figures, rules now in code, open items, durable tools, next pass
   number), regenerated at the end of every batch. `ledger.md` is the append-only batch
   LOG and is read for history, not to resume; `ledger.json` is machine state (units +
   `openItems`, mirrored in STATE). *Until 2026-08-22 the ledger was the resume point and
   had grown to 1 100+ lines — ~80 KB of prose per session before it could act.* A batch
   is not finished until STATE.md says what it changed.
2. **Triage (deterministic, no LLM).** Recompute per-unit **signal scores** and
   rank the queue. The army processes systematically but in VALUE ORDER — stop
   after any batch and the best-covered head is always the highest-value units.
   **Validate discriminative power before trusting a signal** (batch-001 lesson):
   a signal that saturates on one value or fires on >50% of units is degenerate —
   fix it (log-scale, class-partition, densify its basis) before it ranks
   anything. A suspiciously high hit rate also deserves a **substring-collision
   check**: Czech keyword classifiers must use word-boundary regex, never
   `.includes()` (P42 — "vydání" contains "daní"; the bug drove batch-001's 89%
   routing over-fire and propagated silently through shared code). And **pre-filter structural false positives in code** before the
   army runs: both money and effort spent Opus dossiers proving leads false that
   a 5-line deterministic check (tie-class; `never_cast_ballot`) would have
   filtered.
   Engine choice follows the measured guide (`docs/db-architecture-guide.md`):
   **R4** — populations under ~100k rows (ties, contracts, bills, MPs) triage
   fine in PGlite SQL on a copy; **R3** — reach for DuckDB only when the pass
   joins the 406k-ballot table or similar analytical self-joins; **R6** —
   pgvector (in-DB) for subject-similarity signals (embed once, query many);
   **R9–R11** — when full texts land (steno, e-Sbírka), index with
   tsvector+GIN from the start, never LIKE-scan a large corpus.
3. **Dispatch the army.** N units → parallel subagents. Each unit passes four
   stages: **clean** (anomaly flags — code-first; LLM only where judgment is
   needed) → **enrich** (web + API research; EVERY claim carries URL + access
   date; when a planned pull is resource-constrained, spend a small bounded
   probe on whether the SAME source exposes a cheaper access path — law's
   e-Sbírka SPARQL discovery replaced a shelved 1.24GB bulk plan with
   negligible point queries) → **wire** (proposed KG nodes/edges/props — gated, never direct) →
   **signal** (story-worthiness score + a one-line why — AND cross-cutting
   leads: data-quality gaps, sibling-unit collisions, quiet riders; batch 001's
   richest yield was non-headline classes). **Model tiering (CONFIRMED by the
   batch-002 experiment — three independent Opus audits):** the loop DRIVER
   and the army run **Sonnet**; **deterministic code before either** (money's
   population reconciliation ran at ~75× lower cost/unit with a BETTER
   honest-negative rate by coding the bulk and spending Sonnet only on the
   ambiguous slice). **Opus runs at maximum reasoning effort** (`effort:
   'xhigh'` where exposed; otherwise instruct maximum depth) and is reserved
   for three verified-value uses: (a) **batch QA/reflection** — in every
   batch-002 loop the Opus audit caught real defects a Sonnet-only pass had
   accepted (undated-money conflation, an IČO mismatch, a citation-kind
   mislabel, an over-strong headline); (b) **targeted verification of
   money-touching claims** — the ONE weakness class Sonnet showed (both
   effort quality gaps were money claims); (c) **the conditional top-signal
   trigger, kept ARMED** — batch 002's all-low populations provided zero
   evidence on the high-signal case Opus exists for; fire it on genuine
   severity, never retire it. **Pre-extract each unit's full
   context into a batch inputs file** (effort's `dossier-inputs.json` pattern)
   so army agents never open the single-connection DB copy; grouped Sonnet
   agents hold quality at 3–5 units each. **Concurrency budget:** the platform
   caps ~20 parallel subagents TOTAL — in fleet mode budget ≤6–8 concurrent per
   case or stage waves.
4. **Gate + persist.** Every wire proposal passes schema + entity-id membership
   validation (the `kg-verdict.ts` pattern; case gates listed in each skill) **and the
   prop-key gate**: `persist-batch.ts` refuses any jsonb key not listed in
   `lib/kg/prop-registry.json` for that kind/rel (the jsonb schema; `--allow-new-keys`
   for a deliberate addition, registered + described in `graph-schema.md` in the same
   change; `npm run da:props-check` diffs the live store against it).
   Vault batch note written FIRST, graph second (exclusive `.pglite` window),
   ledger update last, **STATE.md regenerated** — atomic per batch. **Backups are
   `npm run db:backup`** (CHECKPOINT → copy → prune to 2), never a bare `cp -r`: every
   write is a committed payload, so two checkpointed copies + replay recover any state —
   14 hand copies held 22 GB, 41 % of it un-checkpointed WAL, before the 2026-08-22
   review pruned them.
5. **Reflect (every batch).** Cross-unit patterns → `[[patterns]]`;
   disagreements with prior batches → `[[contradictions]]`; cited entries →
   `[[feature-opportunities]]`; emergent questions → the case section of
   `[[frontier]]`; steering (batch size, ranking tweaks) + a metrics row into
   the case ledger: units done/total, **signal yield** (new signals ÷ units —
   the convergence measure), cost/unit, reuse-rate. **Absence of signal is a
   finding, not a failure** — 0 conflicts in a top-flagged head, a clean-hands
   population, a quiet workhorse are the non-partisan-symmetry outputs that
   make the accusatory ones credible; record them with equal weight.
6. **Manifestation check — and RENDERING IS NOT READING.** The batch-006 pause
   fixed *whether* data reaches the screen. It did not fix whether a Czech
   reader can USE it, and eight batches shipped without anyone asking. Measured
   2026-07-27, after the loops declared success: **27/27 forensic verdicts were
   in ENGLISH**, **0/141 bills carried a summary**, and reference blocks rendered
   as raw objects. The product's whole premise — *take a mess of open data and
   return structured insight* — was inverted: we produced a second mess with
   better provenance. So every batch now clears a **presentation gate** on
   anything a reader sees, with the same code-first discipline that fixed the
   jargon leak (prose lessons do not survive contact with the next army):
   - **Czech, always.** Analyst prose, verdicts, labels, summaries. An
     English-language artifact on a reader-facing field is a DEFECT, not a
     stylistic preference — gate it deterministically, like `public-copy.ts`.
   - **A unit has a one-line human summary** before it has anything else. A
     bill with 12 forensic fields and no "what this changes" line is unreadable
     no matter how well provenanced.
   - **References render as references** — a formatted citation with a working
     link, never a serialized object or a bare id.
   - **Volume must be shaped, not dumped.** Each surface states how it scales
     (filter/search/rank/paginate) at the volume the batch just created.
   - **The gate is CODE at the loader, not a rule in this file.** Batch 009 found
     the jargon/English leak had simply moved one surface over: every one of the
     **44 close-read analyses rendered on `/zakony/kolize` was English**, written
     after the pass-33 verdict rewrite and after this very section was added.
     Prose does not survive the next army — the fix is to import
     `lib/analysis/language-gate.ts` in the loader so an English string is
     WITHHELD (with an honest placeholder) rather than shipped, plus a test that
     fails on the next one. Every reader-facing loader in the repo needs that
     import; treat a loader without it as an unguarded surface.
   - **"The data just needs wiring in" is a claim to verify, not a task estimate.**
     Batch 008's reflection recorded that `/zakony/kolize` was "one filename away"
     from rendering the new findings. It was not: that payload spelled its
     classifications in a different vocabulary (`confirmed` vs
     `confirmed-collision`), so adding the filename alone would have dropped all
     12 pairs at a downstream filter — and a dropped-at-filter failure is
     indistinguishable from "that batch found nothing". Before declaring
     manifestation debt cheap, check that the payload's VOCABULARY and required
     FIELDS match what the loader consumes, not just that a file exists.
   - **A RECOMPUTE is not finished when the numbers are right.** Effort batch 010
     found that pass 42's committee correction — an exemplary data pass, which
     replayed the old formula and refused to write unless it reproduced every
     stored value — still shipped a product defect: **14 dossier sentences named
     the superseded committee count and 16 quoted a superseded score**, two of
     them claims that INVERTED (a „stays above the club average" that is now
     below it). Analyst prose QUOTES the numbers a recompute moves, and no
     consistency check on the number can see it. So anything that re-derives a
     value must also ask what already SAYS that value — and the check belongs in
     the recompute, which holds the before and after by construction, not in a
     gate that sees only the after state (`kg-contribution-recompute.ts` now
     reports the prose it invalidates). Corollary from the same batch: **a guard
     that fires zero times has proven nothing** — the score lens was retired at
     6/6 false while 16 real hits sat in the corpus, because it had been
     validated against the shape the prose OUGHT to have rather than against the
     corpus itself.
   - **The surface may not contradict the token it renders.** Law batch closure
     shipped `/zakony`'s forensic register printing „deterministické odvození —
     lidskou branou neprochází" directly beside `pending_review · 141` — a
     sentence its own neighbouring row falsifies. Every verdict is written
     `pending_review` (`kg-forensics.ts`) and `/dukazy` is where those decisions
     get published; the register was describing an analyst pass and forgetting
     that the pass ENQUEUED something. Rule: a gate sentence is DERIVED from the
     stored token through the one gate vocabulary
     (`features/overeni/gateVocabulary.ts`, where `pending` ≡ `pending_review`),
     never asserted beside it — and the verbatim token stays on the surface, so
     the two can be read against each other.
   - **A published figure has an address.** The corpus census and the statute
     coverage tiles were quotable numbers with no permanent ref, so `/overeni`
     had nothing to verify on the whole law surface. A number a journalist
     copies gets a claim minted by ONE pure module shared by the issuing surface
     and the gate (`features/lawwatch/lawClaims.ts`, the `moneyClaims.ts`
     precedent), and its basis comes from the CORPUS-WIDE provenance aggregate —
     never one verdict's pass and never a neighbouring pass number that happens
     to be in scope.
   The kernel's older rule stands beneath this one: data that doesn't render
   doesn't exist. Every batch's reflection must answer: *does what this batch
   persisted actually RENDER, and does the surface scale to the data volume it
   now carries?* A batch that grows the graph without growing its surface incurs
   manifestation debt — track it in the ledger like any other debt. The fleet
   includes a **Frontend executor** role for exactly this: an agent whose whole
   batch is wiring persisted data into product surfaces (information
   architecture, list→detail routes, filters/search/pagination at real volumes,
   Konstrukt discipline) rather than producing new analysis. Dispatch one
   whenever manifestation debt spans more than one surface; the `/admin` hub
   tracks per-case progress and the review pipeline. **`/admin` is gated**
   (2026-07-26): it renders only against a configured `ADMIN_TOKEN` submitted
   once into an httpOnly, `/admin`-scoped session cookie and verified in
   constant time (`lib/security/token.ts`, the gate the `/penize/kontrola`
   write path uses). Unset token → the console is closed and says so, and
   `getAdminData()` is never called. Set `ADMIN_TOKEN` in `.env.local` before
   running the hub locally.
7. **Build-review (adaptive cadence).** Review interval R in batches: **start
   R=1**; when a review ships nothing, R doubles; when something ships, R
   resets to 1. A build phase = implement the top build-ready opportunity end
   to end: server-loader pattern (`app/<route>/page.tsx` awaits a server-only
   `features/<case>/get*Data.ts`, typed props into the `"use client"`
   component), `SourceNote` on every number, `npm run check` green, docs
   synced, one atomic Conventional commit. **This is how the analyst becomes
   the app builder.**
8. **Converge.** K=3 consecutive batches under the signal-yield threshold →
   declare coverage in the ledger; the loop drops to staleness-driven mode
   (re-ingest / Pumper watch events re-open it).

## Authority (decided 2026-07-24)

- **Ship authority:** build phases implement, verify, and **commit to master
  autonomously**; **pushes happen only at user-declared milestones.**
- **Ingest authority:** loops build new ingest adapters for open sources
  **fully autonomously**, including registering for **free** API keys/accounts
  where needed. **Payment always waits for the user.**
- **The human gate is never delegated.** No loop, at any autonomy level, flips
  a `review_state`. Corroboration annotates and raises reviewer confidence;
  only a human verifies — since batch 003, exclusively through `ReviewRepository`
  + the token-gated `/penize/kontrola` server action, with an append-only
  `review_audit` row before every flip.
- **The gate now covers BILL VERDICTS and PERSON-LEVEL EFFORT VERDICTS too**
  (2026-09-04, moonshot G2 / deck #5 + #12). Until then the rule above was true
  and almost vacuous: it governed one claim kind, while three others — bill
  forensic verdicts, effort verdicts about named MPs, tripwire candidates —
  reached readers with **no writer at all**, so their `pending_review` was
  permanent by construction. `ReviewRepository.setReviewState(subject, …)` is
  now the one writer for `tie`, `bill_verdict` and `effort_verdict` alike, over
  one shared skeleton: read state → shared decision mapping → refuse a
  reasonless reversal → append the chained audit row → **only then** write the
  subject's state, all in one transaction.
  - The effort loop stamps `review_state: "machine"` and **cannot write anything
    above it**: `merge-batch.ts` writes only that rung, and `gate.ts` DROPS a
    proposal that arrives claiming `verified` or carrying a `decided_by`. A
    script promoting its own verdict is now a gate failure, not a possibility.
  - Re-running the loop **never resets a decided verdict** back to `machine` —
    the stamp is merge-preserving per field.
  - The sentinel's `effort-review-chain` invariant is the backstop the Authority
    rule never had: a verdict claiming `verified`/`rejected` with no audit row
    behind it is a violation. A mass `machine → verified` flip leaves every hash
    in the chain intact and passes every other invariant, which is precisely why
    that check exists (fault-injected in `sentinel.test.ts`).
  - `tripwire` and `lead` are **declared and refused**, not silently recorded:
    neither has a durable subject a decision could be read back from, and a
    decision nothing can read back is worse than none.
- **A human write layer over a re-derivable ingest needs an explicit durability
  contract** (P44/D1): the ingest must merge-preserve human-written fields (or
  the audit trail must replay after ingest) — `props = excluded.props`
  wholesale-replace silently erases a reviewer's work. When reviewing ANY
  write-path build, the reflection must ask "what ELSE in this repo writes to
  this same field/table", not just "does the write path work".
- **Deferred-three-batches is a decision point**: an item that rolls through
  three build-reviews without running gets committed to the next batch or
  retired — never deferred a fourth time.

## Fleet mode (parallel runs)

Solo mode (one loop per session) may write everything itself. When several case
loops run in parallel in one repo — **fleet mode** — three resources are
single-writer and are handed off to the orchestrator instead:

| Resource | Fleet rule |
|---|---|
| live `./.pglite` | NEVER write. Analyze on a case-suffixed copy (`cp -r .pglite .pglite-copy-<case>`; `PGLITE_PATH=`). Emit materialization payloads + scripts; the orchestrator serializes live writes via `scripts/case-loops/persist-batch.ts` (props-merge writer: nested annotation provenance, refuses to insert missing targets). |
| shared vault files (`frontier`, `feature-opportunities`, `graph-log`, `patterns`, `contradictions`) + shared code (`lib/analysis/kg-verdict.ts` enums, `package.json`, `messages/*.json`) | do not edit; put proposed additions in the case handoff. |
| git | **no process stages the whole tree while a fleet window is open.** Orchestrator and housekeeping commits stage explicit paths, never `-A`/`.`/`-u` — a batch-008 investigation traced an unrelated concurrent session sweeping that batch's in-progress, unreviewed payloads into a commit whose subject line named a different case, 19 seconds after they were written. Case drivers additionally do not commit — **no exceptions, not even a boundary-clean commit of your own build** (a law driver did exactly that in batch 004; the commit was kept because it happened to be surgical, but the rule exists so the orchestrator can review BEFORE history is written, and staging races with siblings are only safe when one process touches the index). Leave changes in the tree; the orchestrator reviews and commits per case. |

**A driver never ends its run waiting.** If a sub-agent is still working, the
driver stays alive until the result lands and the handoff is WRITTEN — ending a
turn with "I'll report when it finishes" strands the batch. The handoff document
is the only valid last act of a fleet run. Working scraps go in the case folder
or a gitignored dir, never the repo root.

> **This rule failed as prose — four times** (batches 003 ×2, 006 ×2), including
> after it was written down in response to the first pair. Since batch 007 every
> brief therefore makes completion **checkable instead of inferred**: the brief
> names the handoff file, and the driver's final report must end with that
> file's absolute path as its LAST LINE. An orchestrator that doesn't see the
> path treats the run as unfinished and resumes it — no interpretation needed.
> Generalisation worth carrying to any agent contract: when a behavioural rule
> keeps being violated, stop restating it and give it an observable output.

Everything else — the case vault folder (`docs/data-analysis/case-<x>/`), the
case's feature/app boundary, case-owned `lib/` modules, new scripts under
`scripts/case-loops/<case>/` — is the agent's to write. **Script hygiene** (2026-08-22):
the top level of `scripts/case-loops/<case>/` holds DURABLE tools only (no batch suffix
in the name, listed in that dir's `README.md`); one-shot probes are born in `archive/`
and promoted by rename when a later batch reuses them. Raw source harvests live in
`data/raw/` (gitignored), never in `docs/`. Each fleet run ends
with **`docs/data-analysis/case-<x>/handoff.md`**: graph payloads (validated,
with the gate command to re-verify), shared-file additions (exact text to
append), proposed enum/schema changes, commit plan (files + suggested message),
and the lessons-learned block the orchestrator aggregates cross-case.

## Case ④ — tender loop (added 2026-08-23)

The needle loop inverts the trio's person-first direction: unit = one TENDER LOT
from the ISVZ/RVZ open data, flags are deterministic register facts (single bid,
short window, repeat winner …), and the picture composes from volume — authority
and supplier groupings around inefficiency, with the MP graph reached only where
shared `company:ico:*` nodes happen to touch. Track field: `track: "tender"`.
Flags are signals and never accusations; corruption vs incompetence is never
asserted (both are „neefektivita"); person-level claims stay in Case ①'s
human-gated lane. Skill: `.claude/skills/tender-loop/SKILL.md`.

**Synthesis track (added 2026-08-24, user decisions R1–R4).** Above the signal
layer sits the FINDING (nález): arena × term window × persisted shape ×
evidence bundle. The arena — which ballot holds the buyer accountable
(komunalni / krajske / statni / nejasne) — is mapped deterministically from
RVZ's `kategorie_zadavatele` by `scripts/case-loops/tender/arena.ts` (pass 74;
„nejasne" = categories that legally hide the principal, resolved only by an
ownership hop, never guessed). Findings compose by deterministic rules, pass
the same hand-read gate as flags, and render as „otázky pro zastupitele" —
questions to the accountable body, never accusations. UX north star is
lookup-first („Kde volíte?"); no new data campaigns until synthesis shows its
value (R4).

## Provenance — the track field

Investigative passes continue the shared numeric sequence (trio used 10–12) but
from now every case-loop node/edge provenance carries a **`track`** field:
`{track: "money"|"effort"|"law", pass: <n>, method, ref, computedAt}`. Pass
numbers are assigned at finalize time by whoever holds the write lock (the
orchestrator in fleet mode), in write order. This permanently resolves the
analytical-loop vs investigative-track numbering ambiguity documented in
[[graph-schema]].

## Web-research doctrine (non-negotiable)

- **A web finding is a LEAD, never a fact.** It lands as cited enrichment
  metadata (`{claim, url, accessedAt, sourceKind}`) and enters the graph only
  through a deterministic or human gate.
- **Primary registries outrank media**: psp.cz, e-Sbírka, ARES/VR (justice.cz),
  Registr smluv, Hlídač státu > news. Media coverage is *context* in narrative
  notes, never a graph fact.
- **Never assert ABSENCE of a company tie without the ARES VR endpoint**
  (`/ekonomicke-subjekty-vr/{ico}`) — the plain `/ekonomicke-subjekty/` endpoint
  never contains officers, so a negative from it is an unverified negative
  (batch 003 caught 5 false clearances this way, C11). Over-claiming AND
  under-claiming are both live failure modes on money-touching claims.
- **A research agent's confidence label is a claim to verify, not a fact** —
  independently spot-check the primary source before accepting "high"
  (batch 003: PRaK "high" → medium once ARES 404s were checked).
- **Presence claims verify by grep, not by a second model read** — for
  "does text X appear in document Y", deterministic search of the fetched
  text is cheaper and stronger (P49). Corollary: a prose-vs-props numeric
  cross-check belongs in the gate, in code (Q-effort-11).
- **P49 applies to the ANALYST's own prose, not just to researched claims.**
  Batch 008 published a `confirmed` collision asserting two bills carried
  "VERBATIM IDENTICAL" text that occurs in only one of them — it had compared one
  bill's excerpt against itself. Two independent Opus agents ran that batch and
  neither was scoped to catch it. The durable fix is a script
  (`scripts/case-loops/law/verify-close-reads.ts`): any claim that two documents
  share text must name the text, and the text must be found in both. **A guard
  built this way needs its own fire rate validated exactly like a triage signal** —
  that one's first draft failed 106 of 102 checks, and each successive rule was
  written only after hand-reading the survivors of the previous one (~100% → 87%
  → 8% → 2% → 0%). A guard whose failures nobody has read is not evidence.
- **Public-role facts only.** The platform holds public officials accountable
  for public roles; private life is out of scope, always.
- **Non-partisan symmetry.** Positive findings get equal surface: the quiet
  workhorse, the clean-hands MP, the committee that scrutinizes well. "134 MPs
  with zero detected ties" is a finding.
- Czech sources are read natively; every rendered number still cites its
  source (`SourceNote` — the brand rule).

## Vault layout

```
docs/data-analysis/
  case-money/   ledger.md · ledger.json · batch-NNN.md · handoff.md (fleet)
  case-effort/  (same)
  case-law/     (same)
  (shared, finalize-step only: frontier.md · feature-opportunities.md ·
   graph-log.md · patterns.md · contradictions.md)
```

`ledger.md` carries the human-readable batch log + metrics block (the
generation-3 analogue of the coverage-ledger's graph-metrics). `ledger.json`
is the machine state — derived, recomputable, but git-tracked so any session
resumes exactly.

## Guardrails (inherited + new)

- Deterministic owns every count; the LLM interprets, ranks, and narrates.
- Gate every wire proposal; discard and re-run on drift — never persist a
  hallucinated id or an invented number.
- One batch per cycle, atomic finalize (vault → graph → ledger).
- Respect the PGlite single writer; reads on copies, writes exclusive.
- Web claims cited or discarded; media never becomes a graph edge.
- The human gate is inviolable (see Authority).
- No silent truncation: a skipped unit, a dropped row, a sampled subset is
  logged in the batch note.
- A harvested dump is complete or it is not a dump: the money harvester
  (`scripts/case-loops/money/harvest-contract-dumps.ts`) streams each monthly
  file under a `.partial` name, pins the byte size the registry's index states
  before the first byte, and only renames to the final name when the received
  count matches — a month is never marked done over a short file (added
  2026-09-02; before this, a server that advertised and delivered fewer bytes
  than the index passed every check).
- A parse that costs something is kept, and it names what produced it: the
  kiosek slice (`scripts/case-loops/sources/kiosek-slice.ts`) no longer throws
  away its `unpdf` output. `lib/ingest/parsedText.ts` writes a `<pdf>.txt`
  sidecar beside the cached bytes whose first line is
  `#parsed-text/1 unpdf@<version> sha256:<16>`, and reuse requires the format,
  the parser version AND the byte fingerprint to match — a missing, older or
  foreign stamp re-parses loudly, and an unreadable `unpdf` version disables
  the sidecar rather than degrading it into an unverifiable cache. A warm
  re-run invokes `unpdf` zero times, so re-scoring the corpus against a new
  statute pattern or a refined IČO rule is regex-over-text; `--reparse` is the
  deliberate override. The sidecar dies with its bytes (`deleteParsedText`) —
  extracted text with no source to re-derive it from is a claim without a
  source. This does NOT extend to the contract-dump lane, where retaining a
  filtered-out corpus beside the dump would break the publisher's GDPR
  condition (added 2026-09-03).
- Build phases meet the same bar as any session: `npm run check` green, docs
  synced same-session, tokens/colors discipline, Czech-first copy.

**The effort gate reads the low-score vocabulary from the badge's module (2026-09-06,
scan-sweep, parity-auditor).** `scripts/case-loops/effort/gate.ts` carried its own
twelve-value `Set` of `effort_low_score_reason` values beside
`lib/analysis/low-score-reason.ts`, which owns the vocabulary the badge renders
from; identical today, and a reason added to one would have been silently dropped
by the other. The gate now validates through `isLowScoreReason`;
`sharedRules.test.ts` pins it.

**Triage, tenure and the dossier extractor import the shared definitions they
mirrored (2026-09-06, scan-sweep, parity-auditor).** `triage.ts` re-typed the
formula's three saturation caps as literals (3 / 4 / 40) against
`lib/analysis/contribution.ts`'s "never mirror these"; `triage.ts`, `tenure.ts` and
`extract-dossiers.ts` each spelled the tenure-class union by hand — the extractor's
copy still had two classes two batches after the vocabulary grew to four. All read
`TenureClass` and the `*_SATURATION` constants now (the 2026-09-06 backlog card on
the re-declared union is shipped by this change). `divergence-retune.ts` keeps its
literals on purpose: it is batch 003's validation evidence and must reproduce that
run.

**Tenure days are counted to a stated reference date, not to 2026-07-24 forever
(2026-09-06, scan-sweep, bounty-hunter).** `tenure.ts` and `triage.ts` both carried
batch 003's run date as a literal, so any later run would have written
`effort_tenure_days` measured to July — the number `TenureTrendGate` compares
against `TREND_MIN_TENURE_DAYS`. Both scripts now read `--reference=YYYY-MM-DD`
(default today) through one shared helper; batch 003 stays reproducible by passing
its date, which its payload records.

**The psp.cz tisk text pipeline has one definition (2026-09-06, scan-sweep,
parity-auditor).** `amends-census.ts` and `collision-check.ts` each carried a byte
copy of index-page → PDF → `pdftotext` sidecar, and the copies had grown apart:
batch-008's NFC fix reached the census only. `scripts/case-loops/law/tiskText.ts`
is the module now (the census imports it; the collision scripts are the next
context's round). It also classifies refusals the way the ingest adapters do: a
503 is retried with jittered backoff instead of falling through to a per-bill
skip, a 404 is one request. `tiskText.test.ts` pins retry, index parsing and the
NFC read.

**`esbirka-sparql-diff.ts` reads the HTTP status before the body (2026-09-06,
scan-sweep, state-coverage).** A Virtuoso error with a JSON body parsed to zero
bindings and surfaced as "no fragments found — check the version exists", i.e. a
claim about the statute for a fault in the query or the endpoint.
`esbirkaSparql.ts` names the status; tested.

**`provenance-probe.ts`'s EXPECT is pinned to STATE.md's table (2026-09-06,
scan-sweep, documentation-auditor).** The probe's literal and the state page's
row are two hand copies of the ledgered chamber (141 / 293 / 582, passes 45–55);
`provenanceProbe.test.ts` fails when a batch moves one without the other.

**`esbirka-versions.ts` caches the 176 MB dump atomically and counts what it
skips (2026-09-06, scan-sweep, error-handler).** The raw `.gz` was written under
its final name while streaming, so an aborted run left a truncated archive that
every later run "used" and gunzip rejected until someone deleted it by hand; the
download now lands in `.part`, is renamed on completion and is read back from
disk as a stream (`esbirkaStream.ts`, tested). A malformed record is counted into
`malformedRecords` in the output and the console line instead of being swallowed
behind an `eslint-disable`.

**`collision-check.ts` imports its pipeline and extractors instead of copying
them (2026-09-07, scan-sweep, parity-auditor).** The live script still carried the
batch-002 byte copies of the tisk pipeline (pre-NFC, no refusal classification —
a 503 skipped the bill) and of `extractParagraphs` /
`partitionParagraphsByStatute`, the very functions batch-009 extracted into
`collision-core.ts` so they would stop being copied. It now imports `tiskText.ts`
and `collision-core.ts`; `collisionSource.test.ts` fails if a local definition
returns. The docType-aware `operativeSlice` stays local on purpose: for a platné
znění document it keeps the text before the first ČÁST heading, which the core's
bill-only slice would cut.

**`verify-close-reads.ts` reads the cache through `collision-core`
(2026-09-07, scan-sweep, parity-auditor).** The P49 guard had its own cache path
and its own `.txt` join; it now calls `readCachedBillText` and applies only its
comparison form on top — one cache path and one NFC read for every collision
script.

**`company-sectors.ts`: `IT` is a whole word (2026-09-07, scan-sweep,
bounty-hunter).** Under the `/i` flag `IT\b` was a suffix match, so any label
ending in "-it" (audit, kredit, profit, transit) classified as `digital` — the
P42 class the module's own header warns about. 0 realised hits over the 156
company labels in the case payloads (probed), 1 reproduced in
`company-sectors.test.ts`, which also pins the overrides and the municipal net.
