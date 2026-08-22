# /hlasovani — VoteTrack

`/hlasovani` — **VoteTrack** (features/votetrack): fusion of all three
prototype variants — Deník (chronological ledger as master), Sál (sticky
chamber detail: hemicycle + party breakdown it drives), Linie (club
discipline board, line matrix, rebellion chronicle). Feeds pillars
Aktivita/Docházka/Nezávislost; pure vote logic in `lib/civic/votes.ts`.
**The record has a warm path (2026-08-10).** `ledgerRead.ts` is the ONE
row→input projection both loaders share; the 406 k-ballot derivation carries a
cross-request memo on `MONEY_MEMO_TTL_MS` (imported, never re-declared) and the
page streams shells while the first cold read runs.
**The chamber checks itself (2026-08-10).** `record/reconcile.ts` (pure,
fixture-tested) compares OUR recount per roll call against the Chamber's own
published tallies (`vote_event.yes/no/abstain/notVoting`, read nowhere before):
pro↔yes, proti↔no, merged K↔abstain+notVoting; `away` is deliberately
uncompared (the source publishes no column). A discrepancy is a FINDING —
counted, worst example named with its psp.cz address, never repaired (the
impossible-dates precedent); missing columns are uncompared, never guessed
zeros. /kompas reads `vote_tag.confidence` it used to drop: `MIN_TAG_CONFIDENCE
= 0.7` in `kompas/select.ts`, printed as a LIVE value in the published rule;
equal-to-floor passes, a missing confidence is kept (a missing value is not a
low value) and both counts are disclosed.
**Anchors land (2026-08-10).** `sortValidNewestFirst()` is exported from
`record/derive.ts` so the kompas measures `inLedger` against the SAME ledger
window /hlasovani draws — a question outside it says so and links psp.cz
instead of a silently dead `#h-` anchor (the rebellionRecord `appHref`
pattern). Ledger rows carry the shared `CopyLinkButton` (row demoted from
button to wrapper — no nested buttons); navModel lists the five REAL sections
incl. `#seismograf`; theme rows format via `useFormat`, link their psp.cz
record and disclose the 80-row cap; the kompas ShareButton guards
`navigator.clipboard` so the failure copy is reachable.
`features/votetrack/messages.test.ts` pins the namespace (cs/en parity, ICU +
t.rich tag parity, Czech gate).
**The kompas rides the record (2026-08-11).** `getKompas`'s private memo cell
(its own clock beside `getVoteRecord`'s — the exact two-vintages hazard
`ledgerMemo.ts` names) is DELETED. `VoteRecordData.voteIndex` is the record's
own per-VALID-vote index (chamber tally · club lines · the event fields the
kompas renders · `inLedger`) — zero extra derivation passes, chronicle-cap
independent by an explicit `chronicleCap.test.ts` ruling, and the ONE field
`toWireRecord()` strips before /hlasovani's client (746,7 kB that page draws
nothing of). `selectQuestions` takes the index, so the kompas knows its ~20
roll calls without reading a ballot; the named votes come through the new
scoped `listVoteBallots({voteIds})` (`vote_ballot_vote_idx`, unused since the
first DDL: bitmap index scan, 4 000 rows / 29 ms vs 406 000 / ~7,5 s — the
small-LIMIT planner hazard does not apply when the predicate itself is
indexed). Measured: cold 14 283 → 922 ms; after a warm /hlasovani 19 294 →
6 ms. Selection equivalence proven over all 2 014 live roll calls (0 tally,
0 club-line mismatches), pinned by `kompasIndex.test.ts`. Tags are read FIRST
(found live: `vote_tag` = 0 rows — the silver layer is empty, so /kompas paid
~15 s per request to answer „unavailable"; populating tags is an un-owned
batch job, flagged). All four selection floors now count their casualties
(„no ballots held" ≠ „few voted"), and an empty selection renders its own
sentence instead of the outage state.
**A never-computed layer is not an outage (2026-08-12).** `vote_tag` = 0
rows means OUR derived theme layer was never computed, and both surfaces
used to file that under outage. `features/votetrack/silverLayer.ts` is the
typed third state (`null` = outage · `{state:"never-computed"}` ·
`{state:"ready",data}`), and the middle state may only arise AFTER a
successful `getStore()` — `readVoteTags()` returns `[]` without a store,
which is exactly how an outage could masquerade as an uncomputed layer.
/kompas renders `KompasNeverComputed` (what the layer is, that it is NOT an
outage, no promised date, no pipeline jargon); /hlasovani's `#temata` rail
anchor finally lands on a sentence instead of a silent spacer, and the
kompas CTA switches copy AND tone over an empty layer instead of inviting
„spočítejte si shodu" into it; `app/kompas/loading.tsx` stops promising a
seconds-long read unconditionally. The `loaders.test.ts` pin that asserted
silent hiding as the contract was moved deliberately, stated in the commit.
**The seismograf measures honestly (2026-08-12).** The hero instrument
clamps BOTH axes (`Math.min(1,…)` — deviation full-scale 0,5, rebel spikes
saturate at 40/day) and a comment claimed the clamp was „disclosed by the
axis caption" while the only caption was `aria-hidden`; both scales now
print under the instrument (`record.seismoScale`, constants interpolated)
and the comment tells the truth. Four falsifiable method literals became
live values (`MATRIX_WINDOW`, `STRONG_DISCIPLINE_PCT`, `MIN_CLUB_POSITIONAL`,
the mock sample length via `ROLL_CALLS.length`); a shorter-than-window
ledger gets its own sentence. The chronicle and the rebel board carry their
POPULATIONS, counted BEFORE the slice (`chronicleTotal` 1 301 live,
`topRebelsTotal` 203) — „24 rows" no longer reads as „24 rebellions ever".
The messages pin is a shape rule over the whole `record.*` namespace with
ZERO exemptions, falsified twice.
**The record can be read with a keyboard (2026-08-13).** `features/votetrack`
had ZERO `role=` and zero live regions — a larger surface than /zebricek, which
had passed the same set two days earlier. The ledger and both rebellion lists
were streams of bare `<div>`s and are now named `<ul>`/`<li>` (the /denik
shape). **They are deliberately NOT tables, and the refusal is pinned WITH its
reasoning**: a ledger row is a stacked card wrapping a `<button>` and a
`CopyLinkButton`, a chronicle row is a SENTENCE, and a rebel row is one
whole-row `<Link>` — `role="row"`/`"cell"` would either swallow the button's
role or declare the row one cell, a table in appearance only.
`LeaderboardTable` IS a table precisely because its link sits INSIDE a cell
around the name; copying that here would shrink the click target from the row
to the name, which is a layout change, not an a11y fix. The one real grid, the
line matrix, got the full treatment (`scope="col"`, club as `<th scope="row">`
— it was a `<td>`, so a screen reader read only a date and a bare number in
every cell — and an `sr-only` `<caption>`). Bare numbers got subjects and the
▲/▼ glyphs got words (they carried the club LINE in a glyph alone); the dash is
a CLAIM („the club had no line"), not an empty cell. Text is hidden VISUALLY,
never removed from the DOM (the round-12 rule), pinned by a check that
TOKENIZES classNames — a flat `\bhidden\b` would flag legitimate
`overflow-hidden`. Selection and the theme count each announce through exactly
ONE live region placed OUTSIDE the panel that remounts (the DuelStatus
precedent: a live region inside a remounted panel is destroyed before it is
read), and the empty state moved OUT of the list it contradicts — it was an
`<li>` asserting the list had no items. The seismograf drew one `<button>` per
sitting day (~74 tab stops over the real record, none with a focus ring): now
ONE tab stop, arrows walking the day axis through the IMPORTED
`features/dashboard/graphTraversal.ts` (a perpendicular direction has no
neighbour and so does NOTHING, rather than wrapping to the far end), Home/End,
native Enter/Space, and the pattern PRINTED on the surface — as a plain `<p>`,
not a `SourceNote`, because the brand rule binds citations to NUMBERS and that
line carries none. Every `<section id>` the rail targets now has an accessible
name, pinned in BOTH directions. `features/votetrack/a11y.test.ts` (30 tests)
pins the wiring by source-grep with the jsdom gap stated in its header, and
**51 source mutations were run against it, 51 caught**; two assertions passed
their own falsification, were therefore too loose, and were tightened.
**The record says how many votes were needed (2026-08-13).** `vote_event` has
carried `quorum` and `present` since the first migration — ingested
(`lib/ingest/sources/psp.ts:331-332`), stored, mapped, quality-scored — and the
ONE projection into the product, `toEventIn()` in `ledgerRead.ts`, dropped
both, in a doc comment that calls itself *„the only place in the application
where `vote_event` columns are read"*. Measured over `hl-2021ps.zip` (9 016
roll calls): **0 nulls in either column**, `quorum === floor(present/2)+1` for
8 984 — and the **32 exceptions carry quorum 101 (31×) and 120 (1×)**, i.e.
absolute- and constitutional-majority votes, **which no other stored column can
reconstruct**. `features/votetrack/record/threshold.ts` is the pure rule and
holds five: source columns pass through LITERALLY including `null`; the
threshold is **never derived from `present`** (a `quorum ?? simpleMajority`
fallback would make „the threshold is not a simple majority" a definitional
impossibility — falsified directly by test); the margin rests on the published
„pro" and the published threshold, i.e. two columns of the SAME row, so our
406 000-ballot recount never enters it (that comparison is `reconcile.ts`'s
job); `differs` has THREE states, because „not assessed" is not „does not
differ"; and a differing threshold is **a fact, not a legal category** — the
page prints what the simple majority would have been and names no statute.
The finding carries its population (`coverage.withoutQuorum` /
`.thresholdComparable` / `.thresholdDiffers`, counted over `valid`, not over
the 48-row window — the exceptions are ~0,35 % of the corpus, so a reader would
otherwise never meet one). `present` is the chamber's figure for that roll
call and the copy forecloses reading it as an MP's attendance. Wire ruling:
`LedgerVote.threshold` ships (5 040 B raw / ~136 B gz over the window, all of
it drawn) and `voteIndex` is untouched — the kompas needs no threshold;
`chronicleCap.test.ts` carries the explicit written ruling that both new
locations ride INSIDE `ledger`/`coverage`, so the pinned whole-type list is
unchanged, with fixtures given an ALTERNATING threshold so the assertion has
something to fail on.
