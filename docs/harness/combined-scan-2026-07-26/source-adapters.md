# Source Adapters — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. Several distinct legal forms are mismapped to "sro", causing wrong-dataset lookups that masquerade as "not found"
- **Lens**: Bug
- **Severity**: Critical
- **Category**: schema-drift / silent-wrong-result
- **File**: lib/ingest/sources/dataor.ts:137-152
- **Scenario**: `resolveCourtAndForm()` is asked to resolve a company whose ARES `pravniForma` is `"111"` (veřejná obchodní společnost, v.o.s.) or `"117"` (komanditní společnost, k.s.) or `"205"` (družstvo, cooperative). `PRAVNI_FORMA_TO_SLUG` maps all three to `"sro"` (the s.r.o. slug). `fetchAndFindRecord(datasetId("sro", "full", court, year), ico)` is then called against the **s.r.o. dataset**, which structurally cannot contain a v.o.s./k.s./družstvo record.
- **Root cause**: These are not "unmapped codes falling back to a heuristic" (the documented, honest failure mode) — they are confident, wrong answers. dataor's own naming convention (`{legalForm}-{variant}-{court}-{year}`) strongly implies separate slugs exist for v.o.s., k.s. and družstvo (distinct legal forms with distinct registries), but the table asserts `"sro"` for all of them with only a code comment ("same slug, not independently verified this session") rather than treating them as unresolved.
- **Impact**: `fetchAndFindRecord` returns `{ datasetExists: true|false, record: null }` for these entities — indistinguishable from "this year's file legitimately has no record for this IČO." Downstream code has no signal that the court/form guess itself was wrong. For Case ① money's ARES VR corroboration hinge (the entire reason this adapter exists per the module's own header), this silently fails to recover exactly the struck-off/officer-history data the module was built to find, for every non-s.r.o. company that hits one of these three codes — a systematic, not edge-case, defect.
- **Fix sketch**: Split `"111"`, `"117"`, `"205"` out of the codelist into an explicit "known-code-but-unverified-slug" bucket that returns `legalFormSlug: null` (forcing the name-heuristic path or a flagged/logged "unresolved-form" outcome) until the real dataor slugs for v.o.s./k.s./družstvo are verified against the live catalog (`packageList()`/`packageShow()`), rather than defaulting them to a form-of-convenience that is guaranteed wrong.

## 2. Pumper release-mirror host filter uses substring match, defeating its own provenance-poisoning guard
- **Lens**: Bug
- **Severity**: High
- **Category**: input-validation / silent-corruption
- **File**: lib/ingest/sources/pumper.ts:105-120
- **Scenario**: `normalizePumperReleases` is documented as importing "only records whose key/url is on the psp.cz host … importing a neighbour's rows would poison provenance." The actual check is `if (!url.includes(hostFilter)) continue;` with `hostFilter = "psp.cz"`. Any record from an unrelated Pumper dataset whose `url`/`key` merely *contains* the substring `"psp.cz"` anywhere — e.g. `https://example.com/redirect?to=psp.cz`, `https://not-psp.cz.evil.example/`, or a query string/anchor referencing psp.cz — passes the filter and is mirrored as if it were a genuine psp.cz release row.
- **Root cause**: `String.includes()` is used where a proper URL-host comparison (`new URL(url).hostname === "psp.cz"` or an endswith-on-hostname check) was intended; the code does not parse the URL at all before filtering.
- **Impact**: A row from a neighbouring Pumper dataset that happens to reference "psp.cz" textually gets ingested into `source_release` with the wrong provenance, exactly the failure mode the comment says this check exists to prevent — and because it's silent (no rejection log, no assertion), the incorrect row is indistinguishable from a real psp.cz release once written.
- **Fix sketch**: Parse `url` with `new URL()` and compare `hostname` (or `hostname.endsWith("." + hostFilter) || hostname === hostFilter`) instead of a raw substring test; treat unparseable URLs as a rejection, not a silent pass-through.

