# Case ③ Law loop — fleet handoff (batch-001, 2026-07-24)

Fleet run. **No live `.pglite` writes, no commits.** Everything below is for the orchestrator to
serialize: graph payloads to persist (with the re-verify command), shared-file text blocks, enum/
schema proposals, a commit plan, and lessons. Analysis ran read-only on `.pglite-copy-law` (delete
after: `rm -rf .pglite-copy-law`).

## 1. What ran

- **Ledger + triage** (`scripts/case-loops/law/triage.ts`) → `ledger.json` (141 bills) + a
  lexicographic triage (severity → sponsorCzk → amends → routing). Two triage signals are degenerate
  on real data (see Lessons): `sponsor_contract_czk` saturates on a single municipal-board figure;
  routing-anomaly over-fires (89%).
- **Army of 8** (top-triage pending bills; 3 Opus / 5 Sonnet) → 8 gated `LawForensicVerdict`s under
  `payloads/verdicts/`. Every DZ PDF was actually fetched (pdftotext); every claim carries a URL/id.
- **Gate** (`scripts/case-loops/law/gate-verdicts.ts`): **8/8 pass** (widened scope), **7/8** canonical.
- **Build**: committee routing (`assigned_to`, F15) now renders on `/zakony` — real, cited, graceful
  null-degradation. `npm run check` green (typecheck + lint + 160 tests).

## 2. Graph payloads to persist (validated)

**No new nodes/edges this batch.** The 8 verdicts are **prop-merges onto existing bill nodes**
(`forensic_*`, `review_state: pending_review`), exactly like tisk-58. Persist via the existing writer:

```bash
# from repo root, against LIVE .pglite (orchestrator holds the write lock)
# 1. re-verify the gate first (must print 8/8 — or 7/8 canonical, see §4 knownIds proposal):
PGLITE_PATH=./.pglite npx tsx scripts/case-loops/law/gate-verdicts.ts --wide
# 2. write each verdict as pending_review forensic props (kg-forensics re-runs the gate itself):
for t in 4 40 115 119 120 121 244 248; do
  npx tsx scripts/data-analysis/kg-forensics.ts --write \
    --verdicts=docs/data-analysis/case-law/payloads/verdicts/verdict-$t.json --commit
done
```

