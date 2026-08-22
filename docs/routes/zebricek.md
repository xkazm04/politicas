# /zebricek — CivicScore

## Current contract

**Routes** — `/zebricek` (leaderboard · party filter · name search · reader
lens · Souboj duel) · `/kraj` + `/kraj/[kraj]` (printable regional slate) ·
`/referendum` + its OG card (re-weigh the index) · `/metodika`
(→ [metodika.md](metodika.md)). `/poslanec` and `/dashboard` ride the same
chamber pass.

**Reads** — `features/civicscore/getLeaderboardData.ts` → `buildLeaderboard()`:
`react.cache()` per request **plus** a cross-request memo on the imported
`MONEY_MEMO_TTL_MS` (never re-declared; neither `null` nor an EMPTY chamber is
memoized). Every read uses `KG_READ_CAP` — a small `limit` makes PGlite walk the
`kg_node` primary key instead of `kg_node_kind_idx` and scan ~154 k rows.

**One definition, never forked** — if you need one of these, import it:

| Concern | Owner |
| --- | --- |
| The formula, its weights, its saturation caps | `lib/analysis/contribution.ts` (`CONTRIBUTION_WEIGHTS` · `CONTRIBUTION_FORMULA_REF`) |
| Component labels, order, per-component psp.cz citations | `componentDefs.ts` |
| Chamber-wide `{pass, ref}` aggregate | `provenance.ts` (`summarizeContributionProvenance`) — **never** the first node iterated |
| The citable composite claim | `scoreClaim.ts` |
| Published weight vector as text | `PUBLISHED_WEIGHTS_LABEL` (`lens.ts`) |
| Duel outcome + compared facts | `duel.ts` · `duelFacts.ts` |
| Duel and lens addresses | `duelParam.ts` · `useLensWeights.ts` (`lensAddress`) |
| Diacritic-folding search | `search.ts` → `asciiFold()`, the ingest's own function |
| Club display names and colours | `CLUB_DISPLAY` (`lib/civic/data.ts`) |
| Verdict copy (low score · workhorse · rapporteur · tenure) | `lib/analysis/*` — message KEYS, translated at the render site |
| Poster citation footer | `features/shared/poster/citation.ts` |

**Formula discipline.** A formula-changing edit MUST change
`CONTRIBUTION_FORMULA_REF`, and the ref is **not applied until a recompute has
re-stamped every person node** —
`scripts/data-analysis/kg-contribution-recompute.ts`, which refuses to write
unless replaying the OLD formula reproduces every stored value first.
`kg-contribution-ingest.ts` refuses `--commit` over a node whose stored ref
differs (`--supersede` is the human override). The loader reports a
half-recomputed store as `mixed` with no single pass number, and compares the
store's ref to the code's (`formulaMatch`); every surface that prints a score
renders that mismatch as a sentence rather than an error page. Four sentinel invariants judge the same
thing (`lib/testing/sentinel/`), reachable only via `npm run sentinel`.

**Standing rules.** Ranks are COMPETITION ranks — a shared rank is stated, never
broken by reordering, and never coloured as a win. A lens-weighted score is
never minted as a claim: under a reader's own weights the number stands nowhere
in the graph. No term digit, weight vector, MP count or methodology version is
typed as a literal in copy or code — `messages.test.ts` fails on the shapes. A
missing input renders as missing; `num()`'s zero never stands in for an
un-ingested prop.

**Live state** — 207 MPs, `PSP10`, pass **42**,
ref `contribution-committee-dedupe`, 207/207 coverage, `formulaMatch: true`;
55 of 207 MPs share a rank across 25 groups.

## Dated record

