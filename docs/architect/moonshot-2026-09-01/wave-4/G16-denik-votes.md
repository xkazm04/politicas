# G16 — roll calls in the deník (wave 4)

Card: deck #33. Registry: roll-call-vote-analysis (measured-deviation framing);
accountability-publishing-ethics / severity-free-factual-framing; laws
deterministic-code-owns-numbers, non-partisan-symmetry.

Builds on: G3 (`decides` edges are in the store: 436 at pass 71; `clubAt` +
dated club in the record), G7 (the deník's fifth layer and the `obec:` key —
append your kinds AFTER G7's in `KIND_ORDER`), G8 (vote claims).

## Goal of this wave's slice

1. `features/votetrack/ledgerRead.ts`: windowed `listVoteEvents({since})` +
   the scoped ballot read (`vote_psp_id = any(...)` rides `vote_ballot_vote_idx`,
   memory scoped-ballot-read-beats-the-relation); club line via the ONE party-line
   function in `lib/analysis/kg.ts`, dated club via `clubAt`. MEASURE the 30-day
   window's wall time on the test-lane fixture and state it; the unscoped read is
   15,8 s and the deník batch budget is ~1,5 s — if the window cannot be made to
   fit, ship the memoised layer behind the existing batch memo and say so.
2. `deriveDenik.ts`: kinds `rollCall` (tisk-keyed registry fact via `decides`:
   "o tisku N se hlasovalo D, výsledek", source = `vote_event.source_url`) and
   `deviation` (poslanec-keyed derived figure: "hlasoval(a) jinak než většina
   klubu při hlasování N", club line printed, club AT the vote); `timeBasis:
   "ucinne"`; ids from `vote_psp_id` + `mandate_psp_id`; `limits.votesTruncated`
   + `votesWithoutTisk` counted and rendered.
3. Vocabularies: `kindLabels.ts`, `/schranka` `kindVocabulary.ts` + `KIND_ORDER`
   (after G7's kinds), `denik.entry.*` catalog keys through the language gate.
4. `/hlasovani` and `/poslanec` link their deník day via `entityDayHref`
   (imported). Feeds inherit through `feedCodecs.ts`; `feedNotes.ts` names the cap.
5. Symmetry: whole chamber or nothing; an MP with zero deviations in the window
   is a row-less entity, not an absent one; the page says which layer it read.

## Owned paths

`features/votetrack/ledgerRead.ts` (+ types), `features/denik/**`,
`features/schranka/{kindVocabulary,kindLabels,…}.ts`, the two link sites,
`messages/{cs,en}.json` (`denik.*`, `schranka.*`), docs
`docs/routes/{denik,schranka,hlasovani,poslanec}.md`.

## Hot-file policy

`deriveDenik.ts` `KIND_ORDER`: append after G7's kinds. `feedIndex.ts`: untouched.

## Report

README shape, plus the measured window wall time and the share of `poslanec:`
deltas that are vote rows on the fixture.
