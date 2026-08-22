# /metodika — Metodika

`/metodika` — **Metodika** (features/civicscore/MetodikaPage.tsx, thin route
`app/metodika/page.tsx`). Added 2026-08-04. The platform positions itself as
methodology-transparent, `/zebricek` cites „průchod grafu č. 42" and
`/referendum` invites citizens to RE-WEIGH the index — yet no surface showed
what the formula IS. This one does, and **every figure on it comes from an
import, never a literal**: the six weights and their per-component psp.cz
citations from `componentDefs.ts` (i.e. from `CONTRIBUTION_WEIGHTS`), the
100-point total as a computed sum, the three saturation caps
(`COMMITTEE_SATURATION` 3 / `LEGISLATIVE_SATURATION` 4 / `SPEECH_SATURATION`
40), the counted organ types and leadership functions from
`COMMITTEE_ORGAN_TYPES` / `LEADERSHIP_FUNCTIONS`, and
`CONTRIBUTION_FORMULA_REF` itself. Changing a weight reflows the page. The
committee-dedupe rule is described beside the `seatKey()` behaviour it
documents, including why a row with no organ id is merged with nothing.
Section 04 prints what the DATA claims about itself — the wave-1 provenance
aggregate off the same `react.cache()`-wrapped read `/zebricek` performs
(uniform pass/ref + coverage, `mixed`, `absent`, and the formula-match vs
mismatch sentence); no store degrades to a labelled note while the formula
still renders, because the formula is code, not data. **No invented history**:
the graph carries only the current `{pass, ref}`, so only that is printed.
Linked from `/zebricek` (under the provenance notes), `/poslanec` (under the
score pass) and `/kraj`; listed in `navModel` under the leaderboard.
**The published weight vector has ONE source now** — `PUBLISHED_WEIGHTS_LABEL`
in `lens.ts`, derived from `CONTRIBUTION_WEIGHTS` in `LENS_COMPONENT_ORDER`.
„25-20-20-15-10-10" was a LITERAL on four rendered surfaces (`/referendum`'s
weights citation, `/zebricek`'s source note and lens aside, `WeightPanel`, the
referendum OG image) **and in both message catalogs** — on the very page that
invites a reader to change those weights. `messages.test.ts` now fails if
either catalog hardcodes it again, and `lens.test.ts` pins the label to the
formula.
