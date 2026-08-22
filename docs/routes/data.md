# /data — Datové verze

`/data` — **Datové verze** (features/data-releases): the release train of the
data layer (version, cut date, cardinality gates, integrity, snapshot,
changelog). **It is also the app's feed address book since 2026-08-04** — four
feed families (`/denik`, `/dukazy`, `/zakony/kolize`, `/schranka`) share ONE wire
(RSS 2.0 + JSON Feed 1.1, one validator `parseEvidenceFeedJson`) and no page
named any of them; the addresses lived in route-handler headers.
`features/data-releases/feedIndex.ts` is the pure list (what each carries, what
limits it, `FEED_ENTRIES` imported rather than retyped), plus the three machine
endpoints that are NOT feeds (`/schranka/novinky.json`, `/data/manifest.json`,
`/data/snapshot.json`) kept in a separate list so the page cannot claim a format
that does not hold. The schránka's row states its parameterized nature in full:
`?e=<klíč>` repeated + `?od=RRRR-MM-DD`, nothing stored server-side, keys scrubbed
from telemetry — and that the server still sees the IP. Counts are computed from
the list (`FEED_ADDRESSES`), never written as digits, and the section's index is
derived from what renders (5 with the store, 1 without — the addresses hold even
when the graph does not, because a feed then answers 503, not emptiness).
`feedIndex.test.ts` checks every address against the real `app/` tree and puts the
prose through the Czech language gate.
**`app/sitemap.ts` exists (2026-08-04).** `robots.ts` said what NOT to crawl and
nothing said what to crawl, so the whole evidence half of the platform waited to
be found by accident. The route list is DERIVED from `navModel`'s own two
declarations (`NAV` + `UNLISTED_ROUTES`) via `features/shell/publicRoutes.ts` —
the same decision that puts a page in the rail puts it in the sitemap — minus the
paths `robots.ts` disallows (`DISALLOWED_PATHS`, now exported and imported, never
retyped: a sitemap advertising a Disallow-ed path is two files contradicting each
other) and minus dynamic segments. **23 routes live**, `/penize/kontrola`,
`/rentgen` and `/admin` excluded. `/poslanec/<id>`, `/zakony/<číslo>`,
`/penize/firma/<ičo>` and `/zdroj/<ref>` are deliberately absent — enumerating
them means reading the graph per request — and /data says so out loud. Base URL
comes from request headers (the four feeds' precedent: honest localhost in dev,
never an invented domain), hence `force-dynamic`; `lastModified` is omitted
because no route records one and the build clock is not a content date.
`publicRoutes.test.ts` scans `app/` and fails on any static public page missing
from the sitemap.
**The snapshot says what is NOT in it (2026-08-13).** `/data` offered a
downloadable „civic graph snapshot" under the words „Co si stáhnete dnes,
můžete citovat", and the artifact **contained no politicians at all**:
`SNAPSHOT_NODE_CAP = 20 000` against ~153 720 nodes read `order by id limit`,
i.e. an ALPHABETICAL PREFIX, not a sample. Measured on a real store copy, the
cut is `bill 141 · bloc 2 · company 214 · contract 19 643` — **absent: law
(293), notice (20), organ (33), party (8), person (207), theme (14)**. Edges
are worse: ordered `src, rel, dst`, so the window is `amends 582 ·
assigned_to 150 · owns_stake 2 · supplies 19 266` and **11 of 15 relations are
absent, including `linked_to` (211)** — every human-gated MP↔company tie, plus
`co_votes_with` (20 496) and `sponsors` (528). `buildSnapshot` already computed
`truncated`/`nodesIncluded`/`nodesTotal` correctly and `DataReleasesData`
carried NONE of them, while §01 printed the full corpus count. `limits` now
carries `nodeKinds`/`edgeRels` (in-cut vs in-store), measured **on the very
rows that ship**, with totals from the census the manifest already read —
**zero new store reads** — and §03 prints the four figures, the
prefix-not-a-sample rule, the named absent kinds and relations, and two
composition tables. The page and `/data/snapshot.json` cannot disagree:
`loader.test.ts` compares the page's `limits` against the **parsed serialized
payload**, not the type. **Raising the cap was ruled out**, not overlooked — a
bigger silent prefix is still a silent prefix. Same pass: the page stopped
building a ~27 MB JSON string and a second ~28 MB encoder buffer **per view**
to keep one integer (`measureSnapshotBytes()`, byte-identical on the real
artifact at 28 758 744 B, 495 ms vs 693 ms, post-GC retained heap −54,3 MB),
memoized on `MONEY_MEMO_TTL_MS` **keyed on `manifestHash`** so any ingest
self-invalidates; only numbers are cached, never rows, and the download never
reads the memo. Honest limit: the `warnIfTruncated` false positives (two per
view — `/data` was burying the repo's own early-warning signal for real silent
loss) are reduced to twice per manifest fingerprint plus once per download, not
to zero; eliminating them needs a declared-cap opt-out in
`lib/db/pglite/{internals.ts,repositories/kg.ts}` and is recorded as a
follow-up rather than smuggled in.
**The contract floor stopped certifying a catastrophe as `latest`
(2026-08-13).** `CARDINALITY_FLOORS.contract` stood at 1 500 against 152 788 —
**0,98 %** — so the release gate printed `SPLNĚNO` and `deriveReleaseManifest`
stamped `latest`/`degraded: false`, and would have done exactly the same for a
regression that deleted 98,7 % of the contract corpus. The floors last moved
2026-07-26; money batch 012 grew contracts 2 287 → 152 788 the NEXT DAY and the
floor did not follow, while the doc comment still described the store two
orders of magnitude off and instructed raising floors alongside major ingests.
Now 100 000 (65 %), **and only that floor moved** — `storeReady()` reads the
same table for every public loader, so an over-aggressive floor takes the whole
product to its fallback. The rule is written in code against the corpus each
floor guards, with the corpus and ingest that set it recorded per row, so the
next ingest has something to check against. Pinned both ways: a 99 % loss
(1 528 survivors — **above the old floor**) degrades the release; today's
corpus passes.
