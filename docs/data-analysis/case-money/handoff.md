# Money loop — fleet handoff (batch 008)

Case ① FollowTheMoney · 2026-07-26 · fleet mode (law + effort drivers concurrent) ·
Sonnet driver + 1 Opus verification pass (max reasoning depth). Full narrative +
Opus verdict excerpts in `docs/data-analysis/case-money/batch-008.md` — this
document is the orchestrator's action list. **No commit made. No live `.pglite`
write. No `review_state` flipped anywhere.** All work happened on a case-suffixed
copy (`.pglite-copy-money-b8`, LEFT IN PLACE this time — see §5 — never
`./.pglite`). This document supersedes batch-006's `handoff.md`, now historical
(batch 007's payload-application is already reflected in the live-state numbers
below; no separate batch-007.md/handoff.md was ever written by a money driver —
the orchestrator applied batch-006's payloads directly).

## Headline numbers

- **Q-money-15 (C17 remedy): 1 flip out of 28 open ties re-verified against LIVE
  ARES VR** (Tomio Okamura ↔ MIKI TRAVEL PRAGUE). Few flips, as expected — this
  confirms the open population mostly holds, it doesn't overturn it. **2 real
  negative-label defects found and corrected** (a P36 regression, a C11 case) —
  no graph harm, but the summary artifact needed fixing.
- **Q-money-16: still incomplete.** Both dataor large-file retries (praha, brno)
  stalled again, same as batch-006. 4 of the original 5 ties remain blocked via
  dataor (the 5th, Okamura↔MIKI TRAVEL, closed via Q-money-15's independent ARES
  VR path instead).
- **Indirect-ownership layer: 0 sibling-level leads, by construction — Opus
  corrected the framing to "sibling-level only, parent/descendant unchecked."**
  A concrete next-batch scope is specified (8 named private parents; 2 named
  multi-hop chains).
- **kiosek watch: 0 hits, zero-power baseline** (Opus verdict) — a real gap
  found along the way (`concerns` edges never persisted live, 0 vs `cites`'
  36) and flagged for the orchestrator/case-sources driver.

## 1. Q-money-15 payload — apply this

```
docs/data-analysis/case-money/payloads/batch-008-qmoney15-live-flips.json
```

One props-merge proposal onto an EXISTING `linked_to` edge (Tomio Okamura's
`psp:person` node → `company:ico:25124188`, MIKI TRAVEL PRAGUE).
`corroboration: "conflicting" → "registry-confirmed"`, plus
`role_valid_from`/`role_valid_to`/`reviewer_note`/`flags`. Same discipline as
every prior batch: never creates a person↔company edge, never touches
`review_state`. Gated clean (1/1) — command below.

## 2. Validation commands

```bash
# Gate the payload (entity-id membership, edge-existence):
PGLITE_PATH=./.pglite-copy-money-b8 npx tsx scripts/case-loops/money/validate-batch008.ts
# → GATE ...: 1/1 live-flip proposals validate. ALL batch-008 payloads validate cleanly.

# Typecheck (clean this batch, no test-touching code changed):
npx tsc --noEmit

# Inspect before persisting:
cat docs/data-analysis/case-money/payloads/batch-008-qmoney15-live-flips.json
```

## 3. Q-money-16 — next-batch action, not resolved this batch

Two files still won't transfer: `sro-full-praha-2026.csv.gz` (~71MB of an
expected ~225MB) and `sro-full-brno-2026.csv.gz` (~65MB), both truncated
(`gzip -t` fails on both), left in `.dataor-cache/` in case the server ever
supports resume (`curl -C -`, untried). Two full retry attempts this batch (18
min total network budget) reproduced batch-006's exact stall, not a
transient blip. **Recommend for next batch**: either a much longer `--max-time`
(untested past ~550s/attempt) or investigate whether dataor exposes a
finer-grained split for Praha/Brno specifically (they're the two largest
jurisdiction files in the catalog by construction, a size problem retry alone
won't fix).

## 4. Shared-vault additions (exact text to append — not edited myself, fleet
rule)

**`contradictions.md`** — append to the existing **§C17** entry (do not create
a new C-number, this closes it):

> **Resolution (money batch 008):** C17's called-for remedy — re-verify the
> open population against the LIVE ARES VR endpoint, not a cached snapshot —
> was executed for the full 28-tie open population (not just the 2 ties that
> originally motivated C17). Result: 1 flip (Okamura↔MIKI TRAVEL PRAGUE), 16
> genuine confirmed negatives, 9 structural 404s, 2 negative-label defects
> found and corrected (see P-entry below). **The batch-002 sweep's negatives
> were mostly right** — C17's caution was warranted (2 specific mislabels DID
> exist and were found) but did not generalize to systemic unreliability of
> the whole population. C17 is CLOSED.

**`patterns.md`** (proposed new entry): *"A deterministic re-verification
script can itself regress against an EARLIER-established discipline if it
doesn't inherit every rule the original pass encoded — money batch 008's live
ARES-VR re-check used only the exact-birth-date hinge and, in doing so,
silently dropped batch-002's P36 rule (name-similarity fallback gated to
null-birthdate VR entries), mislabeling one tie with null-birthdate VR entries
as a 'confirmed negative' rather than 'unverified.' Caught only by an Opus
verification pass sweeping the FULL negative set, not a sample. Lesson: when a
script re-implements a prior pass's matching logic instead of importing it, it
must re-derive from the SAME rule list, not just the SAME primary hinge — a
narrower re-implementation is a silent regression, not a simplification."*

