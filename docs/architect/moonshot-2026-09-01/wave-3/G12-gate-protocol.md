# G12 — verification as a protocol; every export carries an address (wave 3)

Cards: deck #8 (JSON verdicts + whole-article audit), #16 (poster, embed and OG go
through the gate). Registry: claim-verification-and-provenance /
claim-ref-addressing ("claims leave the platform immediately"),
structured-review-emission, three-verdict-vocabulary.

Builds on: G1 (`k=` as-of verdicts), G8 (figure receipts, chamber claims), G4
(fingerprinted graf OG). You own `features/overeni/**` this wave.

## Goal of this wave's slice

### A. Protocol (#8)

1. `features/overeni/wire.ts`: pure serializer `GateVerdict → {verdict, gate,
   value, derivation, citedValue, citedDate, publishedAtCitedDate, receipt,
   schemaVersion}` — message KEYS, not sentences; pinned by a test that walks
   `VERDICT_COPY_KEYS`.
2. `app/overeni.json/route.ts` (GET single; POST batch up to `AUDIT_REFS_CAP`, cap
   and dropped count in the body) and `app/zdroj/[ref].json/route.ts`, sharing the
   loaders; `Cache-Control` per the feed precedent; 503 on an unreadable store,
   never an empty frame; per-request `cache()` dedupes repeated refs; a 429 path
   for over-cap bursts.
3. `refDetect.detectAll(text)`: every politicas URL and every `data-claim-ref`
   attribute in a pasted document; non-citation URLs COUNTED, never dropped
   silently. `OvereniPage` gains document mode with a verdict table, each row
   linking its receipt.
4. `feedIndex.ts` lists both endpoints as machine endpoints; `/data` prints them;
   `feedIndex.test.ts` asserts the routes exist. ClaimReview JSON-LD stays at the
   emitter — the batch API returns the gate state as a field only.

### B. Exports (#16)

5. `features/shared/provenance/exportRef.ts`: one export-address builder
   (append-only grammar, refuse-not-repair, `MAX_REF_LENGTH` discipline): the
   metric family's `claim:` ref(s) or the view fingerprint + as-of day +
   derivation; an undated or `mixed`-provenance sheet issues an address WITHOUT a
   date/derivation segment and the gate says so.
6. `refDetect` learns the `export` family; `verdict.ts` maps it onto the existing
   figura/graf verdicts (no fourth verdict).
7. `features/shared/poster/citation.ts` + `PosterFrame`: `claimLine` as a 4th
   footer line and a QR (inline SVG path, tokens only, no library) rendering the
   same string; must fit A4 within the `poster-sheet` print layer.
8. `features/landing/referendum/embed.ts`: footer `href` = export address;
   `data-claim-*` on the figure cells via `formatCitable` so a scraped embed still
   testifies.
9. `app/opengraph-image.tsx`, `app/referendum/og/route.tsx`: shared
   `ogCitationLines()` printing as-of + pending count + short address (the
   `/graf/p` OG already does; reuse its helper, do not fork it).
10. `liveFiguresRoundTrip.test.ts` extended with an export address per metric
    (coordinate: G8 owned that file in wave 2; you extend it).

## Owned paths

- `features/overeni/**`, `app/overeni/**`, `app/overeni.json/**` (new),
  `app/zdroj/[ref].json/**` (new).
- `features/shared/provenance/exportRef.ts` (new) + test; `refDetect.ts`.
- `features/shared/poster/**`, `features/landing/referendum/embed.ts` (+ test),
  `app/opengraph-image.tsx`, `app/referendum/og/route.tsx`, `app/graf/p/[ref]/opengraph-image.tsx`
  (extract the helper only).
- `features/data-releases/feedIndex.ts` (+ test) — append.
- `messages/{cs,en}.json`: `overeni.*`, `poster.*`, `landing.embed.*`, `data.*`.
- Docs owed: `docs/routes/{overeni,landing,zebricek,data,graf-permalink}.md`.

## Hot-file policy

- `verdict.ts`: G1 and G8 extended it in earlier waves; add the export family as
  a new branch; do not reshape existing verdict objects.
- `feedIndex.ts`: append.

## Honesty rules

- A batch is capped and the cap ships its population; the 429 is part of the
  design, not an accident.
- The QR is a typographic form of the address, never a second address.
- An export from a mixed-provenance sheet carries no derivation.

## Build order

A1 → A2 → A3 → A4 → B5 → B6 → B7 → B8 → B9 → B10 → docs.

## Report

README shape, plus: export lanes with a gate-recognised address (1 → n of 5),
p95 of a 12-ref batch on the test fixture, the document-mode verdict table on a
fixture article, carry-over.

## Addendum from wave 1 (2026-09-05)

- **`grafVerdict` gate modifier.** G4 exported `worstGateOfView(view)` from
  `features/graph/permalink.ts`. Apply, in `verdict.ts`: for the `graf` family
  return `{kind: "gated", info: gateStatusInfo(worst)}` when
  `v.view.worstGate` is non-null, else `ungated`; add `worstGate: GateStatus |
  null` to `HashComparison` (null for `exponat`) filled in `hashedVerdict`.
- **Bill-claim gate modifier.** G2's `forensic_review_state` is now a real
  three-state value (absent renders as absent); the law claim verdict carries it
  as the modifier the same way ties do.
- **`/data` snapshot `limits` per source** (G5 carry-over): the snapshot's
  `limits` gain in-cut vs in-store per `source` from the generated column.
