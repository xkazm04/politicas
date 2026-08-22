# /denik — Deník republiky

`/denik` — **Deník republiky** (features/denik): the chronological daily
record of the state — signed contracts of firms MPs own/run, committee
assignments, Sbírka publication, registry role starts/ends, human-gate
decisions and the `change_event` „zaznamenáno" stream. Copy is BILINGUAL
since 14f0f51 (2026-08-05; the „hardcoded Czech" doctrine ended there —
`features/denik/messages.test.ts` pins the namespace). `getDenikData.ts`
re-uses `getMoneyData` / `getLawData` and the SHARED gate reader (below;
batch layers memoized on `MONEY_MEMO_TTL_MS`); every layer degrades
independently and `coverage` says which groups the page can carry.
`?entita=<klíč>` is the subscription — the same public keys /schranka
follows — and `/denik/feed.{xml,json}` serialize the same filter.
**Two journals, one truth (2026-08-12).** Both public gate chronicles
(/denik + /dukazy) printed the `review_audit` row count as a COUNT while
reading at the repository's hard 10 000 cap — whose own comment warns a
truncated read „publishes a wrong number" — and neither page could say so.
`features/dukazy/readReviewAudit.ts` is now the ONE shared gate read (rows +
endpoint labels + `truncated` + cap): `cache()` for request identity plus
IN-FLIGHT promise sharing (the half that dedupes /schranka's `Promise.all`
over both loaders — measured: `react.cache()` without a React dispatcher
does not dedupe at all, so only this half is vitest-testable, and the test
FALSIFIES it: removing the share makes two reads), NOTHING memoized across
requests (a reviewer's decision must never lag a batch window). Truncation
of the audit read AND of the 5 000-cap `change_event` read (newest-first —
truncation eats the OLDEST history, a systematic loss) is detected by the
`warnIfTruncated` shape, counted into `DenikLimits`, and rendered: /denik's
limit notes now come from the PURE `features/denik/limitNotes.ts` (it was a
private function inside the page — the one place deciding whether a
truncated read gets admitted, and unpinnable), /dukazy appends a floor
sentence beside its only figure. The journals also cross-link on the SHARED
id at last: a /denik gate row's evidence pointer links `/dukazy#z-<id>`
(the `evidenceAnchor`/`evidenceHref` codec in deriveFeed — ONE owner of
that shape), and a /dukazy tie entry links its MP's deník day through
`entityDayHref(mpEntityKey(…))` — imported, null on an unreadable instant,
and a forensic entry (`mpPspId: null`) gets no link because a signed
verdict has no deník day. The deník's `changeLayer()` unified backfill +
read on ONE memo window (the displayable set cannot change between
backfills — review-decision events are excluded and mandate/role types
have no request-time writer; honestly stated: measured on the pass-55
backup where `change_event` is empty, so the memo rests on the invariant,
not a measured cost). The false „STRIKTNĚ read-only tři vrstvy" header
(backfill WRITES) and the 35-vs-57 vintage drift died in the same pass.
**The deník speaks correct Czech about entities, and its feeds tell the
truth (2026-08-12).** The six counted honesty sentences (`limits.*`) were
ungrammatical at n=1–4 in BOTH locales — the namespace carried ZERO ICU
plurals; all six are now cs one/few/other + en one/other, the number
passed TWICE by design (raw `n` selects the branch, `nFmt` via lib/format
renders — a formatted string turns PluralRules into NaN), and the Czech
gate now strips only ICU KEYWORDS so every plural branch stays gated
(falsified: English inside a `few` branch fails). /schranka re-renders
the same keys via imported `limitNotes` and needed no change. The entity
empty state names the THIRD cause (a dark layer, in the coverage banner's
own words); a malformed `?entita=` gets its own sentence naming the four
held shapes instead of a false „matches nothing" plus an inbox promise
above a silently-null FollowButton (`isEntityKey` imported, never a
second regex); `generateMetadata` reads searchParams so autodiscovery
advertises the FILTERED feed on entity views; corpus-wide counters
(computed before the entity filter) are labelled corpus-wide where they
render inside a filtered view; the účinné/zaznamenáno badge explanation
is real `sr-only` TEXT (aria-label on a generic span is ARIA-prohibited
and dropped). The feeds: `denikFeedDescription()` interpolates
FEED_ENTRIES (the description claimed no cap while both routes slice —
and it cuts by ENTRY, not day, which `daysNote` used to misstate);
`feedNotes.ts` folds coverage + reached limits into the CHANNEL
description (loss-only: a dark layer is no longer indistinguishable from
a quiet week at HTTP 200; no synthetic items); filtered item permalinks
ride `entityDayHref` (measured: the poslanec:6881 feed spans 74 days and
61 of them the unfiltered page never renders — every one was a dead
anchor); junk `?entita=` answers 400 naming the held shapes BEFORE any
store read (a valid key matching nothing keeps its honest 200); both
routes carry the house cache header; schránka feed bytes pinned identical
at the codec that could break them.
**The day is a PRAGUE day since 2026-08-04** (`features/denik/pragueDay.ts`).
`builtOn` was `new Date().toISOString().slice(0,10)` — UTC — on a ledger whose
whole subject is Czech days. Between local midnight and 01:00/02:00 the Prague
day runs one day AHEAD of UTC, so a contract signed „today" in Prague fell past
`deriveDenik`'s `date <= today` bound and was counted into **`droppedImplausible`
— the counter with which the page discloses CORRUPT DATES IN THE CORPUS**. A
server timezone was inflating an honesty counter. Intl is allowed there and
nowhere near render: the value is computed server-side and crosses to the client
as data, while `czechWeekday` stays pure arithmetic (ICU version skew would trip
hydration). DST is read from the zone per instant, never a constant, and the
day's midnight is resolved two-pass so the spring-forward day gets the offset in
force AT midnight (`+01:00`), not after it.
**`date_published` is RFC 3339 since 2026-08-04.** The JSON feed emitted a bare
`YYYY-MM-DD`, which JSON Feed 1.1 does not permit; the shared
`parseEvidenceFeedJson` never caught it because it only checks `typeof string`
(/dukazy passes a full ISO instant). A deník row carries a DAY, not an instant,
so the stamp is that day's **Prague midnight with its own offset**
(`2026-08-04T00:00:00+02:00`), and RSS `pubDate` is derived from the same instant
so the two formats cannot date one row differently. An undatable day emits no
stamp rather than a guess. Feed order (date descending) is now pinned by test at
the codec boundary — `DenikTeaser` reads „the latest day" as `items[0]` and
nothing across the format boundary held that.
**Every silent loss is now counted and disclosed (2026-08-04).** Four leaks,
all of them the same failure — a limit that drops a row without a sentence,
on a page whose `droppedImplausible` counter exists precisely to say the
opposite. (1) The per-company `kgNeighbours` edge cap was **500 and silent**:
measured on the live graph, **5 of 35 companies returned exactly 500** and
**4 872 contracts** — more than the whole ledger carried — never reached the
page. The cap is now `MAX_CONTRACT_EDGES = 5 000` (live max 2 387; reading all
57 attributable companies costs **1 468 ms vs 1 009 ms**, once per memo
window), truncation is detected by the `warnIfTruncated` shape (length ===
limit) and rendered as a counted note. Live: contract rows **4 380 → 9 252**,
companies truncated **0**. (2) A contract node reached through two supplier
companies emitted TWO rows with the same `contract:<id>` — a duplicate React
key and a duplicate feed guid (**5 such nodes live**). Rows are merged one per
node: suppliers all named (IČO asc), MP and company entities UNIONed, `pending`
disjoined, and the **amount kept only when every input agrees** — otherwise no
amount and a counted conflict, because picking one would be inventing money.
(3) IČO is validated at the loader with `canonicalIco` (imported, not forked):
the entity key used to be built from the RAW string while the href used the
canonical one, and an empty IČO collapsed every IČO-less company into one
`firma:` key that `/schranka`'s `isEntityKey` then silently refuses. A
non-canonical IČO now yields NO company entity — the row still renders and the
count is disclosed (live: **0**). Role ids fall back to the company NAME so two
IČO-less companies of one MP cannot merge. (4) `change_event` declares 10 types
and the deník rendered 3, so an emitted `mandate-removed` had no surface at
all. `DENIK_CHANGE_TYPES` is now the closed union of **9** (all but
`review-decision`, which the deník reads from `review_audit` itself and counts
separately), with two new `DenikKind`s — `mandate` and `organRole` — placed in
`/schranka`'s `KIND_ORDER` and `KIND_NOUNS` in the same order the deník uses.
The sentences say **„v evidenci"**: a snapshot diff knows the row left the psp.cz
dump, not why or when. `pending` is a fact about a TIE, so mandate/organ rows
assert nothing about review. A type this build cannot speak is counted and
disclosed, never dropped. Change rows also cite the event's own verbatim
`source` (`kg_edge_history` / `diff snímků ingestů — psp.cz`) instead of the
table they landed in.
**Rows cite like /dukazy, and read like a ledger (2026-08-04).** A row named a
registry in brackets and linked nothing — a citation the reader could not
follow, next to /dukazy rows that carry real links off the identical IČO.
Company-keyed rows (contract, registry role, gate decision) now link the SAME
trio through the SAME `buildRegistryLinks` /dukazy uses, so two ledgers of one
platform cannot send a reader to two different registries; bill rows link
psp.cz through `sourceLinksFor` (`lib/kg/sourceLinks.ts`), which is the builder
that knows what a tisk is — both imported, neither forked, and a company with
no canonical IČO gets no link rather than an address into nothing. Change rows
finally carry `change_event.evidence` (the designed evidence pointer, which the
loader had never mapped) as deterministically sorted key/value pairs. Live:
**136 of 136 rendered rows carry a link**, none without.
Reading layer: a day is an `<article>` and its entries a real `<ul>`/`<li>`
(they were bare `<div>`s, so a screen reader could not tell it was a list or
how long); `<time dateTime>` on the day masthead and, `sr-only`, on every row;
the `účinné` / `zaznamenáno` badges carry their explanation AT the badge
(`title` + `aria-label`, dotted underline as the visible affordance) instead of
200 px away; and the kind is rendered as a WORD (`features/denik/kindLabels.ts`,
pure + language-gate pinned) with the tone dot demoted to decoration — it was
`aria-hidden`, so the deník's own taxonomy did not exist for assistive tech,
print, or anyone who cannot separate four hues. An unknown kind prints its token
VERBATIM and labelled untranslated (the `tieFlags.ts` precedent). The vocabulary
is deliberately NOT /schranka's `KIND_NOUNS`: that one inflects for a COUNT
(„3 smlouvy"), this one names ONE row.
**The ledger is one hop from its subjects (2026-08-04).** The deník is keyed by
`poslanec:` / `firma:` / `tisk:`, and the three pages that ARE those entities led
into it from one: `/poslanec` (wave 1). `/zakony/<číslo>` now links its tisk's
deník (only when `bill.cislo` exists — a tisk with no number has no key, and the
filter would select nothing), and both money case files link theirs:
`/penize/<pspId>` beside the packet/gate links, `/penize/firma/<ičo>` beside the
follow button that already used the same key. **No fourth copy of the address**:
the key comes from `deriveDenik`'s own `mpEntityKey`/`companyEntityKey`/
`billEntityKey` and the address from `followCodec.entityDenikHref` — both
imported. `ProfilePage`'s inline `/denik?entita=${encodeURIComponent(…)}` literal
and `CompanyCaseFilePage`'s inline `firma:${ico}` key were the two forks and are
gone. (`features/dashboard/entityLinks.ts` keeps its own `denikEntityHref` on
purpose — importing `followCodec` there is not worth the reshuffle, and both are
pinned by tests.)
**/dukazy counts what it throws away, and publishes the chain (2026-08-13).**
The gate bulletin's empty state rendered **„0 řádků; žádný záznam není
zamlčen"** while the same request read every bill node and discarded **141
`pending_review` forensic verdicts, uncounted** — and `section.source` two
lines above cited `kg_node bill.forensic_*` as a source. The journal is a
QUEUE AT CAPACITY and read as a dead feature. `isPublishedForensic` is now the
ONE predicate for both the filter and `withheldForensic()`, the count renders
with its verbatim state tokens, and **„nothing is suppressed" became a DERIVED
conclusion** (`limits.nothingWithheld`), spoken only when the cap did not bind,
the queue is empty AND all three layers were read. The three silent `catch`
blocks now travel their outcome to the reader (`forensicRead` /
`tieSourcesRead` / `labelsRead`), each naming the fidelity that was LOST rather
than implying absent data, and `section.sourceNoForensic` stops citing a source
the loader failed to read. Both feeds stopped asserting „každé rozhodnutí" over
a 10 000-row capped read — the shared cap clause is **composed by `/denik`'s own
`denikFeedNotice()`, imported and pinned to byte-identity with it**, not written
a second time. Two `limit: 100_000` literals went through `KG_READ_CAP`.
Found on the way and worth keeping: **the Czech language gate SKIPPED ICU plural
branches**, so the new 141-verdict sentence would have entered ungated; the gate
now strips only ICU keywords (the /denik precedent) and English inside a `few`
branch fails.
And the bulletin of the hash chain finally publishes the chain: `review_audit`
carries `chain_pos`/`prev_hash`/`row_hash`, the columns were SELECTed and then
dropped by the mapper, so a journalist could not verify a single published
decision — while the only pointer offered was `/admin`, which is `ADMIN_TOKEN`
gated AND in `DISALLOWED_PATHS`, and the PUBLIC `/data` was already rendering
chain length and head hash. Chain position and row hash now render per row and
in both feeds, `method.body` points at `/data` (a test bans `/admin` across the
whole namespace), and the note states what the chain proves — ORDER and
non-tampering, explicitly **not** correctness. Receipts use the ONE ref grammar:
`edgeClaimRef` imported, then **decoded back and refused on mismatch**, and
`AuditRowLike.rel` is required so the ref cites the row's own relation rather
than a hardcoded `linked_to`. The shared row fields are additive and optional,
and that is proved EMPIRICALLY over a real PGlite (`chainRow.test.ts` writes two
decisions, reads them back through the mapper, and `verifyAuditChain` passes over
fields built exclusively from the mapper's output; falsified by nulling the
mapper → `gap-in-chain-pos`). `feedIndex.ts`'s existing promise that this family
carries a chain link was made TRUE rather than edited — it belongs to another
surface's write set, and the payload was the honest place to fix it.
