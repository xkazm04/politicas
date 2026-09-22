# /schranka — Občanská schránka

## Current contract

**Routes** — `/schranka` (a follow list with **no account**),
`/schranka/novinky.json` (`force-dynamic`), `/schranka/feed.xml`,
`/schranka/feed.json`.

**The whole state is one localStorage record** — `politicas:schranka:v1`,
owned by `followCodec.ts`, keyed by the SAME public entity keys `/denik`
addresses with `?entita=`. Deltas derive server-side through ONE module
(`getSchrankaDeltas.ts`) over the memoized deník + dukazy loaders, so a feed can
never report different news than the page. **Nothing is stored server-side and
no identity is sent** — only the key list and a day threshold.

**Two visit rules, deliberately different.** The PAGE is lenient: entries are
dated by DAY, so the threshold is the day of the last visit and that day counts
whole (rather show a row twice than withhold it). The BADGE cannot be — under
that rule it would never go dark until midnight — so it subtracts a **seen
watermark** (`visitWindow.ts`). The page states both rules. The visit is stamped
through a one-shot guard BEFORE `setState` (stamping inside the updater
collapses the window under StrictMode), and the day enters every derivation
through `useToday()` — a subscription, never a render-time `new Date()`.

**Owned rules** — `followCodec.ts` (keys, `isEntityKey`, `entityDenikHref`) ·
`visitWindow.ts` · `kindVocabulary.ts` (three forms per kind; an unmapped kind
renders VERBATIM and labelled) · `telemetryScrub.ts` · `getRecomputeFact.ts`.
`KINDS` derives from the TYPED `KIND_NOUN_KEYS`, cross-checked round-trip
against `KIND_ORDER` — two truth sources holding each other, because a
hand-typed set silently slandered the platform's own rows as discarded.

**Privacy contract.** The GET URL is deliberately KEPT — owning a shareable,
bookmarkable address IS the subscription — so `telemetryScrub.ts` scrubs **by
PARAMETER, not by path** (the address appears as an absolute URL, a relative
path and a bare query string; a path rule misses one), across
`contexts.trace.data`, `request.url`/`query_string`, `spans[].data` and
`breadcrumbs[].data`, from both `beforeSend` and `beforeSendTransaction`. A
foreign `e=` is left alone. The copy states the one thing scrubbing does not
change: **the server still sees the request IP.** Honest limit — no DSN exists
in this repo, so verification is at the event level, not at a request observed
in Sentry.

**Standing rules.** An affordance is withdrawn rather than left promising a
delivery nobody can make (`obec:` follows still parse and say exactly why
nothing arrives). A malformed wire row is dropped, COUNTED and disclosed. The
`recompute` row states that the SIZE of the move is unknown — `computedAt` is
one shared instant per pass and the graph keeps no prior-value snapshots — and
is emitted only when the chamber is UNIFORM.

## Dated record

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

**The schema version moves into the payload (2026-08-24).** The record's ADDRESS
stays `politicas:schranka:v1` — permanently; the `:v1` suffix is now part of the
address and never rises again. The SHAPE version is written inside the payload as
`v`, and `readSchranka()` routes a load through an (today empty) migration table
before validating. The change is a hedge taken while v1 is still the only shape in
the field, and it reverses one specific consequence of version-in-the-key that the
original argument did not price: a follow list is user-authored content, not a
cache, so bumping the key on the next shape change would leave the reader's own
list under an address nobody looks at again — experienced as the list vanishing,
not as "no migration was needed". A payload with no `v` IS shape 1 (that is what
every earlier release wrote) and loads unchanged. Version skew is handled in BOTH
directions: a payload written by a NEWER release is detected and deliberately not
overwritten — `useSchranka` refuses the write and says so in the console, because
running on defaults is recoverable and clobbering a newer payload is not. The
repo's reviewed counter-position on version-in-the-key
(`scripts/census/rules.json`, `satisfied: client-state-persistence`) still stands
for its other two cases, which carry no shape at all.