## 3. Kiosek posting dedup-key fallback claims to be "logged" but nothing is ever logged
- **Lens**: Bug
- **Severity**: High
- **Category**: silent-failure / logging-lies
- **File**: lib/ingest/sources/kiosek.ts:338-355
- **Scenario**: When a posting's JSON-LD `url` field is absent, `parsePostings` falls back to a composite dedup key: `` `${institutionCode}:${spisovaZnacka ?? "?"}:${postedAt ?? "?"}` ``. The inline comment states this fallback is "not observed in the cached corpus — logged, not hidden." No `console.warn`, counter increment, or any other observability call exists anywhere in the function for this branch.
- **Root cause**: The comment describes an observability guarantee ("logged") that was never implemented — a case of documentation asserting behavior the code doesn't have. If two distinct postings for the same institution ever legitimately share `spisovaZnacka` and `postedAt` (or both are null, colliding on `"code:?:?"`.), the poll-forward harvester (which dedups by `id`) silently drops the second posting as a duplicate of the first, and nothing in the codebase would ever surface that it happened.
- **Impact**: Silent data loss for one of the two Case ① / Case ③ join-key sources (kiosek), with no operational visibility into whether/how often it occurs — exactly the "success theater" failure mode this audit is scoped to catch, and self-described in the source comments as a risk that is supposedly mitigated but isn't.
- **Fix sketch**: Add an actual `console.warn`/telemetry call (or return a `usedFallbackKey: boolean` field on `PostingRow`) whenever `url` is null and the composite key path is taken, so the "not observed" assumption is continuously verified rather than asserted once and never checked again.

## 4. `UdajeParser` swallows malformed records with zero diagnostics, indistinguishable from a genuinely empty officer list
- **Lens**: Bug
- **Severity**: Medium
- **Category**: silent-failure / data-quality
- **File**: lib/ingest/sources/dataor.ts:246-266
- **Scenario**: `parseObject()`'s loop hits `// malformed input — stop rather than loop forever` and simply `break`s, returning whatever partial object it built so far, whenever a record's `udaje` field doesn't match the expected `key=value;…` grammar (e.g. a stray unescaped character, an encoding artifact, or a future publisher format tweak). `parseUdaje()` never throws and never reports that this happened.
- **Root cause**: The "never throw on malformed input" design choice (reasonable, to avoid aborting a whole batch on one bad row) has no accompanying signal distinguishing "record genuinely has no officers" from "record's officer data failed to parse partway through." Both produce the same downstream shape: an empty or truncated `DataorOfficer[]`.
- **Impact**: Given this exact file's own changelog records a prior real bug of this genre (a whole officer-type category, `DOZORCI_RADA_CLEN`, silently missing from extraction and only caught by a manual Opus audit), a parse-grammar drift or corrupted record would reproduce the same class of silent under-extraction for Case ① money's corroboration data, with no counter or log to flag it for the next audit pass.
- **Fix sketch**: Have `parseObject`/`parseArray` return (or the caller track) a `truncated: boolean` flag when the "malformed input" break is hit, and have `fetchAndFindRecord`/`extractOfficersAndShareholders` propagate/log a warning per-record so malformed rows are visible in ingest run stats rather than silently looking like empty results.

## 5. `fetchWithThrottle` discards all already-fetched responses when one URL exhausts its retries
- **Lens**: Bug
- **Severity**: Medium
- **Category**: error-handling / partial-response-handling
- **File**: lib/ingest/sources/kiosek.ts:176-209
- **Scenario**: `fetchWithThrottle(urls, fetchOne)` sequentially awaits `fetchWithRetry` for each URL and pushes into a local `out` array. If institution #150 of 208 is persistently down (or 429s past the retry budget), `fetchWithRetry` throws; that exception propagates straight out of `fetchWithThrottle`, and the `out` array holding the 149 successfully-fetched responses is discarded with the exception — the caller gets nothing back for the entire batch, not even the successes.
- **Root cause**: The function has no partial-success return path — it's all-or-nothing by construction (throw-on-first-failure with no result already accumulated exposed to the caller).
- **Impact**: A single unreachable/rate-limited institution out of 208 in a scheduled hourly poll can, depending on how the caller handles the rejection, either abort the whole harvest run (losing 149 institutions' worth of fresh postings for that cycle) or — if the caller wraps this in a try/catch that logs-and-continues — silently lose those same 149 fetched-but-unreturned responses with no way to recover them without a full re-run.
- **Fix sketch**: Return a discriminated result per URL (e.g. `{ url, ok: true, response } | { url, ok: false, error }`) instead of throwing, so the caller can persist the successes and retry only the failures on the next cycle, rather than losing an entire batch to one bad endpoint.
