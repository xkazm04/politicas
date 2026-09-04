# G8 — claims everywhere: figure receipts, chamber readings, vote claims (wave 2)

Cards: deck #3 (receipts for derived figures at /zdroj), #7 (chamber readings as a
claim family), #15 (vote figures enter the claim gate). Registry:
claim-verification-and-provenance / recomputation-receipts ("the receipt is an
addressed computation, not a stored document"), claim-ref-addressing,
derivation-comparison; laws deterministic-code-owns-numbers,
every-cap-ships-its-population.

Builds on wave 1: G1's `k=` as-of receipts and three-column `moved` (keep them;
extend). You OWN `features/overeni/liveFigures.ts` this wave and reconcile the
single `// [G6]` and `// [G7]` routing branches other builders add.

## Goal of this wave's slice

### A. Figure receipts (#3)

1. `ClaimRef` union gains `{kind: "figure", ref: ClaimRefParts}`; `decodeClaimRef`
   / `encodeClaimRef` learn the `claim:` prefix (append-only: `h.`/`u.` unchanged;
   pin in `claimRef.test.ts`).
2. `FigureReceipt` in `receipt.ts` (`kind: "figure"`): `value`, `unit`,
   `derivation`, `methodologyUrl`, `inputs: {rows (capped), total, cap, gateMix}`,
   `computedAt`; pure `deriveFigureReceipt(issued: IssuedFigure)`.
3. `IssuedFigure` gains optional `inputs`; fill it in the money loaders first (ties
   already in memory — never a second `kgNeighbours`), then contribution (six
   components + committee seats), then law.
4. `getReceiptData` routes figure refs through `liveFigures` (registry-then-live
   order preserved; store down → `unavailable`); `ReceiptBody` figure layout with
   the population line and gate-mix line, each input edge linking its own `h.`
   receipt; `CitableNumber` wraps the `<data>` in a `/zdroj/<ref>` link so the
   existing 12 files' figures become clickable receipts without per-site work.
   ClaimReview JSON-LD stays gated (`toClaimReviewJsonLd`): any non-verified input
   → nothing emitted.
5. `liveFiguresRoundTrip.test.ts` grows: every metric yields a receipt with
   `inputs.total ≥ inputs.rows.length` and a printed cap.

### B. Chamber readings (#7)

6. `features/dashboard/readingClaims.ts` (pure): `prumerna-dochazka` (with
   `population: counted/total`), `pripsatelne-kc` (`isFloor` as modifier text, never
   in the value), `forenzni-posudky`, `prumerny-index`; derivation from the
   population aggregate only when `provenance.state === "uniform"`, else omitted
   (the module refuses to invent one).
7. Tiles + `HeroStory` count through `<CitableNumber>`; `LIVE_DATASETS` gains the
   chamber datasets; resolvers call `getDashboardData()`; `gone` on empty population,
   `unavailable` when the store is down.
8. `lib/claims/registry.ts`: retire the mock-derived `prumerna-dochazka` (keep the
   constitutional 200 and the `/svedectvi` sample under a dataset name that says
   "vzorek"); `docs/routes/overeni.md` and `guide.ts` example updated.
9. `app/dashboard/odecet.json/route.ts`: `readingClaims(getDashboardData())` with
   `Cache-Control` bound to `MONEY_MEMO_TTL_MS`; listed in `feedIndex.ts`.

### C. Vote claims (#15)

10. `features/votetrack/voteClaims.ts`: `psp:person:<pspId>` rebellion rate +
    eligible population (floor `MIN_ELIGIBLE_VOTES` in the basis), club organ id
    cohesion + `riceVotes` (floor `MIN_CLUB_POSITIONAL`), chamber reconciliation
    discrepancies and threshold-differs over `valid`, vote id contestedness
    (`MIN_POSITIONAL_BALLOTS` from `contested.ts`); gate `ungated`; kompas alignment
    explicitly REFUSED as a claim (write the refusal beside the mint).
11. `CitableNumber` on the rebel board, club board, reconciliation sentence,
    threshold coverage, `/poslanec` rebellion header, `/volby` contested rows;
    `VOTE_CLAIM_DATASET` + resolver through `getFullVoteRecord()`; `/volby`
    `claim:volby-census:…` refs become resolvable or are renamed as labels (no
    half-state).

Out of this wave: `/kraj` poster footnotes; receipts for the `/rozpocty` metrics
(G7's `smlouvy-obce` resolver branch is reconciled, not surfaced).

## Owned paths

- `features/shared/provenance/{claimRef,receipt,getReceiptData}.ts`, `ReceiptBody*.tsx`
  + tests (G1's `k=` code stays; extend).
- `features/overeni/liveFigures.ts`, `liveFiguresRoundTrip.test.ts`, `guide.ts`,
  `verdict.ts` (figura family only).
- `lib/claims/**` (`claim.ts`, `registry.ts`, `CitableNumber.tsx`).
- `features/money/moneyClaims.ts`, `features/civicscore/scoreClaim.ts`,
  `features/lawwatch/lawClaims.ts` (the `inputs` fill only).
- `features/dashboard/readingClaims.ts` (new), `DashboardPage.tsx` (tile wrapping),
  `getDashboardData.ts` (export only), `app/dashboard/odecet.json/route.ts` (new).
- `features/votetrack/voteClaims.ts` (new), the boards named above,
  `features/profile/components/*Rebellion*`, `features/volby` claim refs +
  `FindingRow.tsx` (ref rendering only).
- `features/data-releases/feedIndex.ts` (+ test) — G7 also adds a family; append.
- `messages/{cs,en}.json`: `zdroj.*`/provenance, `overeni.*`, `dashboard.*`,
  `hlasovani.*`, `volby.*` (claim copy only).
- Docs owed: `docs/routes/{overeni,dashboard,hlasovani,volby,data,penize,zebricek,zakony}.md`.

## Hot-file policy

- `liveFigures.ts` is yours; keep the `// [G6]`/`// [G7]` branches intact and
  fold them into your dataset registry.
- `features/dashboard/DashboardPage.tsx`: G15 (wave 3) will rework the fallback
  path; limit yourself to wrapping numerals in `CitableNumber`.
- `feedIndex.ts`: append your endpoint; G7 appends its family.

## Honesty rules

- A figure receipt reuses the loader's already-materialised rows; never a second
  neighbourhood read (`kgneighbours-default-limit-is-500`).
- A chamber claim minted while `provenance.state === "mixed"` ships without a
  derivation.
- A person below a floor answers with the floor, not `gone`.
- Every cap ships its population on the receipt.

## Build order

A1 → A2 → A3 → A4 → A5 → B6 → B7 → B8 → B9 → C10 → C11 → docs.

## Report

README shape, plus: metric families with a resolvable receipt (0 → n), claim-bearing
numerals on `/dashboard` (0 → n), `CitableNumber` count under `features/votetrack`,
the reconciled `liveFigures` dataset table, carry-over.