**"o kolik se skóre pohnulo, záznam neříká" stops being unconditional
(2026-09-04, moonshot G1, card #1).** That sentence was true when it was written
and stopped being true when the bitemporal layer landed: `kg_node_history` keeps
the prior versions and `store.asOfNode` reads them. It survived because nothing
had gone back to check. `recomputeDelta` now takes an optional per-MP
`ScoreMove` and prints the magnitude — and `scoreMagnitude` refuses it in three
cases, with the old sentence standing unchanged in every one:

1. **no prior version.** A node with no `contribution_score` in history is not a
   node whose score was zero.
2. **the prior is not a prior.** Same `pass` as today means nothing was
   superseded, so there is nothing to subtract.
3. **the formula changed.** A differing `ref` means the difference would mix a
   formula correction with a movement in the data, and "this MP's score fell by
   3,2" would be a falsehood about a person rather than a fact about a
   computation (`MEMORY.md` → recompute-replay-gate: a corrected formula is
   replayed, not subtracted).

`uniformPrior` holds the same bar the today-side already held — one `{pass, ref}`
for the whole compared set, and one missing prior breaks uniformity rather than
counting as zero. Zero is a legitimate answer and reads as "recomputed, value
unchanged", which is a different sentence from "we do not know the size". The
delta `id` does not change with the magnitude, so the same recompute is still one
row; the number goes through `czech()` (decimal comma) and the bilingual surface
takes `schranka.delta.recomputeTitleSized` while the single-language feeds keep
their literal Czech.

**Carry-over: the read is not wired.** Reading each followed MP's prior version
means one `asOfNode` per key in `features/schranka/getRecomputeFact.ts`, which
was outside the G1 write set (the design owns `recomputeFact.ts` and its test).
Until that lands, `recomputeDelta` is called with no move and every row keeps the
"size unknown" sentence — the honest default, and the one the code already
produces. The pure half ships with its bar so the wiring cannot quietly lower it.

**The feeds are private responses, and `od=` has one parser (2026-09-05,
scan-sweep, security-auditor + parity-auditor).** Both feed routes answered 200 with
no `cache-control` while their address carries the reader's follow list; novinky.json
— same subscription, same loader — already sent `private, max-age=60`. The feeds now
send the same, so no shared cache decides on its own to keep a personal artefact.
In the same pass novinky.json stopped holding its own copy of the day regex and reads
`od=` through `feedSince` like the feeds; only the default differs, and both defaults
are stated at the call site (feeds: first-visit window; badge: everything).
`features/schranka/feedRoutes.test.ts` runs the three handlers over a mocked loader
and pins the policy, the 503 `no-store`, and the parser.

**Origin feedu skládá jedna definice (2026-09-07, scan-sweep, parity-auditor).**
`feedRequest.requestOrigin` byl třetí opis skládání adresy z hlaviček hostu
a proxy schématu vedle /kraj a /plakat (round 37 je sjednotil do
`lib/routing/liveUrl.ts`); teď volá `liveUrl("")`. Chování beze změny: bez
hlavičky host prázdný origin, bez proxy hlavičky `http`.

**Schránka počítá dny v pražském kalendáři, jako server (2026-09-07, scan-sweep,
bounty-hunter).** Server datuje `builtOn` i práh delty pražským dnem
(`getDenikData`), ale klient bral „dnešek" z UTC řetězce (`useToday`), den
razítka návštěvy z prefixu ISO okamžiku (`visitWindow.openVisit`) a `dayOf`
totéž — mezi půlnocí a 01:00/02:00 pražského času měl čtenář jiný den než
server: okno první návštěvy posunuté, odznak přepínal den ve dvě ráno, návštěva
v 00:30 padala do včerejška. Všechna tři místa čtou `pragueDay()`; test
`sinceDay` teď říká, že 23:59 UTC je pražský následující den.

**Odmítnutá odpověď novinek se v cache nedrží (2026-09-07, scan-sweep,
error-handler).** `useNews.fetchNovinky` drží odpověď minutu v modulové cache
a vyhozenou chybu z ní hned vyhazoval — jenže odpověď se stavem mimo 2xx
(503 při nečitelném deníku) vracel jako `null` a v cache ji nechal: odznak po
přechodném výpadku mlčel o minutu déle, než musel. Obě cesty neúspěchu teď
cache vyhazují stejně.