**`patterns.md`** (proposed new entry): *"A '0 findings' result from a join
whose candidate universe is itself derived from the same relation being
tested is close to tautological, and needs to be framed as a scope
limitation, not an absence-of-exposure finding — money batch 008's
indirect-ownership sibling check (0/26 leads were genuinely new) drew its
company universe FROM `linked_to` ties, so a sibling company being
'already tied' was near-guaranteed by construction. The Opus-corrected
framing ('0 SIBLING-level leads, parent-level and descendant-level not yet
examined, breadth = N named untested parents/chains') is the honest version
of a null result from a construction-biased test — the same shape of caution
belongs on any future money-loop signal built by joining the graph against
itself."*

No other shared vault files or shared code enums touched. `owns_stake`,
`cites`, `concerns` are already live `KG_EDGE_RELS` members (batch 007) —
this batch proposed no new enum values.

## 5. Cleanup — DIFFERENT from prior batches, read before deleting anything

`.pglite-copy-money-b8` is **NOT deleted** — left in place intentionally so
the orchestrator can run the gate command in §2 directly against the exact
copy this batch analyzed, without re-copying `./.pglite` (which may have
moved if a sibling case wrote to it in the meantime — irrelevant here since
money only reads `linked_to`/`owns_stake`/`notice`/`cites`/`concerns`, but
kept for reproducibility). Safe to delete after the payload in §1 is applied
and re-verified against the live graph.

`.dataor-cache/sro-full-{praha,brno}-2026.csv.gz` are BOTH truncated/corrupt
(confirmed via `gzip -t`) — left in place, not deleted, on the chance the
server ever supports HTTP range resume. They cannot be silently mistaken for
valid cache by any downstream script (`fetchDatasetCsv`'s cache convention
only trusts a decompressed `.csv`, never reads a `.gz` directly).

## 6. Open items / follow-ups for the next batch

1. **Q-money-16**: 4 ties still blocked on the 2 large dataor files (Bauer↔TAMPA,
   Kučera↔Sirius Praha, Šafránková↔Pražská VŠPS — `sro-full-praha-2026`;
   Jurečka↔AGRO 2000 — `sro-full-brno-2026`). Widen the network budget or find
   a finer-grained dataor split.
2. **Indirect-ownership breadth-2**: check the 8 named private non-MP-tied
   parents' OWN contract exposure (B.S.-KINGS s.r.o., UNICO Pardubice a.s.,
   Rybářství Třeboň Hld. a.s., Léčebné centrum sv. Markéty a.s., Lázně
   Luhačovice a.s., DEZA a.s., ČSOB, České dráhy), and extend one hop further
   on the AGROFERT and B.S.-KINGS chains (already cached, just unused this
   batch).
3. **`owns_stake` data-integrity flag**: `chainsExamined` produced 39 rows for
   33 declared edges — duplicate child←parent rows (MERO ČR, AGROFERT←AGROFERT
   HOLDING, Operátor ICT, Plzeňské MDP←Město Plzeň each appear ≥2×). Needs
   reconciling in batch-006's `owns_stake` payload before "33" is quoted again
   as a clean count.
4. **kiosek `concerns` edges: real gap, not this case's boundary to fix** — 0
   live despite being a `KG_EDGE_RELS` member since batch 007 and despite 24
   proposals sitting ready in `docs/data-analysis/case-sources/kiosek-payload.json`.
   The orchestrator or the case-sources driver should apply that payload (or
   diagnose why it wasn't applied alongside `cites`) so the money watch
   (`scripts/case-loops/money/kiosek-watch.ts`, re-runnable, no code changes
   needed) gains real power instead of testing an empty edge set.
5. **The 2 negative-label defects** (Černochová/Nadační fond,
   Vlček/PRO VYSOČINU) are annotation-only corrections inside
   `qmoney15-summary.json` (an analysis artifact, not a graph write) — no
   payload needed, already applied this batch.
6. Batch-005/006 steering items not yet actioned (D5 CHECK migration,
   Q-money-13 stale-mention payload if not already applied, OSVČ purge
   live-execution confirmation if not already actioned) remain open if the
   orchestrator hasn't closed them — this batch did not re-verify their
   status (out of this batch's scope; live-state check at the top of
   `batch-008.md` only covered the fields this batch's four tasks needed).

## 7. Lessons learned

Full detail in `batch-008.md` §5. Summary:

1. A deterministic re-verification script can regress against an earlier
   pass's matching discipline if it re-implements rather than reuses the rule
   set (P36 dropped silently) — caught only by an Opus pass sweeping the FULL
   set, the fourth consecutive batch (004/005/006/008) with "independent
   re-derivation catches what the driver's own review misses" as the exact
   finding.
2. A "0 findings" result from a self-referential join (candidate universe
   built from the same relation under test) needs explicit scope framing —
   "0 sibling-level, parent/descendant unchecked" is honest; "0 exposure" is
   not.
3. A zero-power test (empty target population, or a population too small to
   expect a hit even if the mechanism is real) must be labeled as such, not
   reported as a clean negative — applies directly to the kiosek watch this
   batch and is worth generalizing to any future watch-style check.
4. Network-budget stalls on the two largest dataor court×form files are
   reproducible across two independent batches (006, 008) with two different
   retry attempts each — treat as a structural constraint of this
   environment/source, not a one-off to keep re-trying identically.
