# /graf — Graph playground

`/graf` — **Graph playground** (features/graph): the full knowledge graph on
a full-viewport `<canvas>`; the page opts out of the app shell
(`isBareRoute`) to own the whole window width — chrome floats over the
stage, breadcrumb links back. **Round 4 in progress — two variants:**
A · Mapa × Trasy (the whole-graph landscape with trails as LENSES: pick a
computed trail and the map dims to context, lights the trail's nodes/edges,
flies to its extent and shows amounts — `StageLens` + `fitBounds` in
GraphStage) vs C · Trasy (the same four computed answers as standalone
ledger-column typesetting). Ohnisko rejected in round 3. All text goes
through GraphStage's single label engine. Node click opens provenance and
registry deep-links from stable ids (`lib/kg/sourceLinks.ts`). Sizing
ground truth: `docs/data-analysis/graph-explorer-scale.md`.
**The citation points at itself, and an outage stops reading as an empty
graph (2026-08-13).** `sourceLinks.ts` builds what the product prints as a
CITATION beside claims about named people and firms — and it becomes the
permalink card's schema.org `isBasedOn`. Four defects fell, three of them the
`detail`/`search` merge the module's own header forbids. **Contract nodes
STORE their canonical registry URL** (`props.sourceUrl`, the dump's own
`<odkaz>`, written by `persist-contract-harvest.ts:145`) and the builder threw
it away, so ~153 k contracts cited a query about their SUPPLIER instead of
themselves; the address is now read from the stored field, never
reconstructed (`/smlouva/<n>` is `idVerze`, the node is keyed on `idSmlouvy`
— `memory/registr-smluv-token-free-access.md`), and a stored value that is
not an absolute http(s) URL is refused rather than rendered. ARES `?ico=` and
`or.justice.cz/rejstrik-$firma?ico=` are demoted from `detail` to `search`
(**the URLs are unchanged — with no network the honest fix is to correct the
CLAIM, not invent a path**), and a `hlidacstatu.cz` address stopped being
labelled „Registr smluv": new Rule 3 in the header says `registry` must name
the host actually linked, because that field is typeset literally.
`citableId` stopped fabricating public numbers — a bill with no `props.cislo`
printed `sn. tisk 43111`, the internal node-id suffix `app/zakony/[cislo]/
page.tsx:8-10` explicitly forbids, and an organ printed `psp id <n>`
indistinguishable from a person's. **A refuted premise died with them**: the
code comment AND `memory/kg-has-no-source-urls.md` both said ingest does not
carry the notice URL onto the node; it does, on **20/20** notice nodes as
`props.postingId`, so vývěsky now cite themselves. Recorded, not fixed:
`TERM_NUMBER = 10` is hardcoded into the tisk address while bill nodes carry
no term field, so after the next term's ingest those citations return a LIVE
psp.cz page about a DIFFERENT bill — not a 404; the fix is a `term` prop at
ingest.
Beside it, `graphLoader.ts` had **zero** `reportLoaderFailure` calls across
its degradation paths while `eslint.config.mjs` excluded `features/graph/**`
from `custom/no-silent-null-catch` — the rule written to catch exactly that —
„until the in-flight round-4 rework lands", which it never did. The ADR
counted four sites; there are **nine** (four early `return null` paths logged
nothing at all). Worse than the missing log line: `graphIndex()` did
`indexPromise ??= buildIndex()`, so a **null was memoised for the whole
process lifetime** — one unlucky boot served an empty `/graf` until restart,
and an empty canvas reads as a REAL empty graph, on the surface whose subject
is what the record contains. `memoNonNull()` memoises success only (the
`open()` / moneyLoader doctrine: neither an empty read nor a failure is
cached), the exclusion is deleted with no suppressions, and
`lib/testing/loaders.test.ts` — which PINNED the gap as the contract —
asserts the new one instead. **A genuinely missing node still leaves no
trace, deliberately**: filing a vanished node as an outage is how people stop
noticing outages. `import "server-only"` joined it in the same pass, retiring
the header's false „`server-only` v projektu není" (it is in `package.json`
and `features/admin/getTripwireData.ts` imports it) — the boundary now fails
at build time, not at runtime.