- `kg-forensics.ts` keys verdicts by `billTisk == cislo` (public print no.) and computes
  `pass = max(firstSeenPass)+1`. It **re-runs `validateLawVerdict`** against graph laws ∪
  `.data/esbirka/known-laws.json` (24,774 statutes) + `knownIds`, so a drifted verdict is rejected at
  write time too. All 8 pass the widened scope; **verdict-248 needs the knownIds widening in §4** (it
  cites `graph_fact: bill:tisk:43370`, a real bill id the canonical scope doesn't admit) — otherwise
  hand-edit that one citation's kind to `web`/drop it, or accept under `--wide`.
- After write, `forensicCount` on `/zakony` goes 1 → 9. Provenance carries `{track:"law"}` per kernel
  (kg-forensics currently writes `ref:"law-forensics"`; add `track:"law"` — see §4).

Expected result: **8 bills enriched, 0 conflicts detected (all `severity: low`)** — the honest batch
headline. Re-verify the render with `PGLITE_PATH=./.pglite npx tsx` on `getLawData` (committees +
forensicCount).

## 3. Shared-file additions (append verbatim; I could not edit these in fleet mode)

### → `graph-log.md`
```
## Pass N (track: law) — Case ③ batch-001 forensic verdicts (2026-07-24)
8 bill nodes enriched with pending_review forensic_* props (kg-forensics --write): tisky 4, 40, 115,
119, 120, 121, 244, 248 — top-triage flagged income-tax / pension / criminal-code prints. All
severity=low: 8/8 flagged bills, 0 self-dealing channels found (non-partisan symmetry at scale).
Gate 8/8 (widened knownIds). No new nodes/edges. forensicCount 1→9. Also shipped: /zakony committee
routing (assigned_to render, F15) — no graph change, read of existing 150 edges.
```

### → `patterns.md`
```
### Law: the money flag is a weak conflict proxy (batch-001, 8 units)
sponsor_contract_czk flags 65/141 bills but the top-8 by triage yielded 0 real conflicts. The flag
saturates on publicly-owned-company board roles (ARENA BRNO, Pražské služby, Operátor ICT, ČEPRO all
municipal/state) that are not self-dealing channels. General tax/pension/criminal statutes distribute
to statutory classes, not to sponsor-linked firms. → rank conflict by tie SECTOR-ADJACENCY to the
amended law's domain, not raw CZK; exclude municipal/SOE board roles from the conflict signal.

### Law: sibling bills collide — read them together (tisk 120 ↔ 244)
Both amend §35ba of 586/1992 with renumbering instructions assuming different starting letterings; if
120 enacts first, 244 strikes the wrong provision. Only visible because the loop researches sibling
prints in one batch. A durable "same-statute, same-§, overlapping prints" pre-check is worth building.

### Law: quiet riders hide under a headline title (tisk 4, tisk 40)
tisk 4 (an "income-tax" bill) carries a new 2,340 Kč/hl wine excise; tisk 40 adds beer beyond its
stated wine scope. The churn-target triage signal (busy statutes) surfaces these correctly.
```

### → `contradictions.md`
```
### amends edges UNDERCOUNT the real amended-law set (title-regex limitation)
tisk 4's bill text amends FOUR statutes; the graph's `amends` (regex on the title's "č. N/RRRR Sb.")
recorded ONE (586/1992). psp-legislation.ts extracts only laws NAMED IN THE TITLE; bills amending
further statutes in the body ("a další související zákony") are undercounted. Impact: churn counts,
routing-domain checks, and "most-amended" rankings are all biased low. Fix: parse the tisk body /
e-Sbírka novelization instructions, not just the title. Recorded so downstream passes don't trust
amends as complete.
```

### → `feature-opportunities.md`
```
### /zakony committee routing (SHIPPED batch-001)
assigned_to (F15) garanční/další + status + date now render in the bill detail (getLawData +
LawWatchPage). Real, cited (psp.cz hist_vybory), graceful null. 131/141 bills routed.

### e-Sbírka §-level paragraph diff (the flagship — scoped, deferred)
e-Sbírka open data DOES carry consolidated text: dataset 001PravniAktZneni (176 MB, act versions +
effective dates + fragment IRIs) + 003PravniAktZneniFragment (1.24 GB, per-§ text) + 007
KonsolidacniVazba (version chain). A real §-diff is feasible between two ENACTED versions of a
repeatedly-amended statute (e.g. 586/1992). Blockers for THIS session: (a) 003 is 1.24 GB — a
dedicated tsvector/GIN ingest (R9–R11), not a batch subtask; (b) 001 stream throughput ~1 MB/min
here; (c) PENDING bills have NO "after" version in e-Sbírka (it holds only enacted law) — a
prospective bill diff needs the tisk PDF novelization instructions applied to the current text.
Durable diff-artifact schema designed in §4. Adapter scaffolded: scripts/case-loops/law/
esbirka-versions.ts (streams 001, brace-extracts target laws' version timelines). CONCRETE EVIDENCE
this session: the 001 stream aborted at the 600 s timeout having pulled only ~6 MB of 176 MB
(~1 MB/min effective server throughput) — even the lightweight version-timeline extraction did not
complete. Run it as a dedicated long-running ingest (raise timeout, resume/cache) off the batch path.

### Lobbying-footprint surface (new)
tisk 120's DZ discloses a PAQ Research lobbying footprint under zák. 168/2025. Explanatory memoranda
now carry structured lobbyist disclosures — a citable transparency dataset worth ingesting per bill.
```

### → `frontier.md` (Case ③ section)
```
- Does conflict-by-sector-adjacency (tie's NACE vs amended law's domain) beat raw sponsor_contract_czk?
  batch-001 says the raw CZK flag is saturated by municipal/SOE board roles.
- Which of the 141 bills actually reached a 3rd-reading roll call? (bill→hlasovani link needs
  hl-<year>ps.zip + agenda cross-ref; hist.unl col5 is a document id, not a vote id — see §4 voted_in.)
- How many bills amend statutes NOT named in their title? (amends undercount — tisk 4 proof.)
- Do sibling prints on the same § collide? (tisk 120↔244 — build a pre-check.)
```

## 4. Enum / schema proposals

### (a) `voted_in` rel (bill → vote_event) — DEFERRED with evidence
Proposed: `voted_in : bill:tisk:<id> → psp:hlasovani:<pspId>`, props `{reading, result, datum}`,
provenance `{track:"law", method:"deterministic", ref:"vote-link"}`. **NOT shippable from cached
data.** Evidence gathered (scripts/case-loops/law/inspect-hist.ts + inspect-votes.ts):
`tisky.zip/hist.unl` col 5 carries ids like 58496/58541/58581/59003 on reading steps, but graph
`vote_event` nodes use `psp:hlasovani:<86xxx>` — a **different id space**; col5 is a document/usnesení
id, not a hlasovani id. The real bill→hlasovani join lives in the hlasovani dumps
(`hl-<year>ps.zip` → `hl_hlasovani.unl`, cross-referenced via the schůze agenda `bod_schuze`), which
are **not in tisky.zip and not cached**. Also the term is mixed: tisk 119 is fully enacted (3rd
reading, Senate, President) but most batch bills sit in committee. → Ship `voted_in` only after the
hlasovani-agenda ingest lands; do not fabricate the edge.

### (b) Widen `knownIds` for graph_fact citations (law-verdict gate + kg-forensics)
The canonical anti-fabrication scope admits `company | person | law` ids. A truthful clean-hands claim
("this bill node records zero sponsor ties") legitimately cites the **bill** node id — verdict-248
did, and failed the canonical gate though the id is real. Proposal: `knownIds = all graph node ids`
(add `bill`, `organ`) in `kg-forensics.ts` write() and `validate*`. Demonstrated: `gate-verdicts.ts
--wide` → 8/8. Low risk (still a membership gate; just a wider, correct base).

### (c) Durable §-diff artifact schema (for the flagship build)
Store under `payloads/diffs/<law-ref>__<fromZnitniId>-<toZneniId>.json`. Anti-fabrication: `before`
and `after` MUST both be actual e-Sbírka fragment text (never synthesized).
```jsonc
{
  "law": "586/1992",
  "source": "e-Sbírka 001PravniAktZneni + 003PravniAktZneniFragment",
  "fetchedAt": "ISO",
  "from": { "zneniId": 0, "effectiveFrom": "YYYY-MM-DD", "eli": "/eli/cz/sb/1992/586/…" },
  "to":   { "zneniId": 0, "effectiveFrom": "YYYY-MM-DD", "eli": "…" },
  "hunks": [
    { "fragment": "§35c odst.1", "op": "modified", "before": "…real text…", "after": "…real text…" }
  ],
  "provenance": { "track": "law", "pass": 0, "method": "deterministic", "ref": "esbirka-diff" }
}
```
getLawData reads matching diffs by amended-law ref → a `paragraphDiffs` field on LawBillView →
LawWatchPage renders before/after hunks (restoring the mock's flagship UI with REAL data).

### (d) Provenance `track` field
kg-forensics writes `provenance.ref:"law-forensics"` but not the kernel's `track`. Add
`track:"law"` to forensic + routing provenance so the money/effort/law tracks are separable
(kernel §Provenance). One-line change in kg-forensics.ts + kg-committee-routing.ts.

### (e) Triage refinement (steering)
Replace the saturating `sponsor_contract_czk` primary key with a **sector-adjacency conflict score**
(tie company NACE vs amended-law domain) and exclude municipal/SOE board roles. Densify F12 `owns`
(30 edges) before trusting the routing-anomaly signal (currently 89% false-positive).

## 5. Commit plan (orchestrator; per-case commit inside law boundary)

Files (all within law boundary):
- `docs/data-analysis/case-law/**` (ledger.json, batch-001.md, handoff.md, payloads/**)
- `scripts/case-loops/law/**` (triage, prepare-batch, gate-verdicts, esbirka-versions, inspect-*, ARMY-CONTRACT.md)
- `features/lawwatch/getLawData.ts`, `features/lawwatch/LawWatchPage.tsx` (committee routing render)

Suggested message (Conventional):
```
feat(case-law): batch-001 forensic verdicts + /zakony committee routing

Law loop calibration batch — triage 141 bills, army of 8 gated forensic verdicts
(8/8 pass, all low: 0 self-dealing channels found), render assigned_to committee
routing on /zakony. Verdicts land pending_review via kg-forensics --write (separate
persist step, orchestrator-serialized). npm run check green.
```
NB: the `kg-forensics --write --commit` calls in §2 are a **separate live-graph step** the
orchestrator runs under the write lock, not part of this working-tree commit.

## 6. Lessons learned (skill/kernel calibration)

1. **The money→conflict signal is the loop's weakest link on this population.** 8/8 top-flagged
   bills, 0 conflicts. The kernel/skill should frame "absence of conflict" as the EXPECTED, valuable
   output for general legislation, and the triage should rank by tie-to-subject adjacency, not raw
   CZK. The current skill's "flagged_conflict CZK" primary key produced a near-degenerate ordering.
2. **The richest yield was NOT conflicts but cross-cutting leads** — data-quality (amends undercount),
   drafting collisions (120↔244), quiet riders (4, 40), enacted-vs-pending mix (119). The skill's
   "signal" stage should explicitly solicit these classes, not just conflict severity.
3. **The army is reliable and honest.** All 8 fetched real DZ PDFs (pdftotext), cited everything, and
   returned honest low-severity findings even for the Babiš criminal-code bill (115) where a lazy pass
   could have manufactured a scandal. The gate + web-doctrine held. Cost ≈ 60–130k tokens/unit
   (Opus/Sonnet); ~5 min/unit wall time in parallel.
4. **e-Sbírka is richer than the skill assumed** — full consolidated text exists (001+003), so the
   "flagship diff" is a data-scale problem (1.24 GB ingest), not an access problem. But the skill's
   framing ("restore the diff with real data") must confront that PENDING bills have no enacted
   "after" version — the honest prospective diff needs tisk-PDF novelization instructions, a different
   pipeline. Update the seed backlog to distinguish historical (enacted-vs-enacted) from prospective
   (bill-vs-current) diffs.
5. **hist.unl gives procedural stages but not the vote link** — a documented dead-end that saves the
   next runner the detour. voted_in needs the hlasovani-agenda ingest.
6. **Gate id-membership is too narrow** — a real graph id (bill node) failed as a graph_fact. Widen to
   all node kinds (§4b). The anti-fabrication guarantee is unchanged.
7. **Fleet discipline worked cleanly** — read-only copy, payload-only outputs, no shared-file edits,
   no commits. The only friction: kg-forensics computes `pass` from the live graph, so the actual pass
   number is assigned at orchestrator write-time (as the kernel intends).
```
