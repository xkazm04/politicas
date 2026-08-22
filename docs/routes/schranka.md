# /schranka — Občanská schránka

`/schranka` — **Občanská schránka** (features/schranka): a follow list with no
account — the whole state is one localStorage record (`politicas:schranka:v1`,
`followCodec.ts`) keyed by the SAME public entity keys `/denik` addresses with
`?entita=` (`poslanec:<pspId>` · `tisk:<č>` · `firma:<ičo>` · `obec:<ičo>`).
Deltas derive server-side at `/schranka/novinky.json` (`force-dynamic`) over
the memoized deník + dukazy loaders; nothing is stored server-side and no
identity is sent — only the key list and a day threshold.
**Two visit rules, deliberately different (2026-08-04).** The PAGE is lenient:
entries are dated by DAY, so the threshold is the day of the last visit and
that day counts whole (rather show a row twice than withhold it). The BADGE
cannot be — under that rule it would never go dark until midnight — so it
subtracts a **seen watermark**: on each visit the page records how many
entries of that day it actually showed (`SchrankaState.seen`), and the badge
deducts it while the day matches (`visitWindow.ts`, pure + tested; the page
states both rules). The visit is stamped through a one-shot guard BEFORE
`setState` — stamping inside the updater collapsed the window under
StrictMode's double invoke — and the day enters every derivation through
`useToday()` (a subscription, not a render-time `new Date()`, which the effect
deps never saw across midnight). `parseNovinkyResponse` validates entries
field by field; a malformed row is dropped, COUNTED and disclosed.
**Follow lives where the entities live.** `FollowButton` (one component,
reused — compact and icon-only densities) is inline on `/poslanec`, every
`/zebricek` row, `/penize/firma/[ico]` and the `/denik` entity view, beside a
backlink to /schranka; its accessible label NAMES the entity, and the nav
badge is a permanent `aria-live="polite"` region. Schránka copy lives in the
catalogs since 14f0f51 (2026-08-05, `schranka.*` + `common.follow*`) — the
„hardcoded Czech" era ended with /denik's.
**`firma:` links to `/penize/firma/<ičo>`** since that page exists (6bc8780) —
in the codec AND in `deriveDenik`'s company entity, both normalizing through
`canonicalIco()`, so a contract row in the deník now links to the company
whose contract it is instead of the first MP. **`obec:` is no longer offered**:
`deriveDenik` emits only `poslanec:`/`firma:`/`tisk:` keys (no stream is keyed
by a municipality; budget mirrors are an annual batch, not a dated stream), so
the affordance was withdrawn rather than left promising a delivery nobody
could make. Stored obec follows keep parsing and say exactly why nothing
arrives.
**The digest names its kinds, and a recompute is a delta (2026-08-04).** Every
delta row has carried a `kind` since wave 1 and the page rendered an
undifferentiated list; `EntityDelta.kinds` now counts them **before the
`DELTA_ENTRIES_CAP` slice** (so the header summary — „3 smlouvy · 1 rozhodnutí
brány" — describes the whole delta, not what fitted), and
`features/schranka/kindVocabulary.ts` is the ONE Czech vocabulary (three forms
per kind for 1 · 2–4 · 5+, pinned to the language gate; an unmapped kind renders
VERBATIM and labelled, never hidden — the `tieFlags.ts` precedent). The wire
validates the summary rather than re-deriving it from the capped rows.
The new kind is **`recompute`**: person nodes carry
`contribution_provenance {pass, ref, computedAt}`, so „your MP's index was
recomputed" is a real dated fact the deník cannot see (it is keyed by contracts,
roles, bill steps and the gate). It is ONE row per followed `poslanec:`, dated
`computedAt`, citing pass + ref and linking `/metodika` — and it states in its own
sentence that **the size of the move is unknown**: `computedAt` is one shared
instant per pass and the graph keeps NO prior-value snapshots, so a per-MP
„skóre se pohnulo o X" would be a fabricated number. It is emitted only when the
chamber is UNIFORM on `{pass, ref, computedAt}` (`recomputeFactFromProps`, which
reuses `summarizeContributionProvenance` rather than growing a second aggregator
of one fact); a half-recomputed store reports `coverage.recompute: false` and the
page says so. The row counts into `total`, so the nav badge sees it and the seen
watermark clears it like any other entry.
Reads: `getRecomputeFact.ts` is a `react.cache()`-wrapped **single indexed
`listKgNodes({kind:"person"})` at `KG_READ_CAP`** — a strict subset of what
`getLeaderboardData()` already reads, chosen over it because building the
leaderboard costs 424–522 ms warm for three fields the badge asks for on every
page. All subscription addresses now build through ONE server module
(`getSchrankaDeltas.ts`), so a feed can never report different news than the page.
**The follow list stays out of telemetry, and becomes a feed (2026-08-04).** The
page and `followCodec`'s header both claimed the list reached the server „pouze
jako parametry dotazu … žádná identita" — true about cookies, false about
consequences: `sentry.server.config.ts` samples traces at **1,0**, so with a DSN
configured every request URL would enter Sentry, and a 20-MP follow list plus an
IP is a fingerprint however public each key is. **Measured** against a real SDK
event (`telemetryScrub.test.ts` runs `Sentry.startSpan` through
`beforeSendTransaction` with a stub transport): set only `url.full` and
`@sentry/node` 10.67 copies the query into `http.query` as well — a field nobody
set. `features/schranka/telemetryScrub.ts` therefore scrubs **by PARAMETER, not by
path** (the address appears as an absolute URL, a relative path and a bare query
string; a path rule would silently miss one): every `e=` whose value is a valid
entity key is dropped and replaced by `e_count=<n>`, across `contexts.trace.data`,
`request.url`/`query_string`, `spans[].data` and `breadcrumbs[].data`. A foreign
`e=` is left alone. Both `beforeSend` and `beforeSendTransaction` run it.
**Honest limit: no DSN exists in this repo, so verification is at the event level
— the event the SDK builds — not at a request observed in Sentry.**
The GET URL is deliberately KEPT (the reader owning a shareable, bookmarkable
address IS the subscription), and the copy now states exactly that, including the
one thing scrubbing does not change: the server still sees the request IP.
**`/schranka/feed.xml` + `/schranka/feed.json`** are that subscription — the same
`?e=…&od=…` address, the same key guard (`parseFollowKeys`), the same deltas
(`getSchrankaDeltas`), and **the same serializer**: `features/denik/feedCodecs`
grew an optional `channel` (title/description/home/feed URL, guid prefix, entry
URL) plus a `DenikFeedItem` type of what it actually reads, so the schránka is a
second channel rather than a second RSS/JSON codec, and the deník's own output is
byte-identical (its tests pin it). The schránka's guid prefix is
`politicas:schranka` because a recompute row is not in the deník, and an item's
permanent address is its own page (`/metodika`, the file, the tisk) rather than a
deník day anchor that would not contain it. A row followed through two entities is
emitted ONCE. The channel description states what the URL encodes, that nothing is
stored server-side, and that the keys are scrubbed from telemetry; both routes
503 on an unreadable store (the `/denik/feed.*` precedent) and the JSON side is
validated by the SAME `parseEvidenceFeedJson` both deníky use.
**The schránka stops slandering its own rows (2026-08-12).** `novinky.ts`'s
hand-typed nine-kind Set was missing `mandate` + `organRole` (kinds the
deník emits since round 6), so the platform's own rows would be dropped AND
counted into „N řádků … byly zahozeny" — the badge saying 5 while the page
shows 3 plus an accusation, with the FEED still carrying the rows (the
exact page/feed divergence `getSchrankaDeltas` exists to prevent). KINDS
now derives from the TYPED `KIND_NOUN_KEYS`, cross-checked round-trip
against `KIND_ORDER` — two truth sources holding each other. `DenikLimits`
ride the novinky wire (validated field-by-field, half a block yields
nothing) and render through the IMPORTED `limitNotes` — the deník's own
sentences plus one schránka framing line; `ledger` is passed `null`
deliberately (merged-row/conflict counts are properties of the rendered
day-book the schránka doesn't build). The feed channel description names
both caps (`SCHRANKA_FEED_ITEMS` 100 / `DELTA_ENTRIES_CAP` 25,
interpolated). `recomputeFactFromProps` collapsed onto
`prov.computedAt` — one aggregator, fails closed, pinned.
