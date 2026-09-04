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

**`/graf/p/[ref]` — the bundle stopped certifying refusals, and the fingerprint
grew an author (2026-09-04, G4 / deck #36 + #28).**
`edgeClaim` emitted `prop("review_state", pending ? "pending_review" : "verified")`
— a two-valued sentence about a THREE-valued field. `kg_edge.props.review_state`
carries `verified | pending_review | rejected`, `rejected` is terminal and the edge
stays in the graph (`repositories/review.ts`), and the whole graph surface collapsed
that to one boolean. A tie a human had REFUSED therefore left `pending: false` and
the least-correctable artifact this product emits printed `review_state: verified`
over it. Now the stored token goes out literally, and a relation the gate does not
cover (`GATED_RELS`) prints `ungated` — never "verified", because "nothing to review"
is not a review. Each `Claim` also carries `claim_ref`, an absolute `claim_url`
(`/zdroj/<edgeClaimRef>`, omitted with no host — never a guessed domain, the same rule
as `url`/`identifier`), and its `provenance_ref`/`provenance_pass`/`provenance_method`:
every hop of a cited path is now itself a citable receipt, which is what the golden
path means by a checkable path. `permalinkCardModel.review` splits `pendingEdges` from
`rejectedEdges` and a refused step denies the card its confirming colour, on the same
reasoning that denied it to a stale one.

**DERIVATION BUMP — every issued `cesta` ref reads as `moved` exactly once.**
`hashViewContent` hashed `{kind, from, to, path}` while `maxCost`/`hubDegree` sat in
`core`, OUTSIDE the hash, and the rule constants had no version identity at all. Change
`HUB_DEGREE` from 120 to 90 and a two-hop path that survives re-derives byte-identical:
the fingerprint matches, `/overeni` says `verified`, and the citation was authored by a
different rule — a coincidence stamped as verification. `content` for `cesta` now carries
`{ruleRef, excludedRels, hubDegree, maxCost}` and `trailPath.ts` exports
`PATH_RULE_REF = "evidence-path/v1"` + `pathRule()`, test-pinned against the constants so
changing one without the other fails. This is announced, not silent: it moves the content
hash of every path citation issued before today, once. The alternative was to keep hashing
a lie. Bump `PATH_RULE_REF` on any semantic change to the constants or the ordering rule.
The bundle additionally carries `path_excluded_rejected` — how many hops the search
refused to walk because a human refused them — so an empty answer can distinguish "we
found no connection" from "the only connection runs through a refused claim".

Honest carry-over from this pass: `/overeni`'s `grafVerdict` still returns a blanket
`ungated` for the `graf` family (`verdict.ts` belongs to G1 this wave); the exact
modifier it should return is in this wave's report. `moved`-by-basis reporting — the
"same path, different rule" sentence comparing a cited `ruleRef` to today's — is not
built either, and older refs carry no basis at all, so they must read as "stamps not
compared", never as a mismatch.
