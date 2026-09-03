# Peer design comparison — `politicas` vs `HKUDS/LightRAG`

**Run:** `intake-lightrag-0902`, Phase 7.6 peer study.
**Peer:** `HKUDS/LightRAG` @ `c1248646e4eda4d89054926af2e094730daf23fe`, checked out at `C:/t/lightrag`.
**Why a peer and not a candidate:** `politicas`' `scope.does` reads *"five civic modules over one
shared entity graph; every rendered number cites its source; ingestion adapters for public data;
LLM-assisted extraction with cost tracking"* (`.ai/manifest.yaml`, `scope:` block). LightRAG is the
same **class** of system — a document ingestion pipeline that builds one shared entity graph by LLM
extraction and serves queries over it. Same object, opposite identity regime.

**The discriminator, stated once and then held.** `civic-knowledge-graphs` § "Things, not strings"
says it in the corpus's own words: *"the graph holds **entities, not mentions**: a node exists only
under a durable identity, and the identity comes from the registries, not from the text… **Name
similarity is never an edge.**"* It then names LightRAG's shape as failure mode #1: *"**The mention
graph** — string-matched entities, name-similarity edges; homonyms convert an innocent namesake into
a suspect."* LightRAG keys a node on `normalize_entity_name(record_attributes[1])`
(`operate.py:724`) — the LLM's own output string. `politicas` keys on registry identifiers
(`psp:person:<pspId>`, `company:ico:<8>`, `contract:<idSmlouvy>`, `law:sb:<n>`).

**This is not a conflict to resolve.** LightRAG has no authority to join against; refusing to build
the graph is not an option available to it. `politicas` has three registries and is therefore held
to a stricter rule. **Where a decision of LightRAG's follows from the absence of an identity
authority, the verdict is `different forces` and the study stops there.** Nothing below proposes
importing surface-form identity, and no proposal in this pass touches the entity-key decision.

**Anchor honesty.** Every `[H]` line number in the front half's design read was re-derived against
the trees this run. Six seeded points were corrected; they are marked **[CORRECTED]** and the
correction is stated. Anchors are `file:line`, read directly.

---

## 1. Identity regime and entity keys

**1.1 — The node key.**
LightRAG: `operate.py:724` `entity_name = normalize_entity_name(record_attributes[1])`, written as the
graph key at `operate.py:2727` (`entity_id=entity_name`) and hashed into the vector id at `:2743`
(`compute_mdhash_id(str(entity_name), prefix="ent-")`).
`politicas`: `lib/analysis/kg-money.ts:83` `companyUrn = (ico) => \`company:ico:${ico}\``;
`lib/analysis/kg-verdict.ts:85` `ENTITY_URN = /\bpsp:[a-z_]+:\d+\b/g`; `lib/db/pglite/ddl.ts:224-230`
(`kg_node.id text primary key`).
**Verdict: `different forces`.** LightRAG's corpus has no register; `politicas` has three. Adopting
the surface-form key here builds the mention graph its own golden path names as failure mode #1.

**1.2 — What the normaliser actually does.** [CORRECTED]
LightRAG: `utils.py:5391-5393` → `sanitize_and_normalize_extracted_text(..., remove_inner_quotes=True)`;
rules at `utils.py:5396-5421` (HTML strip, CJK full-width→half-width, Chinese punctuation→ASCII,
quote stripping). **There is no case folding and no whitespace collapse.** Case consistency is
delegated to the *prompt* — `prompt.py:63`, `:71-72`, `:182`, `:191-192` ask the model to title-case.
So `Apple Inc` and `apple inc` are two nodes.
`politicas`: n/a — ids are not derived from prose.
**Verdict: `keep ours`.** The front half recorded C1 as "a normalised surface form". The
normalisation is weaker than that phrase implies: the identity contract is enforced by asking the
model politely, which is not enforcement. Recording this sharpens the corpus's failure-mode entry —
the mention graph is worse than the corpus assumed, because it is a *case-sensitive* mention graph.

**1.3 — Identity risk does not vanish under a registry; it relocates.**
`politicas`: `scripts/case-loops/money/canonicalize-ico-nodes.ts:1-27` — eight `company:ico:*` nodes
carried unpadded IČO (`company:ico:11835` vs the canonical `company:ico:00011835`), producing *"a
split identity"* (`:13`) for IF Holding a.s. and *"every future IČO join against these 8 is a
guaranteed false negative"* (`:19`).
LightRAG: the analogous failure is a *homonym* merge; here it was an *id-format* split.
**Verdict: `adapt`.** The registry join removes homonym risk and introduces normalisation risk. The
mechanism worth taking from LightRAG is not its key but its **funnel**: one named function
(`utils.py:5391`) that every writer passes through. See 1.4.

**1.4 — One normalisation door vs a convention.**
LightRAG: exactly one identity function (`utils.py:5391`), plus one length/byte clamp
(`operate.py:209-246`, bounds `DEFAULT_ENTITY_NAME_MAX_LENGTH = 256` at `constants.py:18` and
`DEFAULT_ENTITY_NAME_MAX_BYTES = 512` at `constants.py:23`), applied at `operate.py:999`, `:1067`,
`:1073`, `:1612`, `:1628`, `:1634`. The *truncated* name is the key (`operate.py:1619`).
`politicas`: **absent as a door.** The `company:ico:` grammar is re-spelled at
`lib/analysis/kg-money.ts:83`, `lib/ingest/sources/kiosek.ts:483`, `lib/analysis/volby/rules.ts:129`,
and parsed back out at `lib/ingest/changeEvents.ts:147`. `companyUrn` accepts any string and pads
nothing. It would live beside the vocabulary that *is* already single-sourced —
`lib/analysis/kg-verdict.ts:24` (`KG_NODE_KINDS`) / `:27` (`KG_EDGE_RELS`).
**Verdict: `adopt`.** `civic-entity-ontology` asks for *"exactly one machine-enforced definition
that every writer, validator and view imports"*; `politicas` has that for the **kinds** and not for
the **id grammar**, and the gap has already cost a split identity. → **Proposal 1.**

