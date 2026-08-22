# /overeni — Ověření citace

`/overeni` — **Ověření citace / Civic Claim Gate** (features/overeni): paste a
politicas address (receipt `/zdroj/…`, graph citation `/graf/p/…`, velín
exhibit, claim-ref or a copied `data-claim-*` element) and the gate re-derives
it against today's record. The vocabulary is THREE verdicts and no fourth —
`verified` · `moved` · `unknown` (`verdict.ts`); the gate itself derives
nothing, it forwards each family to the loader that owns it.
**The verdict states the human gate separately, since 2026-08-04.** For a
receipt, `verified` means the RECORD EXISTS — and `review_state` is terminal
per edge, so a rejected `linked_to` tie stays in the graph. The page used to
print a 3xl „Ověřeno" over exactly that, with the gate state demoted to a small
row 60 px below; since every money tie on /penize now ships a `/zdroj` receipt
link, that is the address a reader is most likely to paste. `verdictGate()` /
`verdictTone()` are pure and tested: existence and endorsement are two
sentences at headline weight („Záznam v grafu je — lidská kontrola ho
zamítla."), a non-confirmed gate loses the confirming cobalt (ochre for
pending, `signal-deep` for rejected), and a gate-verified edge keeps its
unqualified „Ověřeno". Measured on the live store: **211/211 `linked_to` edges
are `pending_review`, 0 rejected** — the rejected path is proven by test, not
by data.
**One claim-status vocabulary** — `features/overeni/gateVocabulary.ts`. The
page's table was keyed on the RECEIPT tokens (`verified|pending_review|
rejected`) while a registry figure carries `ClaimReviewStatus`
(`verified|pending`), so 2 of 3 issued figures rendered the raw English token
and an omitted status rendered EMPTY. `pending` and `pending_review` are one
state with one sentence; an unmapped token renders VERBATIM and labelled as
untranslated (the `tieFlags.ts` precedent), never hidden and never guessed.
**Our own page is not „not a politicas link"** — `refDetect` knew three path
patterns and called everything else `nepodporovany`, which is false for
`/penize/firma/<ico>`, `/poslanec/<id>`, `/zebricek`… The new
`politicas-neni-citace` reason says it is our page but not a citable address
and where that page issues one. The known-segment set is derived from
`features/shell/navModel.ts` (NAV + children + `UNLISTED_ROUTES`), never
retyped, and a foreign origin on the same path is still `nepodporovany`.
**The two halves of the product point at each other, since 2026-08-04.**
`/zdroj` never linked `/overeni` and `/overeni` named the receipt's endpoints
as plain text, though `subject.id` / `object.id` are the exact ids
`/poslanec/<pspId>` and `/penize/firma/<ico>` key on. The receipt footer now
carries „ověřit tuto citaci" (`/overeni?ref=…`, still a GET, so the answer is
a shareable address); `ReceiptBody` and the gate's own record row link both
endpoints into our case files through ONE pure resolver
(`features/shared/provenance/caseFileLink.ts`) that links only from the SHAPE
of the stored id and never guesses.
**The fact-check markup obeys the human gate (2026-08-12).** `/zdroj` emitted
schema.org ClaimReview for EVERY receipt — including `pending_review` ties —
with the gate state hidden inside `ratingValue` as a Czech sentence and a
relative `url` schema consumers reject; a crawler that reads ratingValue as a
number received our unreviewed trail as a reviewed claim, the exact thing
`lib/claims/claim.ts` §3 forbids. `toClaimReviewJsonLd` now enforces the gate
ITSELF (verified edges only; pending/rejected/ungated/node receipts emit
NOTHING — no softer substitute schema), rating is numeric 5-of-5 only past
the gate, `appearance` is the CreativeWork shape, and the absolute URL comes
from request headers (the sitemap precedent) or the field is omitted. And the
„gone" receipt stopped dead-ending on a base64 blob: the loader now returns
the DECODED claim (subject — rel — object, endpoint nodes re-read so people
and firms keep their names even when the edge is gone), rendered with
case-file links via `caseFileLinkFor` only where today's graph still carries
the node, the copy button, „ověřit tuto citaci" and `ReportClaimLink` in ONE
shared citation footer; the unavailable state's backHref points home, not at
the operators' velín. Both sides of the gate pinned by
`features/shared/provenance/{receipt,messages}.test.ts`.
**The guide's example is a real edge.** `guide.ts` built the `/zdroj` example
from fabricated ids („osoba-priklad" / „firma-priklad"), so copy-pasting the
one address the page invites you to copy returned „Neznámý odkaz." — in a
`<pre>` that had no copy button while /zdroj shipped one. `getGuideExample.ts`
reads ONE real `linked_to` edge at request time (deterministic, neutral by
construction: first in graph order — src/rel/dst asc — with the rule printed
under the example; ~806 ms cold, `react.cache`d per request). Derived, not
pinned: an example hardcoded in source is a claim about the graph that
nothing holds, and this repo has no live-store test suite to catch it going
stale. Store unavailable → the illustrative shape, LABELLED illustrative.
Only an example the gate verifies today carries `live: true` and gets the
copy button + „ověřit tento příklad" — `CopyReceiptLink` moved out of
`ReceiptPage` to `features/shared/components/CopyLinkButton.tsx` (@catalog)
so there is one, not two.
Also: the empty state renders an affordance instead of nothing, the verdict
section is `id="verdikt"` + `tabIndex=-1` + `aria-live` and is focused after a
GET submit (`VerdictFocus`), and the unknown headline moved off `steel-aa` to
`ink` — it is the most common outcome, not a footnote.
**The gate verifies live VALUES, not only the sample registry (2026-08-04).**
`lib/claims/registry.ts` is a pure module over the sample layer — three figures,
all issued by /svedectvi — so a money figure could never enter it (it would have to
be frozen there, and start lying). `features/overeni/liveFigures.ts` is the second
half: server-only, it decodes a claim's subject and hands the question to the
loader that OWNS the number (`getMoneyMpDetail`, `getCompanyDetail`), which mints
the claim with the SAME `features/money/moneyClaims.ts` the page used. The gate
still derives nothing. Order is registry-then-live, so a store is only touched for
a ref the finite registry does not know; a store that is down answers
`unavailable`, never „the registry does not know this figure", and a live address
today's graph no longer carries answers `zaznam-nenalezen`, not `mimo-rejstrik`.
**The contribution score joined the SAME mechanism** (`features/civicscore/
scoreClaim.ts`) — one value-claim family, not two: same ref grammar, same
`figuraVerdict`, same derivation comparison. Its claim is `ungated` rather than
`pending`, and the gate renders that with the receipt vocabulary's own
„deterministické odvození — lidskou branou neprochází" instead of promising a
human review of an arithmetic result.
**The verdict now also compares the DERIVATION** (`data-claim-derivation`, new and
optional on `Claim`): equal value + different basis is `moved`, not `verified` —
a match between two different formulas is a coincidence, and this is exactly the
2026-07-29→08-04 pass-42 case at the citation layer. A missing basis on either
side is not compared: it claims nothing. Verified against the live store: the
ledger's first row (Petr Hladík → Teplárny Brno, `kg-pass:10`) verifies at
**23 653 407 340,55 Kč** from a bare ref AND from a pasted element; +1 000 000 on
the pasted value answers `moved/value`; the same value stamped `kg-pass:11`
answers `moved/basis`; the MP total (23 570 594 009,66) and the company reach
verify the same way, and all of them carry `pending` because all 211 ties do.
**The verifier speaks both languages, since 2026-08-04.** It had ZERO English
— no `overeni` namespace at all, every sentence a Czech literal in
`guide.ts` / `verdict.ts` / `OvereniPage.tsx` / the route metadata — while
/penize, the surface that feeds it its traffic, is fully bilingual. All
reader-facing copy now lives in `messages/{cs,en}.json` under `overeni.*`; the
Czech moved VERBATIM. The pure modules stay pure and return **message keys**
(`verdictHeadlineKey` / `verdictLeadKey`, `gateStatusInfo().labelKey`,
`GuideStep.titleKey`, `GuideExample.labelKey`/`noteKey`) — that was the smaller
honest design than threading a translator into logic, and it makes the mapping
itself testable. Each module also exports the list of keys it CAN emit
(`VERDICT_COPY_KEYS` / `GATE_COPY_KEYS` / `GUIDE_COPY_KEYS`), and
`features/overeni/messages.test.ts` pins cs/en key parity, ICU placeholder AND
`t.rich` tag parity, no empty value, every emitted key present in both
catalogs, the Czech language gate over every sentence, and the acceptance bar
of the gate-verdict work in BOTH languages (a rejected headline may not read as
a confirmation; a gate-verified one keeps its unqualified „Ověřeno").
Verified against the live store in a production build: the same real pending
tie renders „Záznam v grafu je — lidskou kontrolou ještě neprošel." / „The
record is in the graph — human review has not reached it yet."
**The gate verifies its own address (2026-08-12).** `/overeni?ref=…` — the
exact URL the product hands out as „ověřit tuto citaci" — used to answer
`politicas-neni-citace` when pasted back. `detectAt` now unwraps the `ref`
param of OUR /overeni address and re-detects it at DEPTH 1 (a decision, not
an omission: /overeni-in-/overeni is a cycle, not a citation); only `ref`
is recognised because the route reads no other param; escapes decode,
fragments drop, empty stays non-citation. And the metric router finally has
its missing test: `liveFiguresRoundTrip.test.ts` enumerates ALL metric
constants (money + score minted live over mocked loaders, law pinned at
routing level — building a fake LawData would be a second untrue corpus),
asserts mint → bare ref → `verified` with the identical value, registry
refs never touch the store, store-null answers `unavailable` never
`mimo-rejstrik`. A metric added without a routing branch now FAILS a test
instead of silently degrading to „rejstřík ji nezná".
