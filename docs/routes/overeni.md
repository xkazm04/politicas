# /overeni — Ověření citace

## Current contract

**Routes** — `/overeni` (the Civic Claim Gate: paste a politicas address and it
re-derives the claim against today's record) and `/zdroj/[ref]` (the receipt a
claim's address resolves to). `/graf/p/[ref]` is the third citation surface
(→ [graf-permalink.md](graf-permalink.md)).

**The gate derives nothing.** It detects the family and forwards each to the
loader that OWNS the number — `getMoneyMpDetail()`, `getCompanyDetail()`,
`getLeaderboardData()`, `getLawData()` — which mints the claim with the SAME
module the issuing surface used. Order is registry-then-live
(`lib/claims/registry.ts` is a finite pure module; `liveFigures.ts` is the
server-only half), so a store is touched only for a ref the registry does not
know.

**Three verdicts and no fourth** — `verified` · `moved` · `unknown`
(`verdict.ts`). Beyond the value, the verdict compares the **derivation**:
equal value + different basis is `moved`, not `verified`, because a match
between two formulas is a coincidence. A missing basis on either side is not
compared — it claims nothing.

**Existence and endorsement are two sentences.** `review_state` is terminal per
edge, so a rejected tie stays in the graph; `verdictGate()` / `verdictTone()`
put the human gate at headline weight ("Záznam v grafu je — lidská kontrola ho
zamítla."), a non-confirmed gate loses the confirming cobalt, and a gate-verified
edge keeps its unqualified „Ověřeno". `gateVocabulary.ts` is the ONE
claim-status vocabulary (`pending` ≡ `pending_review`); an unmapped token
renders VERBATIM and labelled, never hidden and never guessed.

**Owned rules** — `verdict.ts` · `gateVocabulary.ts` · `liveFigures.ts` (the
metric router) · `refDetect` (it unwraps OUR own `?ref=` at DEPTH 1 — a cycle,
not a citation — and answers `politicas-neni-citace` for our pages that issue no
address) · `caseFileLink.ts` (links only from the SHAPE of a stored id, never a
guess) · `getGuideExample.ts` (a REAL edge read at request time; an example
hardcoded in source is a claim about the graph that nothing holds).

**Standing rules.** Pure modules stay pure and return **message KEYS**, with the
list of keys each can emit exported and pinned. Schema.org ClaimReview is
emitted **only past the human gate** — pending/rejected/ungated/node receipts
emit NOTHING, no softer substitute — with a numeric rating and an absolute URL
from request headers or the field omitted. A store that is down answers
`unavailable`, never „the registry does not know this figure"; an address
today's graph no longer carries answers `zaznam-nenalezen`, not `mimo-rejstrik`.
A metric added without a routing branch FAILS `liveFiguresRoundTrip.test.ts`
instead of silently degrading.

## Dated record

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

**Record time reaches the gate — the third column (2026-09-04, moonshot G1,
cards #1/#9/#10).** The gate could show two sides: what the reader pasted and
what holds today. It could not show the one we are answerable for, so `moved`
meant "your figure differs from ours", never "on that day we said this" — which
is exactly what the registry's three-verdict vocabulary requires ("moved is
shown with both sides and both dates"). `/overeni?ref=…&k=YYYY-MM-DD` adds it.

For the `zdroj` family the replay goes through `getReceiptData(ref, day)` — the
gate still writes no graph read of its own — and `zdrojVerdict` compares the
version valid that day against today's. That gives this family a `moved` kind
for the first time: the address is still either in the graph or not, but the
CONTENT at it can move. `receiptMoved` is pure and compares only what a receipt
typesets as a claim (gate state, weight, pass, method). Node labels are
deliberately excluded — a renamed company is the same company and "moved" on it
would be a false alarm — while a missing weight against a number IS a move
(missing is not zero). The audit trail shown beside a historical version is
trimmed to decisions taken by that instant; today's decisions under a
three-month-old version would be a document that lies.

The record-time banner sits ABOVE the verdict (the `/graf/p` staleness rule: a
"this is not today" line placed under the figure is read after the figure) and
comes from the SAME catalog keys `/zdroj` uses — two copies of that sentence
would diverge at the first correction, and both surfaces answer the same
question. It has five readings, and they are five different findings that must
never share one silence: `at` (the receipt IS the archived version),
`absentThen` (we kept records; this claim was not among them), `beforeEpoch`
(the migration's shared `recorded_at` means we assert nothing before it),
`refused` (`k` was not an ISO day — `2026-02-31` is rejected, not slid to 3
March) and `notReplayable`.

`notReplayable` is the honest answer for the derived figures (`/penize`,
`/zebricek`, `/zakony`): those are computed by their owning loaders over today's
store rather than read from graph history, so we cannot say what we published on
a given day — and saying nothing would read as "there was nothing there". What
would close it: `liveFigures.ts` re-deriving through the money/score/law loaders
parameterised by a `KgAsOfReads`, which is those features' write set, not this
one's. Also open: the `graf` family carries only the banner today, because
naming what changed in a view needs the replay described in
`docs/routes/graf-permalink.md`.

An as-of receipt emits NO `ClaimReview` (`app/zdroj/[ref]/page.tsx`): the markup
carries no as-of date, so a crawler would read a months-old version as a current
verified claim. `refDetect` also learned the `g2.` prefix, so a bare dated graph
citation pasted into the gate is recognised as one — and the old `g.` form keeps
verifying, because an issued address is never withdrawn.

**And `/zdroj` answers "as of the day you cited it" (same change).** The same
`?k=` lens re-derives the receipt through the store's key-indexed point reads,
with the dated banner above the content and the endpoint labels read at the same
instant, so the page is one date rather than a collage of two. A `gone` receipt
additionally shows the LAST recorded version — "naposledy zaznamenáno … /
nahrazeno …" from `lastKgEdgeVersion` / `lastKgNodeVersion` — typeset as history
under its own heading with both instants. It is never promoted: the status stays
`gone`, no ClaimReview goes out, no audit trail is attached, and nothing on
another surface counts it. The day rule itself is pure and shared
(`features/shared/provenance/asOfLens.ts`), so the two surfaces cannot drift
about what a valid day is or which instant it means — a day is read at its END,
because the reader cited what we published that day, not what stood at midnight.

**The gate names the hash algorithm from the family it verifies (2026-09-05,
scan-sweep, parity-auditor).** `/graf/p` and the exhibit each export
`HASH_ALGORITHM` and set it from the constant; the gate's „otisk dnes" row carried
the literal `fnv-1a/32`, so a change of algorithm in either family would have
printed the old name next to a new hash. The row now picks the constant by
family; `pageSource.test.ts` forbids the literal.

**2026-09-07 — the person-id grammar of the receipt's case-file link has one owner
(scan-sweep, parity-auditor).** `caseFileLink.ts` carried its own
`/^psp:person:(\d+)$/` next to the identical regex in `lib/ingest/changeEvents.ts`
(`pspIdFromNodeId`) — two definitions of „our id" that would part on the first
change; `pspIdFromEntityId` now delegates. The IČO half stays local on purpose:
its canonical owner is `features/money/companyId.ts`, which the shared catalog may
not import (eslint boundary) — backlogged as a move to `lib/`.
`provenanceSource.test.ts` forbids a second person-id regex.

**2026-09-07 — the receipt's two catalog maps are closed over the enums they label
(scan-sweep, state-coverage).** `ReceiptBody` kept the registry-tier labels and the
audit-decision labels as `Record<string, string>`: the tier map had a raw-token
fallback for a union that has exactly two members, and the decision map named two
of the three `ReviewAuditRow.decision` values and let a `??` default label
EVERYTHING else „vráceno k doplnění" — a new decision would have printed as a
return. Both maps are now `as const satisfies Record<…, string>`; `needs-more` is
named explicitly and the fallbacks are gone, so a missing label is a type error,
not a sentence the reader acts on.

**2026-09-07 — one case-file label map for the capsule and the page (scan-sweep,
parity-auditor).** `ReceiptBody` and `ReceiptPage` each declared an identical
`CASE_FILE_LABEL_KEY`; the map now lives beside the rule that produces the link
(`caseFileLink.ts`, `satisfies Record<CaseFileLink["target"], string>`) and both
surfaces import it — a renamed catalog key or a third case-file target changes one
place. Count: 2 copies → 1.

**2026-09-07 — the provenance capsule's dialog holds the contract its header states
(scan-sweep, accessibility-checker).** The component's header promised „panel
role=dialog aria-modal"; the panel carried the role, the focus trap and Esc, but
not `aria-modal`, so assistive tech was not told the trapped focus was
intentional. The attribute is now set; the header is true again.

**2026-09-08 — round 59 of the sweep (scan-sweep, claim-verifier).** Two fixes on
the gate. The verdict rows handed the graph pass to the catalog as a raw number
(`{ pass: then.provenance.pass }`), and the guide its step number — next-intl
formats a number with its own Intl and would print pass 1 234 with a thousands
space; both are identifiers and go as strings now, the rule /data adopted for run
ids on 2026-09-06. `liveFigures` dated its plausibility bound by the UTC day
(`toISOString().slice(0, 10)`); it reads `pragueDay()` like every other loader
that hands a „today" to the plausible-date module. `overeniSource.test.ts` pins
both. The carried item from the first sweep — `refDetect`'s hand-kept host list —
stays with the base-URL card in the backlog.
