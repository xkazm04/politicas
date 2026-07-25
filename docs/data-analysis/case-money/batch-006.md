# Money batch 006 — dataor bulk-ISVR ingest, corroboration sweep, PRaK re-point, indirect-ownership first slice

Case ① FollowTheMoney · 2026-07-25 · fleet mode (effort + law + kiosek executors
concurrent, per `docs/case-loops.md`) · Sonnet driver + 2 Opus verification
passes (max reasoning depth: PRaK re-point, then the two general-sweep
corroboration closures). **No commit made. No live `.pglite` write. No
`review_state` flipped anywhere.** All analysis on `.pglite-copy-money-b6`
(deleted at the end of this run). Raw dataor bulk files cached under
`.dataor-cache/` (gitignored, like `.justice-samples/`).

## Headline

**dataor closed 4 of the 32 open corroborations this batch** (23 conflicting +
9 registry-unconfirmed, post-OSVČ-purge population — see §0 for the batch-spec
"81" reconciliation): **2 via the general sweep** (Jana Černochová↔Komwag,
Marek Ženíšek↔Pojišťovna VZP) **+ 2 via the PRaK re-point** (Petr Bendl,
Richard Brabec — Q-money-7, closed after two prior batches left it a "dead
end"). **9 of the 32 are structurally out of scope for dataor** (not
ISVR-registered — special-law public bodies with no commercial-register
record at all, the same reason ARES VR 404s them; this is a permanent fact,
not a data gap). **5 remain incomplete** (one very large, slow-to-transfer
court×form file — logged honestly, retry command in §7). The rest (10) are
resolved-but-honestly-negative: 6 wrong court/legal-form guesses, 3
unresolved court/form, 1 checked-with-no-birthdate-match.

## 0. Scope correction — "81" vs the real live population (32)

The batch brief cited "23 conflicting + 58 registry-unconfirmed = 81 open
corroborations." That figure is `ledger.json`'s **batch2** snapshot, from
BEFORE batch 004's OSVČ purge. The purge removed 49 of the 58
registry-unconfirmed ties (the false `ico:04627695` edges — see batch-004
§2). **81 − 49 = 32**, which is exactly today's live tier-3 population (23
conflicting + 9 registry-unconfirmed). Verified directly against the graph
copy before writing any code — this batch processes the real, current 32,
not the stale 81.

## 1. dataor ingest adapter (`lib/ingest/sources/dataor.ts` + `dataor.test.ts`)

Built per `docs/data-analysis/justice-sources-registry.md`'s assessment
(2026-07-25, cleared for ingest — non-commercial licence + GDPR-controller
conditions accepted). Scope: **targeted lookups, not a bulk mirror** — one
court×legalForm×year file at a time, cached to disk (`.dataor-cache/`,
gitignored), never the full ~9,496-dataset catalog.

- **CKAN client**: `packageList`, `packageShow`, `datasetId()` — the
  `{legalForm}-{full|actual}-{court}-{year}` naming convention.
- **The `udaje` grammar parser** (`parseUdaje`): a bespoke recursive-descent
  parser for the Ministry's non-JSON Groovy/Java-`toString()`-style
  serialization (`{k=v; k=v; sub={...}}`, arrays `[{...}, {...}]`). Verified
  against real captured samples (PRaK's own record, an `AngazmaPravnicke`
  shareholder-chain example).
- **`extractOfficersAndShareholders`**: pulls officer + shareholder entries,
  natural-person (`AngazmaFyzicke`) and corporate (`AngazmaPravnicke`, the
  O-money-3 signal). **Real bug found and fixed mid-batch** (§5, Opus
  verification): the first version only recognized ONE of several officer
  "\*\_CLEN" udajTyp codes (`STATUTARNI_ORGAN_CLEN`) — `DOZORCI_RADA_CLEN`
  (dozorčí rada/supervisory board), `KONTROLNI_KOMISE_CLEN`, and
  `SPRAVNI_RADA_CLEN` were silently invisible. This dropped a real,
  birth-date-confirmed corroborating match (Brabec's 2004–2006 dozorčí rada
  seat) entirely. Fixed; regression tests added (`dataor.test.ts` — 21
  tests, up from 19).
