# G17 — registry-link contract sentinel (wave 4)

Card: deck #43. Registry: laws provenance-or-nothing,
every-cap-ships-its-population, incident-anchored-doctrine;
claim-verification-and-provenance / derivation-comparison ("never ran must not
read as passed").

Builds on: G5 (sentinel roster append-at-end, `sentinel_run`, the pending-queue
write path), G11 (`/atlas` anchors, `lib/sources/registry.ts`).

## Goal of this wave's slice

1. `lib/kg/linkContract.ts` (pure): `entityContract(subject, html) → boolean` per
   kind — the page must contain the entity's citable id (psp id, IČO, tisk
   number, `č. N/RRRR`); fixture-tested. `search`-tier links are checked for
   reachability only.
2. `scripts/sentinel/probe-links.ts`: deterministic sample per `(kind, registry,
   tier)` pattern (hash-ordered like `layout.ts` `hashId`), rate-limited fetch per
   host (the 429 discipline; hlidacstatu.cz / or.justice.cz may block → the
   pattern is `unevaluable`, never `ok`), emits the sentinel report schema with
   `ok / violation / unevaluable` per pattern and `probed / drawn-from`.
3. `link_probe_run` table (`-- [G17 link probes]` block at the END of `CORE_DDL`),
   written through the sentinel's pending queue (never the live handle).
4. `/atlas` fifth dimension "dohledatelnost" reading the latest run; UNRATED
   when no run exists (the discriminated-union discipline, never zero); the
   receipt (`receipt.ts` endpoints) and `NodeInspector`/`PermalinkPage` print
   `lastProbed: string | null` next to each link.
5. Replace `TERM_NUMBER = 10` in `lib/kg/sourceLinks.ts` with the bill's stored
   term prop; the first expected violation of the probe is a PSP11 tisk.

## Owned paths

`lib/kg/{linkContract,sourceLinks}.ts` (+ tests), `scripts/sentinel/probe-links.ts`,
`lib/db/pglite/ddl.ts` (append block), `lib/db/pglite/repositories/linkProbes.ts`
(new), `lib/testing/sentinel/**` (append), `lib/analysis/atlas.ts` (fifth
dimension, additive), `features/atlas/**`, `features/shared/provenance/receipt.ts`
(`lastProbed` field), the two graph components (print only),
`messages/{cs,en}.json` (`atlas.*`, `graf.*`), docs `docs/routes/{atlas,graf,graf-permalink}.md`,
`docs/db-architecture-guide.md`.

## Report

README shape, plus: patterns with a dated probe on the fixture (0 → n), the
`unevaluable` hosts, carry-over.
