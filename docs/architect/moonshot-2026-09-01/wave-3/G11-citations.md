# G11 — citation registry and the claim-ref lint ratchet (wave 3)

Cards: deck #4 (every SourceNote keyed to a declared source with a live as-of),
#11 (claim-ref ratchet: an address on every figure). Registry:
claim-verification-and-provenance / claim-ref-addressing, recomputation-receipts;
laws one-definition-one-import, provenance-or-nothing.

Builds on: G5 (structured provenance, `INGESTED_SOURCES` keys as the source
vocabulary), G8 (figure receipts + `CitableNumber` receipt links, `liveFigures`
registry). This group touches the message catalogs broadly — it runs in wave 3
so the catalogs are otherwise quiet.

## Goal of this wave's slice

### A. Citation registry (#4)

1. `lib/sources/registry.ts` (pure, one definition): each source id from
   `INGESTED_SOURCES` with proper name, registry host, license note, cadence key;
   `lib/analysis/atlas.ts` imports `SOURCE_SPECS`/`SOURCE_CADENCE_DAYS` from it
   (behaviour unchanged, pinned by the atlas tests).
2. `sourceStamps()` server read (`lib/db/`-level, `react.cache`d, one `ingest_run`
   query): `{sourceId → {asOf, runStatus, staleness}}`; page-level loaders pass
   stamps as props (the `/hlasovani` template) — never a client fetch.
3. `SourceNote` gains `source?: SourceId` and `stamp?: SourceStamp | null`
   additively: renders "‹name› · stav k ‹date›" and, when `stalenessOf()` says
   stale, the ochre form marker `StatTile variant="illustrative"` uses; `stamp ===
   null` renders "‹name› · stav neznámý" (missing is not zero); unknown id →
   literal + `bez registru` badge, never silent. The primitive still measures its
   children for typography (`docs/DESIGN.md` §3; `no-source-note-size-override`).
4. Migrate catalog citations by source family, in THIS order and one commit each:
   votes (`hlasovani.*`, `zebricek.*`), money (`penize.*`, `poslanec.money.*`),
   law (`zakony.*`), budget/volby. Keep the descriptive tail as `children`. The
   cs/en key-parity tests (`messages.test.ts` per feature) are the gate per family.
5. New rule `custom/require-source-registry` in
   `packages/eslint-plugin-civic-transparency/` (+ shim + RuleTester): a
   `SourceNote` whose text names a registry host without `source=` warns; ship at
   `warn` under `features/**` with the measured inventory written into
   `eslint.config.mjs` exactly as the two existing ratchets are.
6. `/atlas` cards get stable anchors (`/atlas#<sourceId>`); every stamped citation
   links to its card.

### B. Claim-ref ratchet (#11)

7. `rules/require-claim-ref.cjs`: a formatter call in JSX child position must sit
   inside `<CitableNumber claim={…}>` or an element carrying `data-claim-ref`;
   satisfier per FIGURE, `// claim-ok: <reason>` opt-out; same trigger set as
   `require-source-citation`; RuleTester suite mirrors it; seed a violation and
   watch it go red before shipping (§7.6 of the sweep's discipline).
8. Measure repo-wide (`eslint --format json`), record per-file counts in the
   config comment, ship at `warn` under `features/**` (and `error` under `app/**`
   if measured zero there).
9. `lib/claims/registry.ts`: `ISSUED_FIGURES` derived from each feature's
   `*Claims.ts` module (`lawClaims.ts` precedent) with a test that every ref parses,
   is unique, and routes in `liveFigures.ts`; `/data`'s address book prints
   "citovatelné plochy N z M" from the burn-down.
10. Graduate at least ONE route to `error` this wave (`/zebricek` — its figures
    already mint claims), with the loader branch and `liveFiguresRoundTrip` green.

Out of this wave: graduating the other routes (a per-route carry-over list with
counts), the `SourceNote` migration of the 92 expression-built citations.

## Owned paths

- `lib/sources/registry.ts` (new) + test, `lib/analysis/atlas.ts` (import only),
  `lib/db/sourceStamps.ts` (new, server-only) + test.
- `features/shared/components/SourceNote.tsx` + test; `features/shared/components/StatTile.tsx` (read only).
- `packages/eslint-plugin-civic-transparency/**`, `eslint-rules/*.cjs` shims,
  `eslint.config.mjs` (inventory comments + the two new rules), `npm run test:rules` fixtures.
- `lib/claims/registry.ts` + test; `features/*/…Claims.ts` (export lists only).
- `messages/{cs,en}.json` citation strings across features (the migration), page
  loaders ONLY to pass `stamps` props (`get*Data.ts` return shape: additive field).
- `features/atlas/AtlasCards.tsx` (anchors), `features/data-releases` (address book line).
- Docs owed: `docs/DESIGN.md` §3 (citation primitive), `docs/routes/atlas.md`,
  `docs/routes/data.md`, `CLAUDE.md` rule list (two new rules — keep it one line each),
  `packages/eslint-plugin-civic-transparency/README.md`.

## Hot-file policy

- `eslint.config.mjs`: append the two rule registrations and their inventory
  blocks after the existing ratchets; never widen an exemption zone.
- Loader return shapes: add `stamps` as an optional field at the END.
- Catalogs: migrate strings in place; add no unrelated keys.

## Honesty rules

- The as-of is the ingest run's `finished_at`, never the render time.
- A citation whose source has no run renders "stav neznámý".
- A claim ref is never minted without a re-derivation path (the round-trip test).

## Build order

A1 → A2 → A3 → A4 (four commits) → A5 → A6 → B7 → B8 → B9 → B10 → docs.

## Report

README shape, plus: citations carrying a measured as-of (0 → n), distinct psp.cz
spellings in `cs.json` (≥15 → n), `require-claim-ref` inventory per file, routes
graduated, carry-over.
