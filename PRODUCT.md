# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: **a Czech voter deciding.** They arrive in the run-up to an
election — typically from social media, on a phone, with low patience — to check
whether a specific politician or party deserves their vote. Their job is to
reach a verdict they can trust, and to be given a reason to believe it. They are
not a data analyst and did not come to browse; a claim they cannot check is
worth nothing to them, and a claim they cannot understand in ten seconds never
gets checked.

No second audience is confirmed. The evidence depth the platform carries
(provenance strings, `pending_review` states, recompute paths) exists to make
the voter's verdict credible, not to serve a separate professional persona.

## Product Purpose

Politicas measures the sitting Chamber of Deputies against public data and
publishes the result as one comparable index per politician, assembled from five
modules over a single shared entity graph: CivicScore (contribution index),
VoteTrack (voting record and club discipline), FollowTheMoney (contracts and
ownership ties), BudgetMirror (municipal stewardship), LawWatch (bills → laws).

Success is a voter who can name what a politician actually did, see which public
dataset says so, and disagree with the method without having to doubt the data.

## Positioning

Two mechanisms a neighboring product could not truthfully copy:

1. **One graph, five tools.** Person ↔ party ↔ firm ↔ contract ↔ vote ↔ budget ↔
   law, joined on the universal 8-digit IČO. A money finding and a voting
   finding are about the *same entity*, not five siloed datasets that happen to
   share a name. Cross-module questions ("which MP sponsored a law amending the
   statute their own firm's contracts sit under") are queries here and
   impossible elsewhere.
2. **Complete chamber coverage.** All 207 sitting MPs are scored on the same six
   published components — not a curated shortlist of the famous ones.
   Non-selection is itself the non-partisanship guarantee: there is no editorial
   choice about *who* gets measured, so there is no editorial thumb on the
   scale.

## Operating Context

Czech politics, Czech language, Czech public registries. The evaluation moment
is pre-election and adversarial: anything published will be read by the people
it scores and by their opponents, so a single fabricated or unsourced figure is
an existential risk, not a bug.

Source registries in use: psp.cz (mandates, votes, committees, speeches,
interpellations, bills), Registr smluv (public contracts), ARES / obchodní
rejstřík (company ownership and roles), Sbírka zákonů (published statutes).

## Capabilities and Constraints

- **Czech-first.** `lang="cs"`, Czech copy, decimal commas via `lib/format.ts`.
  Analyst-generated prose passes a language gate before it reaches a reader.
- **Every rendered number cites its source** (`SourceNote`). Derived or ungated
  values are labelled as such. This is a hard product constraint, not a style
  preference.
- **Unverified evidence never feeds a score.** Money ties carry
  `pending_review` until a person gates them; all 211 live ties are currently
  ungated and every surface says so on the tie itself.
- **The index is published and versioned.** Six components with published
  weights (participation ×25, committee ×20, legislative ×20, speech ×15,
  attendance ×10, leadership ×10), a deterministic recompute path, and a replay
  gate that refuses to publish a correction unless it can first reproduce every
  stored value under the old formula. The visitor can move the weights and watch
  the ranking change on unchanged evidence.
- **No time series.** Single term, so quarter-over-quarter deltas and trends
  have no real backing and are omitted rather than fabricated.
- **Bad data is disclosed, never repaired.** The corpus holds contract
  signatures dated 0002, 1970, 2027 and 3062; those rows keep their amount, lose
  their date, and the count of them is printed.
- **Open decision → resolved 2026-07-29:** the landing page currently runs on
  the `lib/civic/data.ts` sample and labels itself „ILUSTRATIVNÍ UKÁZKA".
  That is **debt, not design**. Real-graph wiring is the intended end state; new
  landing work reads the real loader, and the illustrative label comes off only
  where the data is genuinely real.

## Brand Commitments

- Name: **Politicas.**
- Visual world: **Konstrukt** — Czech functionalist information design in the
  lineage of Ladislav Sutnar. **`docs/DESIGN.md` is the authority** and was
  settled in a prototype round on 2026-07-22; the runner-up direction is
  archived at `features/labs/rentgen/`. Do not re-propose a redesign of the
  parent world.
- Colors originate only as tokens in `app/globals.css` (three declared
  exceptions, scoped in lint). Never hardcode a color.
- Voice: declarative, evidenced, unhedged. The product states what the data
  says and names its limits; it does not editorialize about politicians.

## Evidence on Hand

Real, materialized in an embedded Postgres knowledge graph (`kg_node`/`kg_edge`):

- 207 sitting MPs with contribution scores (index pass 42), six components,
  competition ranks (55 MPs share a rank across 25 groups).
- 196 companies, 2 287 contracts, 260 MP↔company ties (211 `linked_to`, all
  `pending_review`), ~153 731 `supplies` edges.
- 141 bills → 101 laws via 150 `amends` edges.
- Dossier enrichment on 165/207 MPs (work themes, bill focus, public role).

Absences that future work **must not fabricate**:

- No bill paragraph diffs and no bill-stage pipeline — psp.cz publishes only the
  `č. N/RRRR Sb.` title citation as a structured bill→law link.
- No source URLs in the graph; official links are rebuilt from stable ids.
- No prior-term comparison until `contribution_psp9` is restored onto the nodes.
- No testimonials, customers, press, benchmarks, pricing or user counts of any
  kind exist. None may be invented, including as placeholder copy.

## Product Principles

1. **Cover the whole chamber or cover nothing.** Non-selection is the
   non-partisanship guarantee; a shortlist is an editorial act.
2. **A number that cannot cite its source does not ship.**
3. **The method is the product.** Publish the weights, the recompute path, and
   the correction history; let the visitor disagree with the method rather than
   the data.
4. **Disclose bad data; never silently repair it.** An impossible date, a stale
   cache and an undercounted census are each stated on the surface that would
   otherwise print them.
5. **One entity, five views.** A finding in one module is about the same person
   or firm in every other; never let a surface invent its own definition of a
   shared figure.

## Accessibility & Inclusion

No external standard is contractually required, but established and lint-enforced
practice: WCAG 2.3.3 reduced-motion fallbacks for looping motion, keyboard
operability for every click-role element, `aria-live` for status regions, DOM
focus rings distinct from selection state, and `sr-only` sentences where a visual
filter would otherwise silently hide meaning. The primary user is on a phone, so
mobile-width legibility is a functional requirement, not an adaptation.