`/zebricek` — **CivicScore** (features/civicscore): leaderboard — score
histogram + chamber summary, party filter + name search, mini
weighted-breakdown bars per row, and Souboj (pick two via "vs" → mirrored
comparison). **Wired 2026-07-24 to the real graph** (`getLeaderboardData.ts`):
all **207 real MPs** ranked by `contribution_score`, broken down into the
index's **6 exposed components** (participation/committee/legislative/speech/
attendance/leadership) — not the 4 mock pillars. No fabricated quarterly
delta/trend (single term). Fallback when the store is unavailable:
`lib/civic/leaderboard.ts`, a deterministic test-pinned mock generator (still
feeds `/dashboard` chamber aggregates).
**Ranking correction 2026-07-29 (graph pass 42)** — the index's committee term
counted psp.cz membership ROWS, and psp.cz files a body an MP LEADS as two
rows, so chairing one committee could outrank sitting on two. It now counts
DISTINCT BODIES (role weighting untouched — `leadership` still pays its full
10 points). 33 MPs lost points (220,1 index points; saturated set 158 → 131)
and 184/207 printed ranks moved. Stored rates were republished at 3 decimals
in the same pass, so the six displayed parts now sit within 0,1 of the
composite instead of 1,6. Recompute path:
`scripts/data-analysis/kg-contribution-recompute.ts` — merge-preserving, and
it refuses to write unless replaying the OLD formula reproduces every stored
value first. Details in `docs/data-analysis/graph-log.md` (pass 42).
**The formula changed 2026-07-29; the STORE was only corrected 2026-08-04.**
The recompute was written, audited (`docs/data-analysis/contribution-pass42-audit.json`,
207 rows) and never run with `--commit` — so for six days the code counted
distinct bodies while every person node still carried pass-11 scores written by
`kg-contribution-ingest.ts`, and `/zebricek` served the PRE-correction ranking
under a comment claiming otherwise. Caught by rendering `provenancePass` on the
page, which printed 11. On 2026-08-04 the recompute ran: its replay gate
reproduced the old formula for 207/207 MPs (proving nothing had touched the
scores in between), and the re-generated audit is byte-identical to July's on
all 207 rows — only `computedAt` moved. Every node now carries
`contribution_provenance = {pass: 42, ref: "contribution-committee-dedupe"}`.
**The lesson is the check, not the fix: a formula correction is not applied
until the DATA carries its provenance ref, and nothing in the suite could see
the difference.**
**The formula has a name (2026-08-04).** `CONTRIBUTION_FORMULA_REF` in
`lib/analysis/contribution.ts` is the ONE declaration of the formula's identity,
and its contract is: a formula-changing edit must change the ref, and the ref is
not applied until a recompute has re-stamped every person node. Both writers now
IMPORT it — `kg-contribution-ingest.ts` used to stamp the literal `"contribution"`
(a ref frozen at pass 11), so a re-run would have downgraded the declared lineage
below the formula that scored the nodes; zero ref literals remain in `scripts/`.
The loader aggregates `{pass, ref}` over ALL 207 person nodes
(`features/civicscore/provenance.ts`, pure + tested) rather than reading the first
node it iterates: a half-recomputed store is reported as `mixed` with no single
pass number instead of one confident figure, and the store's ref is compared to the
code's (`formulaMatch`). `/zebricek`, `/poslanec`, `/kraj` and the poster citation
each render the mismatch as an honest sentence — „žebříček spočítala starší verze
metodiky" plus both refs — not an error page. Measured on the live store today:
uniform, pass 42, `contribution-committee-dedupe`, 207/207, `formulaMatch: true`.
**The sentinel can see the divergence now (2026-08-04).** `lib/testing/sentinel/`
read only `contribution_score` and asserted it was finite, while `checkDeterminism`
compared the store to ITSELF — a stale store is perfectly self-consistent, which is
why six days of a wrong ranking looked healthy. `facts.ts` now also collects each
person's `{pass, ref}` and the stored inputs the formula consumes, and four
invariants judge them: **formula-ref** (every ref === `CONTRIBUTION_FORMULA_REF`),
**provenance-uniformity** (the chamber agrees on one `{pass, ref}` — a half-applied
recompute publishes one ranking from two formulas), **components-sum** (the six
components reconcile with the composite) and **recompute-sample** (the REAL
`computeContribution` re-run over 40 MPs' stored inputs, deterministic stride over
id asc — no clock, no RNG). Tolerance is ±0,1 and it is not slack: the composite was
scored from RAW ratios while the store publishes them at 3 decimals, measured at
exactly 0,1 on 13/207 today and 0 above; a pass-11-era store (rates at 1 decimal)
blows straight through it. `sentinel.test.ts` reconstructs that pass-11 store and
proves formula-ref AND recompute-sample fire on it. Live run 2026-08-04: **all 11
invariants PASS**. The sentinel stays strictly read-only (SELECT only, over a copy).
**`npm run sentinel` is the only path on which these actually execute** —
`.github/workflows/sentinel.yml` has no `./.pglite` on a hosted runner; there is no
nightly (the cron was removed 2026-08-05), and a green sentinel is not coverage.
**„Nevyhodnoceno" není „splněno" (2026-08-13).** The instrument built because a wrong
ranking shipped for six days could not itself distinguish *checked and clean* from
*never looked* — three ways. `SentinelCheckStatus` was `"ok" | "violation"` with no
third state, so `report.ts` rendered every non-violation as `PASS`. **Erasing the whole
tamper-evident audit chain scored GREENER than altering one row of it**: every chain
read filters `where chain_pos is not null`, so `update review_audit set chain_pos =
null` emptied the filtered set and the invariant returned „chain is empty — trivially
valid"; tamper with ONE row and it fired. And a dispatched workflow on `ubuntu-latest`
produced a **green job with zero invariants evaluated**, because the run step was
gated on a guard and a *skipped* step does not fail a job — the header claimed the
guard was „a loud no-op instead of a false green"; it was a quiet one that read as a
pass. Now: `unevaluable` is a first-class status and `sentinelVerdict()` is the ONE
derivation from checks, read by the evaluator, the store-unreadable path AND the
parser's consistency gate, so a report can never carry a headline its own rows
contradict. The chain invariant compares chained rows against the WHOLE `review_audit`
(`LedgerRepository.countReviewAudit`, read BESIDE `verifyReviewChain` rather than
widening its query): `chained < total` is a violation naming both counts, `total === 0`
is `unevaluable` — an empty ledger proves nothing about tamper-evidence and is not a
pass. `checkFreshness` NAMES the `ingest_run` sources carrying no declared cadence
(not a violation — no promise was broken — but never invisible again). `run.ts` writes
a schema-valid all-`unevaluable` report on the unreadable path too, keeping exit 2, so
„ran and passed" and „never ran" no longer leave the same (empty) trace. The workflow's
run step is now UNCONDITIONAL with the artifact uploaded `if: always()` on both
branches, and `node-version` moved 22 → 24 — the job would have died at `npm ci` before
ever reaching the sentinel (`ci.yml:19-22` documents why). `SENTINEL_SCHEMA` stays `/1`
deliberately, reasoned in the constant's own doc comment: the change is additive at the
wire and old artifacts still parse. Verified live on this machine: exit 2, 11 `[UNEVAL]`
rows, `verdict: "unevaluable"`, „**0 of 11 invariants could be evaluated; this run
proves nothing about the data (it is not a pass)**". Falsified: with the old
`chain.length === 0` branch restored, a store with rows and every `chain_pos` nulled
returns `ok`. **Still uncovered and recorded as the next item here: the money and law
layers have ZERO invariants** — grep `lib/testing/sentinel/*.ts` for
`review_state|tie_class|supplies|amends` and nothing answers, so a mass
`pending_review → verified` flip across the 211 ties, a `tie_class` blanking, a
negative `supplies` weight inflating a published CZK total, or a mass blanking of the
141 forensic verdicts all pass all eleven checks.
**A writer cannot regress a correction (2026-08-04).** `kg-contribution-ingest.ts`
re-derives scores from live psp.cz dumps; run over a store the recompute has
corrected it would have replaced that correction with fresh numbers under a commit
whose stated subject is an ingest. `--commit` now REFUSES over any node whose stored
`contribution_provenance.ref` differs from the ref it stamps
(`guardContributionWrite`, pure + tested); the refusal names both refs and points at
the recompute, `--supersede` is the explicit human override, dry-run is never blocked
and always prints the verdict. The rule is **equality, not lineage ordering** — both
writers stamp `CONTRIBUTION_FORMULA_REF`, so a differing ref means a formula this
build does not implement, in either direction; `pass` cannot rank them (any unrelated
enrichment advances it). The recompute needs no such guard — its replay gate is
strictly stronger. The ingest also states on every commit that it does NOT touch
`contribution_psp9`; the recompute owns that baseline. The recompute's `legacyScore`
moved to `lib/analysis/contribution-legacy.ts`, labelled FROZEN with its own tests:
its `/4` and `/40` are deliberately literals, never the live saturation constants,
because a proof gate that follows the formula it is proving proves nothing.
Found while verifying the guard: `kg-contribution-ingest.ts` could not run at all on
the live graph — `Math.max(0, ...nodes.map(…))` spread ~153 700 arguments and threw
`Maximum call stack size exceeded` before reading a score. Now a `reduce`.
**The score is citable (2026-08-04).** `features/civicscore/**` held ZERO claim
refs — the platform's flagship number was the one number nobody could cite, while
being the best-provenanced thing in the store (207/207 nodes carry
`contribution_provenance`, the code declares `CONTRIBUTION_FORMULA_REF`, /metodika
prints the formula). `scoreClaim.ts` (pure) mints ONE claim on the COMPOSITE —
`claim:psp.cz — příspěvkový index:prispevkovy-index:psp:person:<pspId>` — rendered
on every /zebricek row and on the /poslanec header, and re-derived at /overeni
through `getLeaderboardData()`, the loader that owns it. Four decisions worth
keeping: (1) the six components are NOT minted — six more addresses would dilute
the one people actually quote; (2) the pass and formula ref ride INSIDE the claim
as `derivation` (`contribution-committee-dedupe@42`) taken from the CHAMBER-WIDE
aggregate, so a `mixed` or `absent` store mints NO basis rather than picking one —
and a pasted claim whose basis differs from today's answers **`moved`, naming both
passes**, even when the number is identical (this is the pass-42 case at the
citation layer); (3) the index is `ungated`, a new `ClaimReviewStatus` — it is a
deterministic recomputation and „čeká na kontrolu" would promise a review nobody
is preparing; (4) the LENS score is deliberately not minted: under a reader's own
weights the number stands nowhere in the graph. `AnimatedScore` grew an optional
`claim` (attributes carry the TARGET value, never an animation frame).
Verified on the live store: Karel Haas (6751) verifies at **96,8** from a bare ref
and a pasted element; −0,7 answers `moved/value`; the same 96,8 stamped
`contribution@11` answers `moved/basis`; an MP outside the chamber answers
`zaznam-nenalezen`. Measured cost: **zero new wire fields** (the claim is built
client-side from `pspId` + `score` + the provenance aggregate, all already on the
wire); the HTML attributes over all 207 rows are **81 710 B raw / 2 534 B
gzipped**, and warm `buildLeaderboard()` is unchanged (194 ms).
**Ties are ties (2026-07-29)** — ranks are now COMPETITION ranks (1, 2, 2, 4):
a rank is one more than the number of MPs who score higher, so it is shared on
an identical score and the red top-3 can no longer be won by Czech name
collation (Vesecká and Malá, both 95,4, printed ranks 2 and 3). 55 of 207 MPs
share a rank across 25 groups; the display order inside a tie is still the
name collation and the page states that it means nothing. `LeaderboardEntry`
carries `tiedCount` so a surface can SAY a rank is shared without reordering
anything. The duel no longer crowns a winner on a zero difference or colours
one where both sides print the same number (`features/civicscore/duel.ts`,
pure + tested); histogram bands are labelled with the bound they actually run
to (`65–70`, half-open) and the band CONTAINING the median is coloured
separately from the bands below it; `σ` is named a standard deviation.
**The read path is capped and indexed (2026-08-04).** `buildLeaderboard()` no
longer carries ad-hoc numeric limits — every read uses `KG_READ_CAP`, like
/penize and /poslanec. This is not tidiness: a SMALL limit makes PGlite walk
the `kg_node` primary key and filter by kind instead of using
`kg_node_kind_idx`, so it scans the whole ~154 k-row table until it has
collected N matches. Measured on the live store (3 rounds):
`listKgNodes({kind:"party", limit:30})` cost **498/632/723 ms** for 8 rows and
**2,4/2,9/41,7 ms** at the cap. `storeReady()` had the same shape — it probed
`listKgNodes({kind, limit: floor})`, which cost 419–692 ms for `person` and
tripped the truncation guard on every healthy call (a probe that reads exactly
its own limit is precisely what that guard cannot tell from a truncated read);
it now asks `kgKindCounts()` (one indexed group-by, 237–380 ms, answering every
kind at once) and keeps the old probe only as a fallback for hand-built test
stores. Net: **warm `buildLeaderboard()` 1 113–1 312 ms → 444–522 ms**, with the
list payload byte-identical (81 179 B for all 207 MPs).
`listOrgans`/`listPersons`/`listMandates`/`listMemberships` in
`lib/db/pglite/repositories/graph.ts` now carry the same `warnIfTruncated`
guard the kg listers do (it moved to `lib/db/pglite/internals.ts` so both
sides share ONE definition) — the organ read was sitting 210 rows from a
silent cliff at 1 790/2 000.
`trend` and `effortPublicRole` left `LeaderboardEntry` for `ProfileOnlyFields`
/ `toProfileEntry()`: the chamber pass computed them 207× per request (29 ms
measured) for the one profile page that reads them, and the full payload
dropped 296 473 → 121 144 B.
Name search folds diacritics through `asciiFold()` — the SAME function that
fills `person.name_norm` at ingest — so „zacek" finds *Žáček*
(`features/civicscore/search.ts`, pure + tested).
**Three false claims retired (2026-08-04).** The page said *"Všech 207 poslanců
9. období"* while the loader reads `termCode: "PSP10"` — the TENTH term; it now
says so, consistently with `/kraj` and `TrendPanel`. It cited *"metodika v1.4"*,
which is the source string of the **deleted** mock 4-pillar dataset
(`lib/civic/data.ts`) — the real six-component index carries no version number
at all, so the claim is gone and what the data DOES carry is rendered instead:
`provenancePass` (`contribution_provenance.pass`, **11** on the live graph), the
computation that authored the scores. And the dossier note said *"dosud
probíhá"* regardless of count while coverage closed at **207/207** (batches
006/007) — it now states completion, and the dossier FILTER + per-row icon
render only while coverage is PARTIAL (a filter that selects every row and an
icon on every row distinguish nothing; both stay live if the chamber grows).
`features/civicscore/messages.test.ts` pins all of it: cs/en key parity, ICU
placeholder parity, no `9. období`, no `v1.\d`. The five dead `civicscore.*`
keys with zero call sites (`distributionSource`, `allSource`, `mockNote`,
`componentLegendNote`, `legendWidthNote`) are deleted from both catalogs.
**The low-score correction reaches the ranking.** `effort_low_score_reason`
(closed vocabulary, `lib/analysis/low-score-reason.ts`) exists on **34 of 207**
person nodes and used to render only on `/poslanec` — so `/zebricek` printed the
chamber's lowest number beside an MP who relinquished the mandate before the
oath, with nothing next to it. `LowScoreReasonChip` puts it on the row in BOTH
densities, verbatim from the vocabulary (the app never rewrites it into an
excuse — `genuine_absentee`'s own copy says it is NOT a correction) and DATED
with `effort_provenance.computedAt`. The copy is pinned to the Czech language
gate by `lib/analysis/low-score-reason.test.ts`. Measured payload cost of the
two new list fields over 207 rows: 81 179 → 95 653 B raw, 7 450 → 7 909 B
gzipped.
**The Souboj compares facts, not only points (2026-08-04).** It used to compare
the composite plus the six weighted component point-values — the most abstract
numbers the app owns — because nothing else ever entered the /zebricek payload.
It now also compares, per fighter: **tenure class** (`effort_tenure_class`,
193 full_term / 7 replacement / 4 never_seated / 3 departed — printed ABOVE the
numbers because it is their precondition; a `never_seated` MP has an empty
record, not a low score), **floor speeches**, **written amendments**,
**interpellations** and **rapporteur load**, plus the workhorse / rapporteur /
low-score verdict copy reused VERBATIM from `lib/analysis/*` (no second copy
engine). Every fact reports in its OWN unit against the REAL chamber median —
`score-legibility.ts`'s convention, and literally its `median()` — computed
over the MPs that have a value, with that count printed. A fact missing for one
fighter renders `údaj chybí` and NOTHING is won against it (`factWinner`);
`num()`'s zero never stands in for an un-ingested prop. **Money is deliberately
not compared and the duel says so**: all 211 ties are `pending_review`, and
setting them against each other would turn an unconfirmed trail into a finding.
Rules are pure + tested (`features/civicscore/duelFacts.ts` + `.test.ts`);
`tenureClassLabel()` joined `lib/analysis/tenure-copy.ts` (all four classes,
language-gate pinned). Measured: list payload 95 653 → 120 264 B raw,
7 909 → 9 137 B gzipped; warm `buildLeaderboard()` unchanged at 424–519 ms; no
new store reads.
**Every verdict carries its date and its number (2026-08-04).** `WorkhorseBadge`
and `RapporteurBadge` asserted „tichý tvůrce zákonů" / „zpravodajský tahoun" with
no vintage and (on /zebricek) no count, while `LowScoreReasonChip` beside them held
the standard. Both are now DATED from `effort_provenance.computedAt` — the same
prop, written by the same pass, on the same node — and both carry the figure the
verdict rests on: the workhorse badge prints `speech_turns` (the low floor
visibility that is half its claim; ABSENT renders nothing, never a fabricated 0),
the rapporteur badge prints its distinct-bill count in BOTH densities, so a
zpravodaj of 3 and of 13 no longer look identical. Both surfaces (/zebricek row,
/kraj row, Souboj, /poslanec dossier). `LeaderboardEntry.effortLowScoreRecordedAt`
was renamed **`effortRecordedAt`** — it was always the whole effort-provenance date,
and the low-score-specific name is exactly why the two badges went undated for
months. MEASURED cost: **zero new payload fields** (the badges read
`duelFacts.speechTurns` and `effortRapporteurLoad`, already on the wire); the rename
alone shrank the list payload 118 748 → **117 092 B** raw, 9 624 → **9 590 B**
gzipped.
**The six components are ONE definition** — `features/civicscore/componentDefs.ts`.
Reader-facing Czech labels plus a per-row psp.cz citation cannot live behind
`server-only`: they were retyped as literals in FOUR test fixtures (kraj, lens,
referendum embed, referendum ogPayload) and their ORDER a fifth time in `lens.ts`
(`LENS_COMPONENT_ORDER`, with a comment saying the real list could not be imported).
Now every one imports it, and `componentDefs.test.ts` pins the weights to
`CONTRIBUTION_WEIGHTS` (never mirrored), the sum to 100, one distinct citation per
component, and every label + source to the Czech language gate.
**Two more reader-facing copy sets joined the gate**: `mandateNoteCopy` (all three
branches — only `tenureClassLabel` had been pinned) and the whole TrendPanel, whose
four Czech sentences were inline JSX literals owned by no engine. They moved to
`features/civicscore/trendCopy.ts` (pure + `trendCopy.test.ts`), and the „chybějící
složky" note now NAMES what `trend.pendingComponents` actually carries instead of
asserting „účast a docházka" regardless, and cites the `hl-2021ps.zip` dump only for
the term it belongs to.
**The printed sheet carries the same truth (2026-08-11).** `/kraj/[kraj]` —
the PRINTABLE slate — had dropped the honesty apparatus /zebricek carries;
the data was already on every entry. Now: `LowScoreReasonChip` on slate rows
(34/207 carry a reason; a relinquished mandate no longer prints a bare bottom
score on paper), `mixed`/`absent` provenance sentences on the page (same
keys, same aggregate — no second copy), and the citation footer suppresses
the pass number STRUCTURALLY for a non-uniform chamber
(`posterProvenanceNote()` in `features/shared/poster/citation.ts`, pure +
pinned incl. omitted-state byte-identity) — it used to print nothing, which
is indistinguishable from „carries no pass". The kraj score renders through
`CitableNumber` with the SAME `contributionScoreClaim` (imported, withheld
under a custom lens with the reason in the footnote); `RapporteurBadge`
joins compact + dated.
**The lens survives the drag and reaches the preview (2026-08-11).**
/zebricek's `generateMetadata` decodes `?vahy=` (referendum's own codec,
imported) and points OG at the EXISTING `/referendum/og` — an invalid vector
passes through raw so the generator emits its own „Neplatné váhy" card,
never a silently repaired one. The URL write moved from per-slider-step
(35–100 `replaceState`/drag; WebKit hard-fails >100/30 s and the reader
would share a lens-less link with no signal) to commit time:
`lensAddress()` is the ONE pure address composer (`useLensWeights.test.ts`),
`commit()` fires on pointerup/keyup/blur, presets stay one-click-one-write,
and `shareHref()` composes AND writes so the copied link and the address bar
cannot disagree mid-drag. /referendum finally links /metodika.
**The board stops asserting what the data don't carry (2026-08-12).**
`factsNoMoney` states the RULE (money is out of the duel by design; an
unconfirmed trail is not a finding) instead of „všech 211 vazeb čeká" — a
literal the first console decision falsifies; zero literal MP counts remain
in rendered civicscore copy (ICU params fed from `summary.count` /
`entries.length`; `allTitle` deliberately param-free — the nav rail feeds it
with no ICU params); club names stop truncating („TOP 09" no longer renders
„TOP") and the real path stops reading mock PARTIES: **`CLUB_DISPLAY`** in
`lib/civic/data.ts` (under the „KONEC UKÁZKOVÉHO KATALOGU" line) is the
declared NON-mock table of real registry clubs — display forms kept
deliberately (editorial typography over the registry abbrev, a Director
ruling recorded in 83cb8a9), colours live in that file because the lint rule
sanctions it as the home for data-driven colours. `messages.test.ts` bans
literal 207/211 and the absolute-gate-claim shape with NO allowlist;
`clubDisplay.test.ts` pins colour identity with the old table. votetrack's
`clubStyle.ts` reads the same table (the hemicycle wedges and discipline
board carried the identical truncation).
**The ranking reads as a table (2026-08-12).** role table/row/columnheader/
cell + a real header row over the 207 rows; the filter/search count and the
empty state announce (`role="status"`); compact mode keeps club/region
findable in the DOM (`sr-only`, never removal — pinned against regression);
every „vs" button names its MP; the Souboj is a labelled region with ONE
`DuelStatus` live region sitting OUTSIDE the AnimatePresence remount, and
both mirrored value grids carry sr-only subjects. No jsdom exists here, so
`a11y.test.ts` pins the wiring by source-grep — an honest gap, stated.
**The Souboj has an address (2026-08-12).** `?souboj=<a>-<b>` —
`duelParam.ts` holds the lens codec's exact contract (order-normalized so
A-vs-B ≡ B-vs-A, default pair → null so the clean address IS canonical,
malformed → null never repaired, `?vahy=`/foreign params/hash preserved by
the ONE `duelAddress` composer); `useDuelSelection` reads on mount +
popstate (never useSearchParams), writes `replaceState`, and scrubs a pspId
today's chamber doesn't carry — but ONLY when the chamber is known: an
unreachable store is not evidence an MP doesn't exist. The address is
COMPUTED at render (a stored one would desync whenever the lens writes
`?vahy=`); the copy affordance is the shared `CopyLinkButton`; selection
feedback is the DuelStatus line + a `#souboj` anchor link — never a forced
scroll (test bans `scrollIntoView`).
**The verdicts speak both languages (2026-08-12).** Four copy modules
(low-score-reason, workhorse-flavour, rapporteur-load, tenure-copy) held
hardcoded Czech in a bilingual product, so the EN locale rendered
concatenated half-Czech sentences („Vysoký podíl vlastní … na řečništi.
Floor speeches: 12."). They now return MESSAGE KEYS (the /overeni pattern):
key stems DERIVED from the vocabulary values, closed `*_COPY_KEYS` lists,
the Czech moved byte-for-byte into `verdicts.*` (41 keys, sample pinned),
EN complete, the language gate binding the cs side — including workhorse +
rapporteur, never gate-pinned before. `mandateNoteCopy` hands back ISO
dates so `lib/format.ts` formats per locale, and a malformed end date
selects a DIFFERENT sentence, never an empty slot. Fold-ins: `trendCopy`'s
5/6 dead exports deleted; `getLeaderboardData`'s second median deleted for
`score-legibility`'s export. **`componentDefs` is deliberately NOT
migrated**: its labels ride the cross-request-memoized chamber payload, so
translating in the loader would serve a cs-warmed memo to an EN reader —
the fix is the payload carrying KEYS and ~12 render sites translating
(incl. the referendum OG image); recorded as its own future direction.
/metodika's weights table therefore stays Czech-only in EN for now.
**The printed sheet and the shared card tell the truth (2026-08-13).** The two
most DURABLE artifacts this app emits were its least honest surfaces — paper and
a foreign timeline are never corrected after publication, so a lie lasts longest
exactly there. (1) `kraj.ts` typed the published weight vector
`25/20/20/15/10/10` into the poster citation. Batch 1D had removed that literal
from four surfaces and both catalogs and declared `PUBLISHED_WEIGHTS_LABEL` the
ONE source; this one survived because the guard scanned only the CATALOGS and
only the HYPHEN form — it went through both holes at once, on the page whose
whole premise is that the weights are re-weighable. The guard now scans SOURCES
too, across both roots that render the vector, both separators, and **asserts
each root contributed files** so a rename cannot silently mute it; falsified
four ways. (2) The route passed `new Date()` as „stav dat ke dni", so every
printout dated the moment of PRINTING over numbers from a batch recompute. The
`retrievedAt` prop is DELETED from both the route and `KrajPage` — there is no
path for today's date to get back in — and the day now comes from the chamber's
`ContributionProvenance.computedAt`, the same field the embeddable widget reads;
**the rule is not written a second time.** A chamber with no agreed day prints
NO date and says why (`posterUndatedNote`, routed through the methodology line —
the only footer field typeset verbatim). `PosterCitationInput.retrievedAt` is
`string | null`; `PosterCitation.retrievedAt` stays `""` as a documented
sentinel (`string | null` would break `PosterFrame`'s formatter call, and
silence without a sentence reads as a broken date) — the clean fix wants a
`shared.poster.undated` key and is recorded as a follow-up. (3) `/referendum`
and its OG card disclosed provenance NOT AT ALL (`grep -c` → 0 in both) while
six lesser surfaces render the aggregate — on the page that invites citizens to
re-weigh the index and mints a card from the result. The page now renders the
same four `civicscore.provenance*` sentences (no sixth copy) plus the
formula-mismatch line; the OG card carries day + pass only, and claims neither
when the chamber disagrees, because four sentences of prose do not fit legibly
beside six weight bars and five rows at 1200×630 — fewer claims beats
unreadable ones. (4) The referendum copy affordance was
`clipboard.writeText().then(ok)` with NO rejection branch — in an insecure
context the reader pressed it and nothing happened, not even a sentence; it now
rides the shared `CopyLinkButton`, which names the failure into a live region
and is bilingual where the old literals were not.
