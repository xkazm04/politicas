# /graf/p/[ref] — citation permalink card

## Current contract

**Route** — `/graf/p/[ref]`: a citation card for a graph view, plus its OG
image — **the least correctable artifact the product emits**, cached by every
social platform and screenshotted into articles.

**The contract, from `PermalinkPage.tsx`'s own header:** staleness is posted
ABOVE the content, and each edge's `pending_review` survives into EVERY
citation format — the typesetting, the JSON-LD **and the OG image**.
`permalinkCardModel` (pure, tested) decides what the card may say; a stale view
never gets the confirming colour, and both fingerprints are shown.

**Three states that must not be slid together** (`getPermalinkData.ts`):
`invalid` · `gone` · `unavailable`. Our outage must never read as the death of a
documented view, and no fallback may claim the address carries a view and a
fingerprint when it carries nothing.

**Sources** — `permalinkSources()` is ONE rule read by both the card and
`isBasedOn`: a node's own registry links win over the platform's four blanket
sources. The evidence bundle carries the search bound the page prints under the
line about a generated path otherwise being an accusation
(`path_max_cost_steps`, `path_hub_degree_threshold`, `paths_found`,
`path_search_capped`) plus the localized ordering rule; `url`/`identifier` are
ABSOLUTE from request headers, omitted with no host, never a guessed domain.

**Font gotcha** — the OG font subset must be requested over the **uppercased**
text when the card sets `textTransform: uppercase`, or a title draws one capital
and drops the rest mid-word to the fallback face.

**Honest carry-over** — for `cesta`/`trasa` the sources still fall back to all
four registries; narrowing by node kind needs `PermalinkPage.tsx` to adopt the
same rule, and shipping half of it would put two rules on one citation.

## Dated record

**`/graf/p/[ref]` — the citation card tells its age (2026-08-13).**
`features/graph/PermalinkPage.tsx` states the contract in its own header — staleness
is posted ABOVE the content, and each edge's `pending_review` survives into **KAŽDÝ**
citation format, „sazby, JSON-LD **i OG obrazu**". The OG image is named in that
sentence and never read `view.fresh` (grep: zero hits). So the least-correctable
artifact the product emits — cached by every social platform, screenshotted into
articles — printed today's fingerprint under „stav ověření k {date}" and, when
today's edges happened to resolve, „vše ověřeno" in confirming cobalt, for a citation
the page behind it would have flagged as diverged. `permalinkCardModel` (pure, tested)
now decides what the card may say: staleness posts above the content with BOTH
fingerprints and a stale view never gets the confirming colour. `invalid` / `gone` /
`unavailable` stopped sharing one frame — our outage no longer reads as the death of a
documented view, and no fallback claims the address carries a view and a fingerprint
when it carries nothing (the „TŘI STAVY, KTERÉ SE NESMÍ SLÍT" rule from
`getPermalinkData.ts`, finally honoured in the card). `permalinkSources()` is ONE rule
read by both the card and `isBasedOn`: a node's own registry links win over the
platform's four blanket sources (verified live — a firm returns ARES/OR/Hlídač/Registr
smluv). The evidence bundle carries the search bound the page prints under „bez něj by
generovaná cesta byla obvinění" (`path_max_cost_steps`, `path_hub_degree_threshold`,
`paths_found`, `path_search_capped`) plus the localized ordering rule, and its
`url`/`identifier` are ABSOLUTE from request headers (omitted with no host, never a
guessed domain); the Dataset `description` left its hardcoded Czech for the catalog.
Found only by rendering the card: **the font subset was requested over the
un-uppercased text while the card sets `textTransform: uppercase`**, so a title drew
one Archivo capital and dropped the rest mid-word to the fallback face; both cases are
requested now. Honest carry-over: for `cesta`/`trasa` the sources still fall back to
all four registries — narrowing by node kind needs `PermalinkPage.tsx` to adopt the
same rule, and shipping half of it would have put two rules on one citation.

**The address learns when it was issued (2026-09-04, moonshot G1, card #13).**
A stale citation could be *declared* stale and nothing more, because the address
itself carried no issue instant: `g.<state>.<hash8>` gave the server two
fingerprints and no date, so even a bitemporal store had nothing to replay the
view AGAINST. The address space grows rather than moves:

```
g.<state>.<hash8>                 — still decodes, forever
g2.<state>.<hash8>.<YYYYMMDD>     — issued from now on
```

`encodeGraphRef` stamps today by default, so `graphActions.citeViewAction` needed
no change and every newly issued citation is dated; passing `""` keeps the old
shape for the guide's illustrative example, which must not change daily. The date
is refused, never repaired — `20260231` is not 3 March, it is an invalid address,
the same discipline the base64 body already had — and `features/overeni/refDetect.ts`
learned the second prefix so a bare `g.` ref pasted into the gate keeps verifying.

The staleness block above the content is now a **tehdy / dnes** ledger: both
fingerprints, each with its own date, and `permalink.noIssueDate` where a `g.`
address carries none rather than today's date silently standing in for the issue
date.

`diffViews()` ships pure and tested (`features/graph/diffViews.ts`). It compares
the CANONICAL CONTENT — the very object `hashViewContent` hashes — so
"fingerprints differ but the diff is empty" is a detectable inconsistency rather
than a silent state. Edges are keyed `src|rel|dst`, so reordering is not a
change; weights compare exactly (0,87 → 0,88 is a move the display rounding
would have swallowed); a missing weight against a number IS a change; gate flips
are their own finding beside weight changes; a path is re-routed by SEQUENCE,
not by set; and `incomparable` exists precisely so "nothing changed" and "we did
not replay the then-side" can never be typeset the same way.

**Carry-over, named in the product and not only here.** `view.diff` is typed and
wired but `null`, and the page says in as many words that it can date the change
but not yet name it. Producing the then-side needs `resolveView(state, at)` over
`getTrails` / `getPathBetween` / `getNodeDetail` parameterised by a
`KgAsOfReads` — a change to `features/graph/graphLoader.ts`, which the G1 write
set does not include (G4 owns it). Also still open from card #13: the JSON-LD
`hasPart` for the then-side with `validFrom`/`validThrough`, the OG card's
"změněno od <date>", and the diff table under `moved` at `/overeni`; all three
wait on the same replay.