- **`resolveCourtAndForm`**: derives the court+legal-form dataset key from
  ARES's own `spisovaZnacka` (most reliable — it literally IS the court
  code) or `sidlo.kodKraje` as fallback, with a name-suffix heuristic for
  the legal form as a last resort. Every resolution states which rung
  produced it — never a silent guess.
- **CSV parsing**: index/`indexOf`-based row reader, NOT character-by-character
  accumulation — the first version OOM'd (4GB heap) on a real 321MB
  decompressed file (`as-full-praha-2012`, PRaK's own dataset). Fixed;
  `findRecordByIcoInCsvText` never materializes a whole file's records when
  the caller wants one IČO.
- **Tests**: 21/21 passing, using real captured record fragments (not
  synthetic), including a dedicated regression for the `*_CLEN` extraction
  gap and a `POCET_CLEN`/`VKLAD_CLEN` exclusion test (same suffix, different
  meaning — a false-positive risk this batch checked for explicitly).

## 2. Job A — dataor corroboration sweep (32 open ties)

`scripts/case-loops/money/dataor-corroborate.ts`. Method: ARES `subject()`
resolves court+legalForm (cheap); the current-year FULL export (carries
complete officer history within the record, not just currently-active
roles) is fetched and searched for the tied company's IČO; an exact
birth-date match against the roster upgrades `corroboration` to
`registry-confirmed`; a checked non-match is recorded honestly (never
silently absorbed into "still unconfirmed").

**Result** (payload:
`docs/data-analysis/case-money/payloads/batch-006-dataor-corroboration.json`,
30 edges — PRaK's 2 ties excluded, handled by Job B):

| result | count | meaning |
|---|---|---|
| `match` (closed) | **2** | Černochová↔Komwag, Ženíšek↔Pojišťovna VZP — both Opus-verified, corrected (see §5) |
| `not-isvr-registered` | 9 | structural — special-law public bodies (ČT, ČRo, VZP, universities, hospitals, a charity, an institute) have no OR/ISVR record at all; same reason ARES VR 404s them. **Permanent, not a gap.** |
| `ico-not-in-dataset` | 6 | dataset exists but the IČO isn't in it — court/legal-form guess likely wrong (mostly `nevlad_org` tried for z.s./spolek entities; see §7 lesson) |
| `no-match` | 4 | dataset fetched, IČO found, birth date checked against every officer/shareholder entry — genuinely no match. Honest negative. |
| `fetch-incomplete` | 5 | one very large court×form file (`sro-full-praha-2026`, ~225MB gzipped) repeatedly exceeded this batch's network budget over a slow connection — see §7 |
| `dataset-not-found` | 1 | court/form combination doesn't exist as a dataor dataset |
| `court-form-unresolved` | 3 | ARES subject had no usable `spisovaZnacka`/kraj to resolve a court — would need a manual aggregator lead, PRaK-style |

**A real structural pre-filter, not assumed**: the 9 `not-isvr-registered`
cases were checked, not assumed — `ARES subject().dalsiUdaje` having no
`"vr"` sub-record at all means the entity is provably outside ISVR (dataor
draws from the exact same registry ARES VR does), spot-verified live against
ČESKÁ TELEVIZE (pravniForma 361, VR endpoint returns `NENALEZENO`).

## 3. Job B — the PRaK re-point (Q-money-7), CLOSED

`scripts/case-loops/money/prak-repoint.ts`. Two mis-pointed edges (Petr
Bendl AND Richard Brabec — batch-003's writeup only narrated Bendl, but the
live graph had BOTH pointing at the wrong IČO 49683144) re-pointed to the
correct, primary-source-corroborated entity: **IČO 61858111, "PRaK, a.s. v
likvidaci"**, dissolved 2012-12-13, unreachable via ARES REST (404 on both
subject and VR endpoints — the batch-003/004 dead end) but present with full
officer history in `as-full-praha-2012` (dataor's FULL export for its
dissolution year).

Payload:
`docs/data-analysis/case-money/payloads/batch-006-prak-repoint.json`
(**v2**, after the Opus corrections in §5): a `nodeCreateProposal` for
`company:ico:61858111` (doesn't exist yet — ARES never had it) + 2
`edgeRepointProposals`:

- **Bendl** — `registry-confirmed` (birth date 1966-01-24 exact match).
  Role history: dozorčí rada 1994-08-16→1996-01-15, then člen
  představenstva 1996-01-15→1999-07-28. `role_valid_from: 1994-08-16` (his
  full continuous seat, not just the board-member portion).
  `tie_class: "manager"` (deterministic `classifyTie()`, same rule as the
  other 260 ties — board-management role, non-public company).
- **Brabec** — ALSO `registry-confirmed` (birth date 1966-07-05 exact
  match, found via a 2004-03-04→2006-05-29 dozorčí rada seat the v1 draft's
  extraction gap had missed entirely). His earlier 1994-1996 představenstvo
  seat has no birth date and stays unconfirmed in `role_history` only.
  `tie_class: "steward"` (classifier's default for a non-management board
  seat) — but with the false "mayoral ex-officio public appointment at a
  rail SPV" narrative **retracted** (§5).

## 4. Job C — indirect-ownership first slice (O-money-3)

`scripts/case-loops/money/dataor-ownership-chains.ts`. Walked all 195
companies already tied to an MP; resolved court+legalForm for each; scanned
already-cached files freely, bounded new fetches to 12 (priority:
owner-operator/manager tie_class + the AGROFERT family, the task's own
flagship example).

**Result**
(`docs/data-analysis/case-money/payloads/batch-006-ownership-chains.json`):
**55 `owns_stake` (company→company) edge proposals**, **19 new parent-company
node proposals**, 153 companies not attempted this batch (scope-bounded,
each with a logged reason — never silently dropped), 15 resolved with zero
corporate shareholders found (an honest negative — natural-person-owned).

**AGROFERT, a.s. (IČO 26185610) — the flagship example — DOES show a
dated, IČO-keyed corporate-shareholder chain**: AGROFERT HOLDING, a.s.
(sole shareholder, 2002-06-20→2004-08-31) → AGROFERT a.s. [a distinctly
IČO'd predecessor entity, not the same node] (sole shareholder,
2004-08-31→2005-06-30). **Honest limitation**: the chain in this record ENDS
at 2005-06-30 — it does NOT show the well-known post-2017 transfer into the
AB private trust funds (svěřenský fond) structure. Not investigated further
this batch (flagged as a lead for a future batch — the trust-fund transfer
may use a different engagement mechanism this extractor doesn't yet
recognize, or may simply not appear in this particular court×year file).
**No MP-exposure inference is drawn from this chain** — company-to-company
facts only, per doctrine; any Babiš-exposure narrative stays a lead for a
future pass, not a graph claim.

Other real chains found: MERO ČR (state oil-pipeline operator), Wellness sv.
Markéta, IF Holding/IF FACILITY, Synthesia, several regional
hospitals/utilities (Oblastní nemocnice Trutnov/Kladno/Mladá Boleslav,
VODÁRNA PLZEŇ, Plzeňská teplárenská) — public-utility ownership chains, a
useful non-partisan-symmetry finding (public infrastructure ownership is
visible and traceable the same way private chains are).

**Schema proposal (additive, NOT applied — `kg-verdict.ts` is shared, fleet
rule)**: `owns_stake` added to `KG_EDGE_RELS`, company→company,
`props: {role, from, to, share, source}`. Confirmed this doesn't collide
with the existing `"owns"` rel (organ→theme, F12/F15's committee-remit
edge — unrelated semantics, checked directly in `kg-verdict.ts`).

## 5. Opus verification (P51, max reasoning depth) — two passes

**Pass 1 — PRaK re-point (v1 draft).** Verdict: **WITH CORRECTIONS**. Opus
independently downloaded and decompressed the 321MB primary file itself and
found FOUR real defects: (1) the parser gap described in §1 (missed
Brabec's confirmed dozorčí-rada seat entirely); (2) Bendl's
`role_valid_from` wrongly set to his board-seat start, ignoring an earlier
continuous dozorčí-rada seat; (3) a false claim that
`vymazDatum=2002-12-31` was "a different person's re-filing" — it is
actually a bulk administrative register strike affecting six officer
entries simultaneously (Opus counted them directly); (4) an **unsupported
"mayoral ex-officio public appointment at a Praha–Kladno rail SPV"**
narrative behind `tie_class: "steward"` — PRaK's own Předmět podnikání
(ordinary trading/engineering/advertising) has zero rail/transit/municipal
keywords, and Bendl's seat dates don't even align with his actual mayoral
term (seat starts before, outlasts after). **All four corrected** — see §3,
v2 payload.

**Pass 2 — the two general-sweep closures (Černochová/Komwag,
Ženíšek/Pojišťovna VZP).** Verdict: **PARTIAL, both, WITH CORRECTIONS**.
Opus independently fetched ARES VR's own live endpoint for both IČOs and
found the v1 reviewer_note's central justification — "ARES VR (live
snapshot) did not see this match, dataor's bulk history caught it" — is
**FALSE**: ARES VR's live JSON demonstrably carries both memberships
already. The real cause of why the money loop's earlier (batch-002)
ARES-VR reconciliation marked these ties "conflicting" was NOT
re-diagnosed this batch (flagged as an open item, not swept under the
rug). Opus also caught that Černochová's tenure was understated (the
record holds 4 consecutive terms, 2007–2021, not just the last one,
2019–2021) and that Ženíšek's bare `role: "člen"` needed its organ
qualifier restored (`člen statutárního orgánu`). **All corrections
applied** — the extractor gained an `organNazev` field, the corroboration
script now merges ALL birth-date-matched terms per person, and the false
ARES-completeness claim was replaced with an honest "cause not
re-diagnosed this batch" note. Re-run confirmed: Černochová now
`2007-03-12→2021-12-20` (4 terms), Ženíšek's role now reads
"člen (člen statutárního orgánu)". **Byproduct lead** (Opus, not gated):
Ženíšek also appears in the same file as a `DOZORCI_RADA_CLEN` at CONTACID
a.s. (IČO 26360934), 2004-2007 — not in the graph, not proposed, logged as
a lead for a future batch.

**Both Opus passes earned their keep exactly where the kernel predicts** —
neither defect was a fabrication from thin air; both were plausible-sounding
overreach on top of a real finding (a genuine PRaK match with an invented
motive narrative; genuine matches with a false claim about why the primary
source "missed" them). This is the third consecutive batch (004, 005, 006)
where independent Opus re-derivation from the primary source caught a real
defect a Sonnet-only pass had accepted.

## 6. `npm run check` status

`npx tsc --noEmit` clean across all touched files. `npx vitest run` →
**266/266** (264 before this batch's own regression-test additions; 205 at
batch-005 close — some growth is concurrent sibling fleet work). Scoped
`eslint` clean on all touched files (2 empty-catch-block fixes applied
during the build, per the repo's `no-silent-catch` rule). `PGLITE_PATH=
./.pglite-copy-money-b6 npx tsx scripts/case-loops/money/validate-batch006.ts`
→ **ALL 3 payloads validate cleanly** (30/30 corroboration proposals, 2/2
PRaK edge re-points, 55/55 owns_stake proposals — see command in §7).

## 7. Lessons learned

1. **A dataor field-completeness assumption cost a real match, twice
   discovered by Opus, not by the driver's own review** — first the parser
   gap (missing `*_CLEN` codes), then a false claim about WHY ARES VR
   "missed" a match it actually had. Both were caught only because Opus
   independently re-derived from the primary source rather than trusting
   the script's own narration — the SAME lesson batch-005 recorded for
   cross-batch prose, now shown to apply within a single batch's own tool
   output too.
2. **A driver must not end its own run "waiting" on background processes**
   — this batch's first attempt at Job A/C dispatched long-running fetches
   to the background and then genuinely stopped issuing tool calls to await
   notifications, which the kernel's "a driver never ends its run waiting"
   rule (docs/case-loops.md) explicitly forbids; a monitor loop is not a
   substitute for finishing the work in-session. Corrected by the
   orchestrator's intervention: killed the stalled background tasks,
   switched to bounded-timeout foreground execution (`Promise.race` with a
   25s cap on any not-yet-cached large file), and finished synchronously.
3. **CSV/text parsers over real bulk-export files need index-based
   scanning, not character accumulation** — the first `parseDataorCsv`
   version OOM'd at 4GB heap on a real 321MB file; `.slice()` +
   `indexOf()`-driven row reading fixed it and is dramatically faster.
4. **A single large court×form file can stall an entire batch** if fetched
   naively — `sro-full-praha-2026` (~225MB gzipped) repeatedly failed to
   transfer within reasonable time over this session's connection (curl
   direct download hit ~150-250KB/s in places, worse than other same-size
   files that transferred in seconds). **Retry command for the
   orchestrator/next batch**:
   ```
   curl -sS -L "http://dataor.justice.cz/api/file/sro-full-praha-2026.csv.gz" -o .dataor-cache/sro-full-praha-2026.csv.gz --max-time 1800
   curl -sS -L "http://dataor.justice.cz/api/file/sro-full-brno-2026.csv.gz" -o .dataor-cache/sro-full-brno-2026.csv.gz --max-time 1800
   # then decompress each into .dataor-cache/<id>.csv (plain text, matches fetchDatasetCsv's cache convention), e.g.:
   node -e "const z=require('zlib'),f=require('fs'); for (const id of ['sro-full-praha-2026','sro-full-brno-2026']) f.writeFileSync('.dataor-cache/'+id+'.csv', z.gunzipSync(f.readFileSync('.dataor-cache/'+id+'.csv.gz')))"
   ```
   Once cached, re-running `dataor-corroborate.ts` picks both up instantly
   and resolves all 5 `fetch-incomplete` ties: Bauer↔TAMPA, Okamura↔MIKI
   TRAVEL, Kučera↔Sirius Praha, Šafránková↔Pražská VŠPS (all
   `sro-full-praha-2026`) and Jurečka↔AGRO 2000 (`sro-full-brno-2026`).
5. **The `nevlad_org` legal-form slug guess is unverified and often
   wrong** — 4/4 times it was tried for a z.s./spolek entity this batch,
   the resulting dataset existed but did NOT contain the target IČO. dataor's
   catalog lists several NGO-adjacent slugs
   (`nevlad_org`/`pobspolek`/`z_pobocny_spolek`/`zaj_sdr_po`/`p_nevlad_org`)
   without documenting which maps to which ARES `pravniForma` code — this
   session did not have time to brute-force test each. Flagged for a
   future batch, not silently left as "resolved."
6. **A structural negative is worth checking, not assuming** — the 9
   `not-isvr-registered` closures this batch are genuine "this cannot be
   answered by this source" findings, verified live (ČESKÁ TELEVIZE's ARES
   subject record has no `"vr"` sub-record at all), not an unexamined
   inheritance from the prior "registry-unconfirmed" label.

## Metrics block — batch 006

| metric | batch 006 |
|---|---|
| dataor adapter | built + 21/21 tests (real captured fixtures), one real extraction bug found by Opus + fixed mid-batch |
| Job A — open ties processed | 30/30 (32 total minus 2 PRaK, handled separately) |
| Job A — closed (registry-confirmed) | **2** (+2 more via Job B = **4/32 total, 12.5%**) |
| Job A — structural negatives (not ISVR-registered) | 9 (verified, not assumed) |
| Job A — incomplete (network budget) | 5 (honest gap, retry command in §7) |
| Job B — PRaK (Q-money-7) | **CLOSED**, v2 after Opus corrections, 2 edges re-pointed |
| Job C — owns_stake proposals | 55, across 19 new parent-company nodes, 195 companies considered |
| Job C — AGROFERT chain found | yes (2002-2005 span; post-2017 trust-fund transfer NOT found, flagged as a lead) |
| Opus verification passes | 2 (PRaK: WITH CORRECTIONS, 4 defects fixed; general sweep: PARTIAL×2, 3 defects fixed) |
| tests | 266/266, tsc clean, eslint clean |
| commit | none (fleet rule) |