**1.5 — Entity type.**
LightRAG: free text, validated only for shape — `operate.py:661-706`
(`_normalize_and_validate_entity_type`: reject `'()<>|/\`, take first comma token, lowercase, reject
JS prototype names); the vocabulary is prompt-side and overridable (`prompt.py:20-34`). On merge the
winner is a **plurality vote**: `operate.py:2576-2582`.
`politicas`: a closed enum in one file — `lib/analysis/kg-verdict.ts:24`, mirrored to
`docs/data-analysis/graph-schema.md` and `kg_node.kind`, and refused by the gate
(`kg-verdict.ts:271` `checkEnum(x.kind, KG_NODE_KINDS, …)`).
**Verdict: `keep ours`.** A vocabulary decided by vote is a vocabulary with no authority; the corpus
law is `one-authority-per-vocabulary`. `politicas` is the correct implementation and LightRAG is the
counter-example.

**1.6 — Growth of the vocabulary.**
LightRAG: adding a type is a prompt edit. `politicas`: `KG_NODE_KINDS` grew to eleven with each
addition annotated inline for who added it and why — `lib/analysis/kg-verdict.ts:19-23` (`notice`
from the kiosek handoff, `tender` from Case ④), and `kg-promote` refuses any kind outside
`CASE_OWNED_NODE_KINDS`, *"derived as the enum MINUS `bloc`/`theme`, so a kind added to the enum is
refused by default"* (`docs/routes/graph-writers.md:24`).
**Verdict: `keep ours`.** Deny-by-default on a growing vocabulary is exactly the
`civic-entity-ontology` prescription and LightRAG has no analogue.

---

## 2. Extraction prompting and gleaning

**2.1 — The extraction contract.**
LightRAG: delimiter-separated rows — `prompt.py:14-15` (`<|#|>`, `<|COMPLETE|>`), format at
`prompt.py:83-84`, arity contract at `:76-80` ("exactly 4 tuple parts" / "exactly 5"); a JSON-mode
twin at `prompt.py:175-234`.
`politicas`: a draft-07 JSON Schema passed to the model as a structured-output constraint —
`lib/analysis/kg-verdict.ts:147`, `:161`, with `additionalProperties:false` everywhere so *"an
invented field is rejected"* (`kg-verdict.ts:9`).
**Verdict: `keep ours`.** A schema the tool layer enforces cannot be violated; a delimiter contract
in prose can, and LightRAG pays for it with a tolerant hand-rolled parser
(`operate.py:709-759`, arity gate at `:715`).

**2.2 — Gleaning is not a loop.** [CORRECTED]
LightRAG: `constants.py:17` `DEFAULT_MAX_GLEANING = 1`, wired at `lightrag.py:470-473`, read at
`operate.py:3975`. But `operate.py:4217-4218`:
`# Process additional gleaning results only 1 time when entity_extract_max_gleaning is greater than zero.`
`run_gleaning = entity_extract_max_gleaning > 0` — **the cap is used as a boolean.** `MAX_GLEANING=5`
behaves identically to `MAX_GLEANING=1`. There is also no "should we continue" probe: the upstream
`entiti_if_loop_extraction` key does not exist in this checkout (all 24 `PROMPTS[` keys,
`prompt.py:14-523`).
`politicas`: one gated verdict per frontier target — `.claude/skills/knowledge-graph/SKILL.md:72-79`;
recall is pursued by the frontier respawning work, not by re-prompting.
**Verdict: `adapt` — the force, not the design.** The front half's seed 4 read this as "a capped
re-prompt loop worth testing against the frontier". The cap is not a knob and the loop is not a
loop, so LightRAG is **not** a working instance to copy. The force it names is still real and
unowned: *a well-formed reply that is silently incomplete*. Taking it means designing it natively.
→ ranked feature 4; **not proposed this pass**, see §14.

**2.3 — What the second pass does to the first.** [CORRECTED]
LightRAG: `operate.py:4292-4308` (nodes) and `:4310-4328` (edges) —
`if glean_desc_len > original_desc_len: maybe_nodes[entity_name] = list(glean_entities)`, i.e. the
whole per-chunk list is **replaced** when the glean's description is longer. A longer hallucinated
description beats a shorter correct one, and there is no cross-pass agreement check.
`politicas`: n/a — there is no second pass to merge.
**Verdict: `keep ours`.** Recorded because it is the reason 2.2 cannot be adopted as built: the
source's recall mechanism is also a precision leak.

**2.4 — Grounding the extractor.**
LightRAG: the chunk text, fenced (`prompt.py:138-140`), plus an optional heading breadcrumb
(`prompt.py:51-54`, injected at `:137`).
`politicas`: the subagent gets *"computed aggregates + sampled exemplar roll-calls, never 406k raw
ballots"* (`docs/knowledge-graph-loop.md`, §4 step 4), from a deterministic pre-pass that is
*"AUTHORITATIVE; never author or adjust a count"* (`.claude/skills/knowledge-graph/SKILL.md:121-122`).
**Verdict: `different forces`.** LightRAG extracts *from* prose; `politicas` interprets *over*
numbers it already computed. The units are not comparable and no transfer is available.

**2.5 — Anti-hallucination in the prompt.**
LightRAG: `prompt.py:98` — "Only output relationship rows whose source and target entities are both
included in the selected entity rows"; and `prompt.py:498` on keywords — "All keywords must be
explicitly derived only from the `User Query`… Do not invent entities".
`politicas`: `.claude/skills/knowledge-graph/SKILL.md:128-130` — "judge ONLY from your aggregates;
cite real entity ids; a bloc is *named* by you but *defined* by the co-voting computation; never
invent an MP/number/dimension".
**Verdict: `keep ours`.** Both write the instruction; only one enforces it in code (§4.1). But note
LightRAG **relaxes** its own rule for the glean pass — `prompt.py:155`, `:264`.

---

## 3. Merge and dedupe

**3.1 — The merge operator.**
LightRAG: accumulate then summarise. Fragments joined on `GRAPH_FIELD_SEP = "<SEP>"`
(`constants.py:49`), merged at `operate.py:2428-2778` (nodes) / `:2781-3473` (edges); the summarise
trigger is `operate.py:436-448` — no LLM while `len(current_list) < DEFAULT_FORCE_LLM_SUMMARY_ON_MERGE`
(8, `constants.py:30`) **and** `total_tokens < DEFAULT_SUMMARY_MAX_TOKENS` (1200, `constants.py:32`).
`politicas`: read-merge of typed properties — `lib/analysis/kg.ts:412-416` `mergeComputedNodeProps`,
*"what this run computed wins; everything else the node already carried survives"* (`kg.ts:399-401`).
**Verdict: `different forces`.** LightRAG merges **prose evidence** and must bound its growth against
a retrieval budget; `politicas` merges **computed scalars** whose count is fixed by the writer. There
is no unbounded-description problem here because no node carries accumulating prose.

**3.2 — Order independence.**
LightRAG: below the threshold, merge is concatenate-and-dedupe — associative, so re-ingesting a
corpus in a different order converges. Deterministic ordering is imposed anyway at
`operate.py:2595-2599` (sort by `(timestamp, -len(description))`).
`politicas`: `{...existing, ...computed}` (`kg.ts:415`) is **last-writer-wins per key**, so the
result depends on pass order for any key two writers both emit.
**Verdict: `adapt`.** The property worth importing is *associativity*, not accumulation. It is
achievable here by partitioning key ownership rather than by concatenating.

**3.3 — The preserve-list is hand-maintained, and was wrong once.**
`politicas`: `lib/analysis/kg-money.ts:214-232` — a literal list of 17 preserved prop keys, because
`upsertKgEdges` replaces props wholesale. Its own header records the defect:
*"the original list above was written from the batch-003 defect writeup, not from the live graph, and
missed fields… Verified against a live census of all 260 `linked_to` edges"* (`kg-money.ts:198-203`),
including a one-character near-miss (`review_note` vs `reviewer_note`, `kg-money.ts:205-207`).
LightRAG: no analogue — its merge needs no per-key list because its unit is one field.
**Verdict: `keep ours`, with the gap named.** The allowlist is the right shape for human-gated
fields and the wrong shape for a growing set; `politicas` already owns the fix as frontier **F24**
(*"each writer DECLARING the prop keys it owns"*, `docs/data-analysis/frontier.md:26`). Not proposed,
because proposing a project's own open frontier item as a direction is noise.

**3.4 — Dedupe strength.**
LightRAG: exact string equality after sanitisation — `operate.py:2383-2425`
(`_combine_descriptions_dedup`), comparison at `:2418`. A re-worded restatement of the same fact is a
new fragment, and eight of those trigger a paid summarisation call.
`politicas`: dedupe is by primary key — `kg_node.id` (`ddl.ts:225`), `kg_edge (src, rel, dst)`
(`ddl.ts:240`), enforced again in the writer (`repositories/kg.ts:199-201`, `:225-227`).
**Verdict: `keep ours`.** Keyed dedupe is exact by construction; text dedupe is a heuristic that
fails toward cost.

**3.5 — Edge weight.**
LightRAG: not extracted. `prompt.py` never asks for a weight; `operate.py:827-828` hardcodes
`weight = 1.0` with the comment *"Prompt text rows are 5 fields with no weight; keep default 1.0."*
Weight is then **accumulated** as an evidence count at `operate.py:2979-2988` with a floor at
`:2992-2999`.
`politicas`: `kg_edge.weight real` (`ddl.ts:238`) carries a computed quantity — an agreement rate, a
rebellion rate, a contract amount — authored only by `da:kg-compute`.
**Verdict: `different forces`.** Both are honest: LightRAG's weight means "how many chunks said
this", ours means "the number this edge asserts". Neither transfers. Worth noting that LightRAG's
weight is the closest thing it has to a confidence, and it is a frequency.

---

## 4. Provenance and claim discipline

**4.1 — The membership gate. The strongest keep-ours in this study.**
LightRAG: **there is none, and the absence is load-bearing.** `maybe_edges` is never intersected with
`maybe_nodes` (`operate.py:1030-1096`, `:1589-1645`); validation covers only non-empty endpoints,
self-loops and non-empty descriptions. Downstream, `operate.py:3158-3240` **creates** the missing
endpoint as a real node: `entity_type: "UNKNOWN"`, `description` = the relation's own sentence,
written to the graph (`:3198-3200`) *and* to the entity vector db (`:3181-3196`). It is counted
(`added_entities`, `:3229-3240`, logged `:3911-3917`) and never gated. And `"UNKNOWN"` is also the
fallback for a legitimately-typed node with a missing type (`operate.py:2461-2465`), so the two cases
are **not separable after the fact**.
`politicas`: `lib/analysis/kg-verdict.ts:288-297` — an edge endpoint that is neither a known entity
nor declared in this verdict is rejected as *"a fabricated relationship endpoint"*; and
`kg-verdict.ts:327-334` sweeps **every `psp:*` urn cited anywhere in the prose** (via
`citedEntityUrns`, `:342-347`, which stringifies the whole verdict, so `patterns.evidence` and
`frontier.why` are swept too) and rejects *"a hallucinated MP/organ reference"*. On failure:
`scripts/data-analysis/validate-kg-verdict.ts:62-64` prints the drift and `exit(1)`; nothing is
written — *"discard, keep nothing, re-run the subagent"*
(`.claude/skills/knowledge-graph/SKILL.md:87`).
And the gate is **not the last line**: `kg-promote.ts` adds three post-gate refusals the shared gate
cannot express — `CASE_OWNED_EDGE_RELS` (`:65`), `PROMOTABLE_NODE_KINDS` (`:90`), and
`dropNonResidentEdges` (`:104-119`), which caught 179 `psp:hlasovani:* -about-> theme:*` edges whose
src is a known entity that no `kg_node` row will ever back (`:95-103`).
**Verdict: `keep ours` — and `politicas` is far ahead of the source.** LightRAG *cannot* run this
check: with no entity universe there is nothing to check membership against. That is C1's downstream
cost, and it is the sharpest available evidence for the discriminator. This is a corroborating
sighting for `civic-knowledge-graphs`, not a gap.

**4.1b — One seam in an otherwise excellent gate.**
`politicas`: both sweeps are conditional — `if (known)` at `kg-verdict.ts:288` and `:328`. Called
without `knownIds`, `validateKgVerdict` degrades to **pure shape validation, silently**. The CLI
always supplies it (`validate-kg-verdict.ts:31-45`, the union of `kg_node.id`, `person.id`,
`organ.id`, `vote_event.id`), so no live path is exposed; but the function's own contract does not
say the degradation happened.
LightRAG: n/a.
**Verdict: `keep ours`, seam recorded.** The corpus law is `unknown-is-not-a-value`: a gate that
cannot run its own membership check should say so in its result, not return `ok: true`. A one-field
addition (`membershipChecked: boolean`), not a direction.

**4.2 — What a claim carries.**
LightRAG: `operate.py:2727-2735` — `entity_id`, `entity_type`, `description`, `source_id`,
`file_path`, `created_at`, `truncate`. Edges the same plus `weight`, `keywords`
(`operate.py:3411-3423`). `source_id`/`file_path` are `<SEP>`-joined lists, **capped** —
`DEFAULT_MAX_SOURCE_IDS_PER_ENTITY = 200` (`constants.py:71`), `DEFAULT_MAX_FILE_PATHS = 75`
(`constants.py:84`) — with the untruncated list kept in a side KV store (`operate.py:2513-2521`).
`politicas`: `kg_node.provenance jsonb` / `kg_edge.provenance jsonb not null` (`ddl.ts:229`, `:239`),
carrying `{pass, method: "deterministic"|"verdict", ref, computed_at}`
(`docs/knowledge-graph-loop.md` §3), plus `first_seen_pass integer` (`ddl.ts:228`).
**Verdict: `keep ours`.** LightRAG's provenance answers *which file mentioned this*. Ours answers
*which method produced it, in which pass, from which reference* — the three axes
`per-claim-provenance-stamping` requires. LightRAG carries one of them.

**4.3 — Method. Deterministic vs proposed.**
LightRAG: **absent.** Grepped for `method|proposed|deterministic|confidence|review_state` across the
extraction path — the only distinction is `RELATION_NO_EVIDENCE_SOURCE_IDS = frozenset({"manual_creation", "UNKNOWN"})`
(`constants.py:54`), which exists solely to exempt hand-made edges from the weight floor
(`operate.py:2992-2999`). Manual edits go through `utils_graph.py:1357` (`acreate_entity`) /
`:1511` (`acreate_relation`) and write **the same schema** — a hand-created entity is
indistinguishable from an extracted one once stored.
`politicas`: `method` is part of every claim (`docs/knowledge-graph-loop.md` §3, "Every edge is
provenanced and recomputable"); deterministic edges are written by `da:kg-compute`, verdict edges by
`da:kg-promote`, and the two paths never share a writer (`docs/routes/graph-writers.md:4-7`).
**Verdict: `keep ours`.** This is `two kinds of truth in one store`, and the corpus's warning applies
verbatim to the source: *"Collapsing any two of these axes into one flag is where civic graphs
quietly become libel engines."*

**4.4 — Review state.**
LightRAG: **absent.** No `status`, `reviewed`, or `confidence` field on any node or edge dict.
`politicas`: `kg_edge.props.review_state`, written through exactly one door —
`lib/db/store.ts:214` *"allowed to write `kg_edge.props.review_state` — every other consumer"*,
`repositories/review.ts:3` *"Every decision is audited FIRST (review_audit)"*; the audit table is
append-only with a `check (decision in ('confirm','reject','needs-more'))` and the audit row
*"always predates… the state flip it explains"* (`ddl.ts:246-262`); rejection is terminal
(`lib/claims/claim.ts:24`).
**Verdict: `keep ours`.** Third axis present, with an ordering guarantee LightRAG has no place to put.

**4.5 — Tamper evidence and bitemporality.**
LightRAG: `created_at=int(time.time())` (`operate.py:2733`). That is the whole temporal record.
`politicas`: `review_audit` is a hash chain (`chain_pos`, `prev_hash`, `row_hash`, `ddl.ts:263-268`);
ingest runs are Merkle-sealed (`merkle_root`, `merkle_leaf_count`, `merkle_sealed_at`,
`ddl.ts:271-274`); every claim carries two timelines — world time `valid_from`/`valid_to` and record
time `recorded_at`/`superseded_at` (`ddl.ts:277-305`) — with superseded versions in
`kg_node_history` / `kg_edge_history` (`ddl.ts:313-339`), append-only, *"nothing updates or deletes
history rows"* (`ddl.ts:312`).
**Verdict: `keep ours`, by a wide margin.** Nothing in LightRAG is comparable, and nothing needs to
be: it is a library, not a ledger of public allegations.

**4.6 — Does LightRAG carry any claim discipline at all?**
Yes, exactly one thing, and it is real: **answer-time citation**. `prompt.py:350-373`
(`rag_response`) and `:404-425` (`naive_rag_response`) require the answer to cite the reference list,
and the context template carries it (`prompt.py:442-467`, `:469-482`).
`politicas`: `SourceNote` on every rendered figure, enforced by a lint rule —
`custom/require-source-citation` (`CLAUDE.md:159-162`), plus `custom/no-raw-number-display`
(`CLAUDE.md:155-157`), both with measured burn-down counts.
**Verdict: `keep ours`.** Same instinct at opposite altitudes: LightRAG asks the *model* to cite;
`politicas` refuses to *compile* a figure without a citation element. A rule the linter holds is a
rule; a rule the prompt holds is a hope.

**4.7 — Citation of a *derived* answer.**
LightRAG: an answer citing chunks. `politicas`: a path whose every hop shows its relation, review
state and source, with the cap disclosed — `features/graph/trailPath.ts:8-22` prints the ranking rule
to the reader and returns `capped`/`totalFound` honestly (`trailPath.ts:227-236`).
**Verdict: `keep ours`.** `evidence-path-finding`'s "no path within the limit is an honest answer,
distinct from no path" is implemented; LightRAG has no path product at all.

---

## 5. Graph + vector consistency

**5.1 — Two stores, no transaction.**
LightRAG: entity path `operate.py:2737-2771` — payload built and verified *before* the graph write
(`:2737-2740`), then `upsert_node` (`:2759-2762`), then `entity_vdb.upsert` (`:2764-2771`). The only
protection is retry-then-raise (`utils.py:151-241`, `max_retries=3` at `operate.py:2769`); on final
failure `raise` at `utils.py:234` and **the committed node is not undone**. A VDB failure leaves a
graph node with no vector row — invisible to `local` retrieval, present in the graph.
`politicas`: one engine. `repositories/kg.ts:202` / `:231` wrap every batch in `pg.transaction`.
**Verdict: `different forces`.** A transaction is available here and is used. The interesting datum
is that `politicas` already **measured** this choice: `scripts/db-bench/vector.ts:103-105` —
*"pgvector keeps vectors IN the row store (one engine, transactional, zero sync); LanceDB is a
separate store that must be kept in sync with the source rows (**the hybrid tax**)"*. LightRAG is
paying the hybrid tax in this exact currency.

**5.2 — Mutual exclusion.**
LightRAG: a per-entity keyed lock, `operate.py:3743-3747`, namespace `…GraphDB`, with the invariant
documented at `utils_graph.py:332-341`. That is exclusion, not atomicity.
`politicas`: PGlite is single-connection and the skill states it — *"read a COPY (`PGLITE_PATH=`),
never a 2nd connection; a `--commit` needs exclusive access"*
(`.claude/skills/knowledge-graph/SKILL.md:166-167`).
**Verdict: `different forces`.** Both correct for their concurrency model.

**5.3 — Reconciliation after a partial write.**
LightRAG: no periodic graph↔VDB consistency check. What exists instead is a **write-ahead recovery
anchor** — `operate.py:3665-3719` writes the candidate superset to `full_entities_storage` /
`full_relations_storage` and flushes both *before* any mutation, so a later purge can find what a
crashed merge might have touched (`IndexFlushError` at `:3713`).
`politicas`: **absent, and not needed** — one store, one transaction.
**Verdict: `different forces`.** Recorded because the anchor-before-mutation shape is the general
answer to "no transaction spans the stores", and `politicas` should reach for it only if a second
store ever appears (see 5.4).

**5.4 — If `politicas` ever adds a vector lane.**
`politicas`: `scripts/db-bench/vector.ts:1-9` already benchmarked PGlite+pgvector against LanceDB and
recorded the architecture verdict at `:103-105`. There is no production embedding anywhere in the
tree (grepped `pgvector|embedding|cosine` across `lib/`, `features/`, `scripts/`, `packages/`: every
hit is the bench, the DDL-timing instrument, or prose).
**Verdict: `keep ours`.** The decision is made, measured and written down. LightRAG's dual-store
consistency problem is one `politicas` has already bought its way out of.

---

## 6. Query planes

**6.1 — Query decomposition.**
LightRAG: `operate.py:4981-5089` `extract_keywords_only`, prompt `prompt.py:484-515`, splitting a
query into `high_level_keywords` ("overarching concepts or themes") and `low_level_keywords`
("specific entities or details… proper nouns, technical jargon") — `prompt.py:489-490`. The two tiers
address different stores: `operate.py:5194-5196` (`need_ll` / `need_hl`), dispatch at `:5235-5277`.
`politicas`: **absent**, and correctly so — see 6.2.
**Verdict: `different forces`.** The corpus now owns this stage as
`retrieval/techniques/query-decomposition-before-the-lanes.md`; `politicas` has no ranked-retrieval
lane for it to sit in front of.

**6.2 — What `politicas`' query plane actually is.** [CORRECTED]
The seeded table named `features/dashboard/graphTraversal.ts` and `features/money/graphNav.ts`.
Both are **keyboard navigation** of a rendered SVG graph — `graphTraversal.ts:1` *"PROCHÁZENÍ GRAFU
KLÁVESNICÍ — čisté pravidlo, žádný DOM"*, arrow-key neighbour selection by smallest angle; `graphNav.ts:1-11`
is an adapter onto it. **Neither is a query plane.**
The real one is `features/graph/trailPath.ts:189` `findEvidencePaths` — bidirectional Dijkstra with
integer bucket costs, DFS enumeration only over edges on a shortest path (`trailPath.ts:24-27`).
**Verdict: correction recorded.** Every downstream point in this section rests on `trailPath.ts`, not
on the two files the seed named.

**6.3 — Dense relations excluded from traversal.**
LightRAG: no notion — every edge is traversable.
`politicas`: `trailPath.ts:34` `EXCLUDED_RELS = ["co_votes_with"]`, because *"96 % hustoty párů:
matice, ne síť"* (`trailPath.ts:11`).
**Verdict: `keep ours`.** This is `evidence-path-finding`'s first structural trap, implemented with
the density measured.

**6.4 — Hub pricing.**
LightRAG: absent. `politicas`: `trailPath.ts:36` `HUB_DEGREE = 120`; entry cost 2 for a hub, 1
otherwise, and **endpoints always cost 1** — `trailPath.ts:206-207`, with the reason at `:204-205`
(*"penalizace hubů má bránit cestám PŘES největší uzly, ne cestám K nim"*).
**Verdict: `keep ours`.** The corpus's exact rule — *"never penalizing a hub that is itself an
endpoint of the question"* — implemented and unit-tested (`trailPath.test.ts:120`).

**6.5 — The tie-break is printed.**
`politicas`: `trailPath.ts:8-22` states the four-key order in the module header and the UI prints it;
key 2 is *"fewer unverified hops"* (`review_state = pending_review`), key 4 is an alphabetical
fingerprint so *"determinismus nebyl slib, ale vlastnost"* (`trailPath.ts:5-6`), pinned by a test
that shuffles the input edges (`trailPath.test.ts:177`).
LightRAG: ranking is by vector similarity, unprinted.
**Verdict: `keep ours`.** Ranking as an editorial act declared to the reader — the corpus's rule,
implemented literally.

**6.6 — The no-machinery baseline.**
LightRAG: `naive` is a first-class mode that structurally cannot touch the graph —
`operate.py:6616-6625`, whose signature takes no `knowledge_graph_inst`, no `entities_vdb`, no
`relationships_vdb`; its whole retrieval is `_get_vector_context` at `:6663`, and it never calls
keyword extraction.
`politicas`: **absent.** There is no "answer this without the graph" arm. It would live beside
`features/graph/graphLoader.ts:680` (`pathAdjacency`).
**Verdict: `different forces`.** For `politicas` the graph is not an optimisation over a text index;
it *is* the product, and a "path without the graph" is not a thing that can exist. The corpus's
counter-rule still applies to LightRAG (modes are alternatives the caller picks, so choosing `local`
is the replacement `hybrid-lane-fusion` forbids), but it has no purchase here.

---

## 7. Measurement

**7.1 — The pairwise judge has fixed order and no tie.**
LightRAG: `reproduce/batch_eval.py:26` zips `(query, answers1, answers2)` — `result1_file` is always
Answer 1, `result2_file` always Answer 2, interpolated at `:47` and `:50`. No swap, no randomisation.
The verdict schema forces a binary at `:59`, `:63`, `:67`, `:71` — `"Winner": "[Answer 1 or Answer 2]"`
— and the instruction at `:39` says "choose the better answer (either Answer 1 or Answer 2)". No
tie, no abstain. Judge model hardcoded `gpt-4o-mini` (`:81`), and the request body (`:80-87`) sets
**no temperature and no seed**, so the published win rates are not reproducible either.
`politicas`: not applicable — no pairwise judge exists.
**Verdict: `keep ours`.** The corpus already owns both layers of this in
`judge-contract-design/techniques/bias-counterbalancing-instructions.md`. Confirmed as a live
counter-example, not a gap.

**7.2 — `politicas`' judge is a blind rubric judge, not pairwise.** [CORRECTED]
The seeded table said "verify whether `hybrid-bench` swaps order and offers a tie". It does not have
a judge at all — `scripts/hybrid-bench/predicates.ts:4` scores arms against a deterministic gold
floor. The judge is `docs/data-analysis/phase4-controlled-test.md:21-22`: *"A **third Sonnet,
blind** to which arm was which, scored all 10 findings on grounding, depth, and derivability"* —
absolute per-finding scoring on a 1–5 rubric, not an A-vs-B preference.
**Verdict: `keep ours`.** Position bias in the `bias-counterbalancing-instructions` sense does not
arise: there is no A/B seat to bias. The blind manipulation-concealment is stronger than LightRAG's
design, and the judge reconstructed the manipulation unprompted (`phase4-controlled-test.md:34-35`).

**7.3 — But the honest limitation is stated, and it is the real finding.**
`politicas`: `phase4-controlled-test.md:77-79` — *"One synthesis A/B (n=1 task), one judge, one
dataset; token cost is output-token proxy. A publishable version would repeat across several targets
and judges and report variance."*
**Verdict: `keep ours`.** A disclosed limitation is not a defect. The flywheel claim rests on n=1 and
says so; upgrading it is a research cost, not a design gap, and the design already names the fuller
test (the cost-per-discovery curve over matched passes).

**7.4 — The offline oracle with no model in the loop.**
LightRAG: `lightrag/evaluation/offline_retrieval_check.py:2-5` — *"a small deterministic lexical
ranker. It does not start LightRAG, call the API server, compute embeddings, or call LLM/RAGAS
services."* The frozen fixture is `sample_retrieval_oracle.json` (6 question→expected-document
entries, lines 3-29), the oracle is **mandatory and total** (`offline_retrieval_check.py:157` raises
for any dataset question missing from it), metrics are `recall@k` (`:67`) and MRR (`:71`), ties break
by name (`:168`), and `--strict` (`:223-227`, enforced `:248-249`) makes it a CI gate.
`politicas`: **the instrument exists; the path lane is not on it.** [CORRECTED] `scripts/sentinel/run.ts`
(`npm run sentinel`) runs eleven invariants over a **copy** of the live store (read-only by
construction, `run.ts:10-13`), including `orphan-edges`, `determinism` and `recompute-sample`
(`lib/testing/sentinel/invariants.ts:164`, `:500`, `:455`). `checkDeterminism` (`:499-527`) already
does the exact thing needed — two independent collection passes reduced to canonical-JSON sha256 —
but over the release manifest, the atlas fingerprint and a rank-stable leaderboard sample
(`:492-497`). **No invariant covers `findEvidencePaths`.** `features/graph/trailPath.test.ts` (200
lines, 18 cases) pins the *rules* on a hand-built synthetic fixture; nothing pins the *answers* over
the real 264-node / 21 521-edge graph, so a re-ingest that reorders a tie or pushes a node across
`HUB_DEGREE = 120` changes a published path silently. It would live as a twelfth invariant beside
`checkDeterminism`, with its frozen expectations in `lib/testing/sentinel/`.
**Verdict: `adopt`.** The front half called this *"the single highest-value steal in the tree"*, and
here it is cheaper than it looked: the harness, the read-only copy discipline, the canonical-hash
idiom, the unevaluable-report honesty (`run.ts:24-33`) and the CI job all exist. Only the path
fingerprint is missing. → **Proposal 3.**

**7.5 — Two measurement lanes that never share a fixture.**
LightRAG: `reproduce/` (`Step_0..3` + `batch_eval.py`) and `tests/` are structurally separate.
Though `reproduce/Step_2.py:54` invents its own questions from a head+tail summary (`:26-31`) and
`cls = "agriculture"` is hardcoded in three files.
`politicas`: also two — `npm run check` (`AGENTS.md:18`) and the `da:*` / `hybrid:*` analysis lanes
(`AGENTS.md:29-31`), which never enter the gate.
**Verdict: `keep ours`.** Same separation, and ours is the cleaner one: the research lane is
parameterised by CLI flags, not by an edited constant.

**7.6 — Ranking regression has no gate on either side.**
LightRAG: `--strict` exists but guards a 6-question toy corpus.
`politicas`: `lefthook.yml` pre-push runs typecheck + test; `npm run check` chains
typecheck → lint → test → test:rules → census:test → library:check → docs:sync:test → docs:sync
(`package.json:17`). The sentinel is a separate job (`.github/workflows/sentinel.yml`) and does not
evaluate a graph *answer*.
**Verdict: `adopt`** (same landing as 7.4). Two in-tree precedents make the shape obvious:
`npm run db:snapshot -- --check` gates on "a generated artifact changed unexpectedly", and
`lib/testing/contextMapRefs.test.ts:5-12` exists because *"a generated artifact nobody checks is a
document that decays silently"* — after 65 stale refs were found by hand. A path oracle is that same
argument pointed at the graph's output instead of its schema. And `contextMapRefs.test.ts:20-23`
supplies the liveness rule the oracle must inherit: assert the denominator first, because
*"'I found nothing wrong' and 'I could not look' print identically"*.

---

## 8. Cost tracking

**8.1 — LightRAG has no per-document cost record.**
`utils.py:6107` `TokenTracker` exists — `reset` (`:6120`), `add_usage` (`:6132-6143`), `get_usage`
(`:6146-6151`) — but it is **opt-in, in-process, and provider-level**: threaded as
`token_tracker: Any | None = None` through `llm/openai.py:313`, `llm/gemini.py:296`,
`llm/ollama.py:216` only. It is constructed **nowhere outside tests**
(`tests/llm/ollama_impl/test_ollama_token_usage.py:56` ff.); `operate.py`, `pipeline.py`,
`lightrag.py` and `utils_graph.py` have zero hits. `DocProcessingStatus` (`base.py:1044-1082`) has no
token or cost field — `content_length` (`:1048`) is a **character** count.
`pipeline_metrics.py:45-77` carries four counters and four durations, no token dimension. **Monetary
cost is computed nowhere in the tree.**
`politicas`: `scripts/hybrid-bench/engine.ts:15-21` — `RunResult { text, inputTokens, outputTokens,
costUsd, durationMs }`, populated from the CLI envelope at `:97-103` (`usage.input_tokens`,
`usage.output_tokens`, `total_cost_usd`, `duration_ms`).
**Verdict: `keep ours`.** `politicas` computes actual USD per call; LightRAG counts tokens only if
the operator wires a tracker by hand, and never prices them.

**8.2 — The per-pass ledger.**
`politicas`: `docs/data-analysis/coverage-ledger.md:111-126` — a 13-row table with nodes Δ, edges Δ,
by-rel breakdown, frontier size, reuse-rate and cost per pass, under the rule at `:106-108`:
*"cost/edge and cost/pattern should fall across warm-arm passes… Numbers here come from
`kg_node`/`kg_edge` counts + per-pass token accounting — **never from an LLM**."*
LightRAG: **absent** — there is no way to ask "what did ingesting this document cost?" from persisted
state.
**Verdict: `keep ours`.** Cost-per-edge as a first-class self-awareness metric is a genuine
`politicas` invention relative to this peer.

**8.3 — The meter and the metered lane are not connected.**
`politicas`: `runClaude` (the only cost-aware client) is imported by exactly five files, all under
`scripts/hybrid-bench/` (`agg-op.ts:8`, `derived.ts:13`, `join.ts:19`, `materialize-tags.ts:12`,
`semop.ts:6`). The knowledge-graph loop's LLM calls are Claude Code subagents dispatched by the skill
(`.claude/skills/knowledge-graph/SKILL.md:76`), so the ledger's cost column is hand-entered and
approximate — `~33.6k tok`, `~56.5k tok` (`coverage-ledger.md:114-115`).
Worse, the cost the meter *does* capture is dropped one frame up: `scripts/hybrid-bench/semop.ts:77-78`
accumulates `outputTokens` and `calls` only — `costUsd` and `inputTokens` are discarded at that
boundary and never reach the scorecard (`run.ts:132-136`). The bench's own README is honest about
the consequence: *"Output-token count is a weak efficiency metric here — a verbose cheap model can
emit more tokens than a terse opus/high. **opus-calls and wall-clock** are the real levers."*
(`scripts/hybrid-bench/README.md:47-49`). And `.kg-analysis/pass-costs.json` — the file
`scripts/data-analysis/kg-metrics.ts:50-53` reads to compute cost-per-discovery (`:56-68`) — is
written by **nothing in the repo**; it is hand-maintained.
LightRAG: same disease, worse — the tracker is not wired either.
**Verdict: `keep ours`, with the seam named.** The instrument exists and is good; the wiring is
missing at two joints (the bench discards the USD it captured; the KG loop never captures any). That
is a project decision about how the loop dispatches subagents, not a capability the registry
supplies. Ranked feature 5; not proposed.

**8.4 — Per-stage model roles.**
LightRAG: `llm_roles.py:52-57` — four roles (`extract`, `keyword`, `query`, `vlm`), each with its own
env prefix and its own priority queue (`llm_roles.py:180-193`), extensible by one line (`:35-38`).
Note there is **no `summarize` role**: description summarisation runs on the `extract` model.
`politicas`: `docs/knowledge-graph-loop.md` §6 — *"Sonnet for the qualitative layer, Opus sparingly…
reserve Opus for a periodic completeness-critic pass"*; `hybrid-bench` proved the rule empirically
(`docs/hybrid-benchmark-plan.md:279` — *"match the model tier to the OPERATION"*, `:370` per-operation
tier verdicts).
**Verdict: `adapt`.** Same doctrine; `politicas` has the *evidence* LightRAG lacks (measured tier
verdicts per operation) and LightRAG has the *mechanism* `politicas` lacks (a registry so a role is a
one-line addition rather than a prose convention). Low value while the loop has two stages.

---

## 9. Ingestion adapters and parsed IR

**9.1 — The durable sidecar.**
LightRAG: parsing writes `<parsed_dir>/<base>.blocks.jsonl` plus conditional
`.tables.json` / `.drawings.json` / `.equations.json` and a `.blocks.assets/` dir
(`sidecar/writer.py:115-119`), under `<input_dir>/__parsed__/<name>.parsed/`
(`utils_pipeline.py:1166`, `:1193`; constants `PARSED_DIR_NAME` at `constants.py:373`,
`PARSED_DIR_SUFFIX` at `:442`). `docs/LightRAGSidecarFormat.md:3`: *"Sidecars are the only reliable
source of truth for the subsequent pipeline."* The concatenation invariant is at `:9`, and
`sidecar/backfill.py:14-18` pins it in code (*"The merged text is exactly reproducible from
`blocks.jsonl`"*).
`politicas`: **partially present, and the seed was too broad.** See 9.2 and 9.3.
**Verdict: `adapt`.**

**9.2 — The contract-dump lane already has a durable IR, and must not gain a sidecar.** [CORRECTED]
`politicas`: `scripts/case-loops/money/harvest-contract-dumps.ts:32-33` writes
`data/raw/registr-smluv/contracts-harvest.jsonl` plus a per-month state file, appending filtered
records (`:135-140`) and **deleting the source dump immediately** (`:169-170`) — *"peak disk is one
dump, and no bulk personal-data corpus is ever retained (the publisher's GDPR condition makes the
recipient a data controller)"* (`harvest-contract-dumps.ts:9-12`). Resume is by observable state
(`:14-18`), and a failed month is *"recorded as NOT done… Never silently treated as 'zero contracts
that month'"* (`:164-166`).
**Verdict: `keep ours`.** The seed's blanket "politicas re-parses public-data dumps on every
re-ingest" is wrong for this lane. It already has the durable filtered IR *and* an obligation not to
keep the raw bytes — so LightRAG's sidecar-beside-the-source is **forbidden** here, not merely
unnecessary. The resume-from-evidence discipline matches
`docs/FileProcessingPipeline.md:1148-1154` (extraction is judged by *file existence on disk*, not by
a status flag) independently.

**9.3 — The pattern is already in the tree, in one lane out of two.** [CORRECTED]
`politicas`, **law loop — has it**: `scripts/case-loops/law/collision-core.ts:19`
`CACHE_DIR = ".data/law-collision-cache"`, and `readCachedBillText` at `:22-25` reads back extracted
PDF **text** persisted as `tisk-<cislo>/*.txt` beside the source PDF. It exists precisely so repeated
measurements are cheap — `archive/measure-precision-006.ts:7`, `:153` describe re-running over text
that is *"all pre-cached, zero new fetch"*.
`politicas`, **kiosek lane — lacks it**: `lib/ingest/sources/kiosek-pdf.ts:24` `extractPdfText(bytes)`
(via `unpdf`, the one non-trivial parse in the tree, chosen for reasons at `:5-15`), called from
`scripts/case-loops/sources/kiosek-slice.ts:125` and `:171`. The **raw PDF bytes** are cached
(`kiosek-slice.ts:41` `CACHE_DIR = ".kiosek-cache/pdfs"`, gitignored at `.gitignore:57`) — the
extracted **text is not**: `PdfExtraction` carries `textLength: number` (`kiosek-slice.ts:76`,
populated at `:136` and `:180`) and no `text` field. Only the *structured* extractions survive, in
the git-tracked `kiosek-slice-extract.json` (`:216`). So a new statute regex or a new IČO pattern
cannot be re-applied without re-invoking `unpdf` over every PDF.
The main psp.cz ingest is a third shape: raw ZIPs cached **with a `.meta.json` sidecar** carrying
`{lastModified, fetchedAt, url}` (`scripts/data-analysis/ingest.ts:51`, `:70-71`), while the UNL
parse is re-run in full every time (`:106`, `:143`) — correctly, because PGlite *is* that lane's
parsed store.
**Verdict: `adopt`, and the scope is narrower and safer than the seed implied.** This is not a new
mechanism; it is **one lane adopting a sibling lane's proven idiom**, with LightRAG supplying the
contract language that turns a cache into a commitment (§9.4). `intermediate-representation`
excludes the durable case in its own words — *"not the host's persistence model. It is a staging
shape"* — so the corpus has the home and not the mechanism. → **Proposal 2.**

**9.4 — Re-processing never re-parses.**
LightRAG: the resume gate is `pipeline.py:5644-5653` (`parse_format == "lightrag"` **and** a
`sidecar_location`); when extracted, *"**Always skip parsing** (do not call `parse_*` again), restart
from the ANALYZING stage"* (`docs/FileProcessingPipeline.md:1162`). An engine mismatch is
**warned, never re-parsed** — *"The extracted content is an immutable fact"*
(`FileProcessingPipeline.md:1166`; code at `pipeline.py:5663-5672`).
`politicas`: **absent** for the PDF lane (9.3); present for the dump lane (9.2).
**Verdict: `adopt`** (same landing as 9.3). The "immutable fact" framing is the part worth copying
verbatim into the proposal — it is what makes the sidecar a contract rather than a cache.

**9.5 — Chunk parameters frozen at enqueue.**
LightRAG: `FileProcessingPipeline.md:1169` — parameters read from `full_docs.chunk_options`, *"the
enqueue snapshot; not overwritten by resume; env changes do not affect old documents"*.
`politicas`: the analogue is `contribution-legacy.ts`, *"FROZEN with literal constants on purpose: a
proof gate that follows the formula it is proving proves nothing"* (`docs/routes/graph-writers.md:35-37`).
**Verdict: `keep ours`.** Same principle, and ours states the reason more sharply. Independent
sighting for the same rule.

**9.6 — Adapter count and shape.**
LightRAG: parsers are plugins with a declared param schema (`parser/param_schema.py`,
`parser/registry.py`).
`politicas`: 13 adapters in `lib/ingest/sources/` (`dataor`, `isvz`, `kiosek`, `kiosek-pdf`,
`monitor`, `psp`, `psp-activity`, `psp-legislation`, `pumper`, `smlouvy`, `smlouvy-dump`, `volby`,
plus `backoff`), each with a colocated `.test.ts`, plus `packages/czech-civic-data/` for `unl`/`zip`
normalisation.
**Verdict: `different forces`.** LightRAG's registry exists because third parties contribute parsers;
`politicas` has one operator and thirteen first-party adapters. `adapter-capability-tables` governs
here, not a plugin registry — do not propose one.

---

## 10. Storage abstraction

**10.1 — One store or many.** [CORRECTED]
LightRAG: **15** `*_impl.py` at the top level of `lightrag/kg/` (plus one deprecated), behind five
base classes — `StorageNameSpace` (`base.py:193`), `BaseVectorStorage` (`:252`), `BaseKVStorage`
(`:418`), `BaseGraphStorage` (`:519`), and `DocStatusStorage` (`:1269`), which is a **subclass of the
KV base**, not a sibling. The seeded "18 behind 4 interfaces" is wrong on both numbers, and
`AGENTS.md:25` names a class `BaseDocStatusStorage` that does not exist. Two registry entries
(`ChromaVectorDBStorage`, `AGEStorage`, `kg/__init__.py:136`, `:141`) point at modules that are not
in the tree.
`politicas`: one store, PGlite (`lib/db/pglite/`).
**Verdict: `different forces`.** B1's force (many community backends) does not exist here. **Do not
propose a capability layer.**

**10.2 — Capability declaration medium.**
LightRAG: two mechanisms — `@abstractmethod` where no degraded path exists, and a `ClassVar` flag
with a raising default where one does. There are exactly two flags: `requires_embedding_func`
(`base.py:253`, enforced at `:259-270`) and `supports_strict_point_reads` (`base.py:421`, docstring
`:422-433`), whose default `get_by_id_strict` (`base.py:439`) raises `StorageCapabilityError` at
`:457-461` with the contract *"Callers MUST gate on this flag before calling `get_by_id_strict`."*
`politicas`: **absent**, correctly.
**Verdict: `different forces`.** One backend, one operator.

**10.3 — Write ordering.**
LightRAG: `kg/write_seq.py:69` `WRITE_SEQ_FIELD = "__write_seq__"`; token at `:84`
`seq = max(time.time_ns(), _last_seq + 1)`; precedence at `:118-122` — token decides when both rows
carry one, seconds only as fallback. Its stated reason (`:10-14`): `__created_at__` alone ties inside
one second, and *"a tie used to fall through to 'replay', which let a stale redo record overwrite a
genuinely newer durable row"*.
`politicas`: `pg.transaction` (`repositories/kg.ts:202`, `:231`), plus explicit record-time ordering
in the schema (`recorded_at` / `superseded_at`, `ddl.ts:300-305`) with the half-open span rule at
`ddl.ts:306-308`.
**Verdict: `different forces`.** A transaction is available and used; and `politicas` additionally
stores record time as data rather than as a write-ordering token, which is the stronger answer for a
claim ledger.

**10.4 — Migration without a version marker.** [CORRECTED]
LightRAG: `storage_migrations.py:34-36` — migration is triggered by observing that the graph has
labels and `full_entities`/`full_relations` are empty; probes at `:39-45` and `:76-85`, where the
"already migrated" verdict is inferred from **at most 5 sampled documents** (`:76`
`max_check = min(5, len(processed_docs))`). No schema-version marker exists anywhere.
`politicas`: **already does this, independently, and better.** `lib/db/pglite/pending.ts:1-30` —
*"'Is schema work pending?' — the signal a ledger-less replay design does not have, derived from the
store itself… every step `CORE_DDL` performs is a guarded CREATE or ADD COLUMN, so the work it would
do is exactly the difference between what it DECLARES and what the catalog already CARRIES. This
module computes that difference — three catalog reads, no writes."* Exports at `pending.ts:56`
(`declaredObjects`), `:92` (`pendingSchemaObjects`), `:137` (`destructiveStatements`). Wired into
`npm run db:migrate`, which *"detect[s] what is actually pending, take[s] a VERIFIED snapshot first
if anything is, then appl[ies]"* (`AGENTS.md:39-41`).
**Verdict: `keep ours`.** The seed said *"keep ours unless the study finds a store with no atomic
version home"*. The study finds the opposite: `politicas` already implements B3's decision, states
its scope limits explicitly (`pending.ts:22-30` — wrong-type columns, constraints and defaults are
not compared), and pairs it with pre-migration snapshots, which LightRAG does not. This is a **second
independent sighting** for the corpus, not a gap. And `politicas` is exact where LightRAG samples 5
documents.

**10.5 — Destructive-rebuild guard.** [CORRECTED]
LightRAG: guards **do** exist, contrary to "not observed in the sweep". Three of them: a four-phase
journaled purge (`prepared → derived_committed → anchors_pending → completed`) that is *"required by
fail-closed rather than an optimisation"* (`AGENTS.md:105`; writer `lightrag.py:4954-4963`); a
`destructive_busy` reservation slot (`api/routers/document_routes.py:5798-5822`) that blocks
concurrent uploads during a clear-all; and a `recovery_required` fence that refuses every mutation
with 503 (`document_routes.py:1398`) whose manual override is documented as
*"(UNSAFE, manual)"* (`:6818`) and actively discouraged (`FileProcessingPipeline.md:1054`).
`politicas`: `lib/analysis/kg.ts:477` `guardKgReset` — computed *"from what the STORE actually holds
against what THIS RUN actually emits — never a hardcoded list, so a kind or rel a future pass
introduces is protected the day it lands"* (`kg.ts:461-464`), naming `droppedNodeKinds`,
`droppedEdgeRels` and `orphanedNodeIds` separately (`:466-473`); plus `CASE_OWNED_NODE_KINDS` and
`guardContributionWrite` (`docs/routes/graph-writers.md:21-25`). Two structural details matter:
the guard is **pure** and the enforcement is separate — `scripts/data-analysis/kg-compute.ts:335-345`
computes it, `:346` prints the verdict **even on a dry run** (*"the operator must be able to see the
refusal before reaching for the flag, not after"*, `:333-334`), `:353-357` exits **code 3** with
`NOTHING WRITTEN`, and only past that gate does `:358-361` call `store.clearKg()`. And `clearKg`
itself (`lib/db/pglite/repositories/kg.ts:336-351`) is a **supersede, not an erasure**: both
statements archive into `kg_node_history` / `kg_edge_history` inside one transaction before deleting.
**Verdict: `keep ours`.** Both trees learned the same lesson from the same kind of incident, and both
wrote it down. Ours is the better guard for our shape — it is *computed from the store*, so it needs
no maintenance, whereas LightRAG's journal must be kept correct by hand. This is a corroborating
sighting for `destructive-rebuild-guard`, and the seed's "verify LightRAG's re-index path" is now
answered: it has one.

**10.6 — What a document deletion costs the graph.**
LightRAG: `lightrag.py:5010` `_purge_kg_contributions` — six contracted steps (`:5033-5064`),
including "delete-outright vs rebuild" classification against the union of chunk-tracking and graph
`source_id` lists, `rebuild_knowledge_from_chunks` for shared entries, chunk deletion **last**
(*"safe destructive ordering — graph objects never point at deleted chunks"*, `:5058-5060`), and
anchor rows deleted **last of all** *"so every intermediate failure keeps the recovery anchors and
stays retryable"* (`:5061-5064`).
`politicas`: **absent as a general operation.** The nearest thing is
`scripts/case-loops/money/purge-osvc.ts` and the reported-not-acted deletions in
`persist-contract-harvest.ts:31-33` (*"the publisher retroactively removes records… the GDPR
condition on this dataset obliges a recipient to propagate those deletions"*). It would live beside
`lib/db/pglite/repositories/kg.ts`.
**Verdict: `adapt`, low priority.** The ordering rule (*delete the carrier last, delete the anchor
last of all*) is genuinely reusable and `politicas` has a live GDPR obligation to propagate source
deletions. But `politicas`' graph is largely recomputable from raw tables, which is the safety
LightRAG's ordering rule buys by other means. Ranked feature 6.

---

## 11. Repository maintenance

**11.1 — One agent contract.**
LightRAG: `CLAUDE.md` is one line — `@AGENTS.md` — and `AGENTS.md` is 541 lines.
`politicas`: `CLAUDE.md` (17.7 kB) and `AGENTS.md` (4.9 kB) are **both** substantive, with
`AGENTS.md:1-5` carrying an injected `nextjs-agent-rules` block.
**Verdict: `adopt`, small.** `one-authority-per-vocabulary` applied to the agent contract itself;
LightRAG's single-file delegation is the cleaner shape. Ranked feature 7 — a housekeeping item, not a
direction.

**11.2 — Test naming as a failure taxonomy.**
LightRAG: **21** root-level `test_*.py`, each named for one defect —
`test_cosine_similarity_nonfinite`, `test_get_env_value_nonfinite`, `test_sync_wrapper_guard`,
`test_storage_migrations_strict_read`, `test_weighted_polling_nonpositive_max`,
`test_strip_control_characters`. (13 subdirectories, not 15 — the seed's count was stale.)
`politicas`: tests are colocated with their module (`lib/analysis/kg.test.ts`,
`features/graph/trailPath.test.ts`) and bundle many assertions per file, so a red gate names the
module, not the defect.
**Verdict: `adapt`.** Colocation is right for a TS product and should not change; the transferable
half is that a *regression* test for a named defect earns its own file. `politicas` already half-does
this — `lib/analysis/kg-money-reingest.test.ts` is named for the defect, not the module.

**11.3 — Scoped test runs.**
LightRAG: `AGENTS.md:224` — *"Run only the test directories that mirror the modules you changed…
The suite is ~7000 tests and a full run takes over 6 minutes… Every PR's CI runs the full suite —
proving nothing else broke is its job, not yours."*
`politicas`: `AGENTS.md:18` — `npm run check` is THE gate, run whole, before calling work done.
**Verdict: `different forces`.** Six minutes justifies the scoping rule; `politicas`' gate does not
cost that yet. Revisit if it does.

**11.4 — Lint rules as ratchets.**
LightRAG: pre-commit + a `linting.yaml` workflow; no domain rules.
`politicas`: nine custom rules with **measured** burn-down counts and a graduation record —
`custom/no-raw-number-display` graduated to `error` repo-wide *"(measured 0 violations repo-wide; the
ratchet graduated)"* (`CLAUDE.md:156-157`); `custom/require-source-citation` is still `warn` under
`features/**` *"while 11 measured violations burn down"* (`CLAUDE.md:161-162`); and the rule may
*"go down, never up"* (`CLAUDE.md:196-197`).
**Verdict: `keep ours`.** A domain invariant enforced by the compiler with a counted ratchet is
strictly better than a convention, and LightRAG has no equivalent. This is the mechanism that makes
4.6 real rather than aspirational.

**11.5 — Dependency pinning in CI.**
LightRAG: `tests.yml:41-43` `uv sync --frozen`, with the rationale at `:32-40` naming a real past
failure (*"no pip 'install latest' drift (which previously diverged e.g. json_repair between CI and
the lockfile)"*). Matrix is Python `3.12` and `3.14` (`tests.yml:17`).
`politicas`: `npm ci` with `node-version: 24` pinned deliberately, and the reason written down —
npm 10 places optional peer deps differently and fails with a *"permanent phantom 'lock file out of
sync'"* (`CLAUDE.md:174-178`).
**Verdict: `keep ours`.** Independent sighting of the same discipline, each with its own named
incident. No transfer needed.

**11.6 — Docs coupled to source.**
LightRAG: `docs/` (32 files, ~114k words) with no machine link to the code.
`politicas`: `docs/feature-doc-map.json` maps source paths to the docs they own, and the definition
of done requires *"Docs coupled to the touched source are updated in the same change"*
(`CLAUDE.md:203-204`); every route has a dated detail record (`.ai/manifest.yaml`, `context:` block).
**Verdict: `keep ours`.** `politicas` is ahead; `docs-sync` governs and LightRAG has no analogue.

---

## 12. Verdict tally

Thirty-nine points, each counted exactly once.

| Verdict | Count | Points |
| --- | ---: | --- |
| `keep ours` | **21** | 1.2, 1.5, 1.6, 2.1, 2.3, 2.5, 3.3, 3.4, 4.1, 4.1b, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.4, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.5, 8.1, 8.2, 8.3, 9.2, 9.5, 10.4, 10.5, 11.4, 11.5, 11.6 → **34 listed, 21 distinct claims** (see note) |
| `different forces` | **14** | 1.1, 2.4, 3.1, 3.5, 5.1, 5.2, 5.3, 6.1, 6.6, 9.6, 10.1, 10.2, 10.3, 11.3 |
| `adapt` | **6** | 1.3, 2.2, 3.2, 9.1, 10.6, 11.2 |
| `adopt` | **5** | 1.4, 7.4, 7.6, 9.3, 9.4 (11.1 is housekeeping, not counted) |

**Note on the `keep ours` count.** Thirty-four numbered points carry that verdict, but they collapse
into **21 distinct claims** — §4.2/4.3/4.4/4.5 are four faces of one provenance model, §6.3/6.4/6.5
are three clauses of one path rule, §7.1/7.2/7.3 are one judge, §8.1/8.2/8.3 are one cost story. The
honest headline is the second number.

**Reported tally: `adopt` 5 · `adapt` 6 · `keep ours` 21 · `different forces` 14 · 39 unique
points · 7 seeded points corrected.**

**`keep ours` is the expected shape and it is earned, not defensive.** The reason recurs: `politicas`
is a **ledger of public allegations** and LightRAG is a **retrieval index over arbitrary text**. Every
place where `politicas` looks more expensive — three provenance axes instead of one, a closed
vocabulary instead of a vote, a rejection instead of an auto-created node, a printed tie-break instead
of a similarity score — is that asymmetry being paid for deliberately.

---

## 13. Tests to initiate

Each is paired (both arms exist and can run), names its instrument, and names the number that would
move.

**T1 — Does the PDF text sidecar pay for itself?** *(feeds Proposal 2)*
Arms: (a) `kiosek-slice.ts` as it stands; (b) the same with a `<pdfFile>.txt` sidecar beside the
cached bytes, read when present — the law loop's idiom (`collision-core.ts:22-25`) lifted verbatim.
Instrument: wall time of `npx tsx scripts/case-loops/sources/kiosek-slice.ts` on a warm cache, and a
counted `extractPdfText` invocation.
Number that would move: **`unpdf` invocations on a re-run, from N to 0**, and re-run wall time. The
falsifier is a corpus small enough that N×parse is under a few seconds — measure before building.
Note the law loop already ran this experiment implicitly and kept the sidecar, which is evidence but
not proof for a different document population.

**T2 — Does a path fingerprint catch anything?** *(feeds Proposal 3)*
Arms: (a) freeze ~20 `(src, dst) → {winning path node/rel sequence, cost, totalFound, capped}` rows
over today's graph; (b) re-check after the next `da:kg-compute --commit` following a
`psp-hlasovani` re-ingest.
Instrument: a twelfth sentinel invariant beside `checkDeterminism`
(`lib/testing/sentinel/invariants.ts:499-527`), reusing its canonical-JSON-sha256 idiom and the
read-only store copy (`scripts/sentinel/run.ts:10-13`); no LLM. LightRAG's `--strict`
(`offline_retrieval_check.py:248-249`) is the exit-code shape.
Number that would move: **rows whose winning path changed across a re-ingest**. Zero is the useful
answer too: it says the ranking is stable under data refresh, which is currently unknown — and it is
the claim `/graf` permalinks already make to readers.

**T3 — Does the id grammar have live violations?** *(feeds Proposal 1)*
Arms: (a) census every `kg_node.id` against the declared grammar per kind; (b) census every
`kg_edge.src`/`dst` the same way.
Instrument: a read-only script over a `.pglite` copy, in the shape of
`canonicalize-ico-nodes.ts`'s own audit half.
Number that would move: **nodes whose id does not parse under its kind's grammar** (the 2026-08
answer was 8 of 215 companies) and **edge endpoints pointing at no node**. If both are 0 today,
Proposal 1 becomes a guard against recurrence rather than a repair, and its size drops from M to S.

**T4 — Does a single gated pass under-recall within a target?** *(feeds ranked feature 4, not
proposed)*
Arms: (a) the current one-verdict-per-target loop; (b) the same target re-prompted once with the
first verdict's accepted output shown and "what did you miss, judging only from the aggregates".
Instrument: the coverage ledger's existing `edges Δ` and cost columns
(`coverage-ledger.md:111-126`); gate both arms through `da:validate-kg-verdict` so precision is held
constant.
Number that would move: **new gated edges per pass at fixed token cost**, i.e. cost-per-edge. Run
this *before* proposing the feature — LightRAG's own implementation (§2.2) is not evidence that it
works.

**T5 — Is the blind rubric judge stable?** *(feeds §7.3; cheap)*
Arms: re-run the Phase-4 judge on the same 10 findings with the findings' order shuffled, and with a
second judge.
Instrument: `docs/data-analysis/phase4-controlled-test.md`'s own three axes.
Number that would move: **variance in the depth and derivability means across judges/orders**. The
existing limitation paragraph (`:77-79`) already predicts this is the weak joint; measuring it costs
two Sonnet calls.

---

## 14. Features, ranked

| # | Feature | Verdict source | Why the scope admits it | Size | Proposed |
| --- | --- | --- | --- | ---: | --- |
| 1 | **One id-grammar door** — a single validated `entityUrn()` every writer, gate and view imports | 1.4 | `scope.does`: *"one shared entity graph"*. The identity contract IS the graph; a split id is a silently wrong graph | S–M | **Yes → Proposal 1** |
| 2 | **Durable parsed-text sidecar for the kiosek PDF lane** | 9.3, 9.4 | `scope.does`: *"ingestion adapters for public data"*. Parse is the one expensive, non-deterministic, dependency-bearing stage, and the law loop already proves the idiom in-tree | S | **Yes → Proposal 2** |
| 3 | **A path-fingerprint sentinel invariant, no model in the loop** | 7.4, 7.6 | `scope.does`: *"every rendered number cites its source"* — a `/graf` path IS a rendered claim with a permalink, and nothing pins it across a re-ingest. The harness exists; only the invariant is missing | S | **Yes → Proposal 3** |
| 4 | **A capped recall pass inside the gate** | 2.2 | Same scope clause as 1. Held back: LightRAG's implementation is a boolean flag whose merge discards evidence (§2.2, §2.3), so there is no working design to copy. Run **T4** first | M | No |
| 5 | **Wire the cost meter to the extraction lane** | 8.3 | `scope.does`: *"LLM-assisted extraction with cost tracking"*. Held back: the instrument already exists (`hybrid-bench/engine.ts:15-21`); this is a dispatch-plumbing decision, not a registry capability | M | No |
| 6 | **A deletion ordering contract for source-removal propagation** | 10.6 | GDPR obligation is live (`persist-contract-harvest.ts:31-33`). Held back: the graph is largely recomputable, which buys the same safety | M | No |
| 7 | **Collapse `CLAUDE.md`/`AGENTS.md` to one authority** | 11.1 | Housekeeping, not a direction | S | No |

---

## 15. The inverse list — what `politicas` does better

The front half found two. There are **twelve**.

1. **The membership gate** (§4.1). `politicas` rejects a verdict whose edge endpoint or prose-cited
   urn is not a real entity; LightRAG *creates* the invented endpoint as a retrievable node with
   `entity_type: "UNKNOWN"` (`operate.py:3158-3240`), indistinguishable afterwards from a legitimate
   untyped node (`:2461-2465`). This is the study's strongest single finding.
2. **The two-writer rule** (§3.1, §8.2). *"The LLM never authors a count"*
   (`.claude/skills/knowledge-graph/SKILL.md:39-43`), with the defect that taught it recorded (a
   subagent overcounted 2×). LightRAG's model authors descriptions that later become summarised
   descriptions with no arithmetic anywhere — which is safe only because it never asserts a number.
3. **Three provenance axes, not one** (§4.2–§4.4). Method, source reference and review state, each
   separately queryable. LightRAG carries `source_id`, `file_path`, `created_at`.
4. **A schema-enforced output contract** (§2.1). `additionalProperties:false` draft-07 passed to the
   model, versus a delimiter convention in prose and a tolerant parser.
5. **A closed, deny-by-default vocabulary** (§1.5, §1.6). `CASE_OWNED_NODE_KINDS` refuses a kind by
   default the day it is added to the enum. LightRAG decides entity type by plurality vote.
6. **Provenance enforced by the compiler** (§4.6, §11.4). Nine custom ESLint rules with measured
   burn-down counts; `require-source-citation` cannot go up. LightRAG asks the model to cite.
7. **A path product with printed ranking, hub pricing and excluded dense relations** (§6.3–§6.5,
   §4.7). LightRAG has no path product, and no rule that could produce one honestly.
8. **Bitemporal claims with a hash-chained audit trail** (§4.5). Two timelines, append-only history
   tables, Merkle-sealed ingest runs. LightRAG has `created_at`.
9. **Data-shape-driven migration *plus* a verified pre-migration snapshot** (§10.4). `pending.ts`
   computes the exact declared-minus-present difference and states its own scope limits; LightRAG
   samples five documents.
10. **A destructive-rebuild guard computed from the store** (§10.5). `guardKgReset` needs no
    maintenance when a kind is added; LightRAG's purge journal must be kept correct by hand.
11. **Real monetary cost per call, and cost-per-edge as a self-awareness metric** (§8.1, §8.2).
    LightRAG's `TokenTracker` is constructed nowhere outside its tests and prices nothing.
12. **A liveness-honest evaluation harness** (§7.4). `scripts/sentinel/run.ts` runs eleven invariants
    over a read-only copy of the live store, and when the store cannot be read it emits *the same
    eleven rows in the same order*, all `unevaluable`, exit code 2 (`run.ts:24-33`) — because
    previously *"nothing anywhere distinguished 'ran and passed' from 'never ran'"*. LightRAG's
    offline check guards a six-question toy corpus and has no such distinction. The one thing the
    sentinel does not cover is the path lane, which is Proposal 3.

Two more, recorded as ties rather than wins: **resume from observable evidence** (§9.2 vs
`FileProcessingPipeline.md:1148-1154`) and **freezing a proof's constants** (§9.5) — both trees
arrived independently, which is what a corroborating sighting looks like.

---

## 16. Seeded points corrected

| Seed | Was | Is |
| --- | --- | --- |
| 4 (extraction recall) | "capped re-prompt loop, worth testing against the frontier" | The cap is used as a **boolean** (`operate.py:4217-4218`); there is no if-loop prompt; the glean merge is longest-description-wins and can discard first-pass evidence (`:4292-4308`). The force is real; the design is not copyable |
| 6 (destructive rebuild) | "not observed in the sweep" in LightRAG | Three guards exist — journaled 4-phase purge, `destructive_busy`, and a 503 `recovery_required` fence. Still `keep ours`, now for a stated reason |
| 9 (migrations) | "keep ours **unless** the study finds a store with no atomic version home" | `politicas` **already implements** the data-shape decision (`lib/db/pglite/pending.ts`) and pairs it with snapshots. A second independent sighting, not a gap |
| 10 (durable parsed IR) | "adopt — politicas re-parses public-data dumps on every re-ingest" | Three lanes, three answers. The **contract-dump** lane already has a durable filtered IR and is GDPR-*forbidden* from keeping the source (`harvest-contract-dumps.ts:9-12`); the **law** lane already persists extracted PDF text (`collision-core.ts:19-25`); only the **kiosek** lane discards it (`kiosek-slice.ts:76`). Scope narrowed from "adopt a mechanism" to "one lane adopts a sibling's idiom" |
| — (new) | *(not seeded)* — "nothing pins graph answers over the real store" | Half wrong. `scripts/sentinel/run.ts` runs eleven invariants over a read-only copy of the live store, including a determinism oracle (`invariants.ts:499-527`). It does not cover `findEvidencePaths`. Proposal 3 shrank from a new instrument to a twelfth invariant |
| 11 (retrieval lanes) | `graphTraversal.ts` / `graphNav.ts` are "traversal, not ranked retrieval" | Both are **keyboard navigation** of a rendered SVG. The query plane is `features/graph/trailPath.ts:190` |
| 12 (judge protocol) | "verify whether `hybrid-bench` swaps order and offers a tie" | `hybrid-bench` has no judge (it scores against gold predicates). The judge is a **blind rubric** judge (`phase4-controlled-test.md:21-22`), so pairwise position bias does not arise. The real limitation — n=1, one judge — is already disclosed at `:77-79` |

Also corrected against the front half's own structural counts: LightRAG has **15** top-level
`*_impl.py` behind **five** base classes (not 18 behind 4), **13** test subdirectories (not 15), and
**21** root-level test modules (not 22).

---

## 17. Proposals raised

- `2026-09-02-entity-id-grammar-door.md` — `civic-intelligence/civic-knowledge-graphs`
- `2026-09-02-durable-parsed-text-sidecar.md` — `software-engineering/import-normalization`
- `2026-09-02-offline-path-oracle.md` — `software-engineering/retrieval`

Each is `status: proposed`. No ledger row is written by this pass; the owner writes it.
