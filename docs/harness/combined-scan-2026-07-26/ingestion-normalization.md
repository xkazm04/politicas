# Ingestion Normalization — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. Deflate decompression has no output-size ceiling (zip-bomb)
- **Lens**: Bug
- **Severity**: Critical
- **Category**: resource-exhaustion / adversarial-input
- **File**: lib/ingest/zip.ts:67
- **Scenario**: A crafted or corrupted psp.cz-style ZIP contains one member whose compressed size is small (a few KB) but whose deflate stream expands to gigabytes (a classic zip bomb — arbitrarily achievable since `compressedSize` and the raw bytes are attacker/publisher controlled once this path is fed any untrusted or mirrored archive).
- **Root cause**: `bytes = new Uint8Array(inflateRawSync(raw))` calls `inflateRawSync` with no `maxOutputLength`/size cap and no streaming — the whole decompressed member is materialized in one synchronous allocation before any validation of its size happens.
- **Impact**: A single malicious or corrupted dump can exhaust process memory or hang the event loop for the entire ingest run (and this module is shared by every source adapter, so the blast radius is every ingestion job, not just one feed).
- **Fix sketch**: Pass `{ maxOutputLength: <sane cap, e.g. 512 MB> }` to `inflateRawSync` (Node supports this option and throws when exceeded), or track the uncompressed-size field from the central directory record and reject entries whose declared/actual size exceeds a threshold before/while inflating.

## 2. Corrupt/adversarial ZIP causes silent truncation instead of a hard failure
- **Lens**: Bug
- **Severity**: High
- **Category**: silent-data-corruption
- **File**: lib/ingest/zip.ts:60-68
- **Scenario**: A truncated or tampered archive has a central-directory `compressedSize` or `localHeaderOffset` that points past the actual buffer end (e.g. download cut short, or a hostile mirror). `buf.subarray(dataStart, dataStart + compressedSize)` silently clamps to `buf.length` instead of throwing, so `raw` is shorter than declared.
- **Root cause**: The module's own header comment promises "rejected loudly rather than silently mis-read" for unsupported formats, but that guarantee is not backed by bounds-checking the offsets/sizes read from the (untrusted) central directory against the actual buffer length before slicing.
- **Impact**: For `method === 0` (stored), the truncated slice is accepted as-is and becomes UNL bytes with the tail silently missing — `parseUnl` will then drop or corrupt the last rows without any error surfaced, contaminating every downstream adapter with a partial file that looks like a successful ingest. (For `method === 8`, `inflateRawSync` may or may not throw depending on how much of the stream is missing, so the failure mode is inconsistent.)
- **Fix sketch**: After computing `dataStart`/`compressedSize`, assert `dataStart + compressedSize <= buf.length` (and `dataStart >= 0`) and throw a named error (consistent with the ZIP64/encryption checks already in this file) instead of letting `subarray` clamp silently.

## 3. `colInt` accepts numeric strings with trailing garbage
- **Lens**: Bug
- **Severity**: Medium
- **Category**: input-validation / silent-data-corruption
- **File**: lib/ingest/unl.ts:83-88
- **Scenario**: A UNL column value of `"123abc"`, `"45|"` (mis-escaped pipe merged into the field), or any numeric-looking-but-malformed string is parsed via `Number.parseInt(v.trim(), 10)`, which returns `123` / `45` instead of failing.
- **Root cause**: `Number.parseInt` performs a prefix parse and silently ignores non-numeric trailing characters; the function only guards against total parse failure (`Number.isFinite`), not partial parse. This is inconsistent with the file's own stated philosophy in `czDateToIso` ("a wrong date … is worse than a missing one" — the same is true for a wrong id/organId).
- **Impact**: A malformed or subtly corrupted UNL field (e.g. from an upstream encoding glitch or an escape-parsing edge case) is silently coerced into a plausible-looking but wrong integer (organ id, term id, etc.) that then links records to the wrong entity in the graph, with no signal that anything was off.
- **Fix sketch**: Validate the full trimmed string matches `/^-?\d+$/` before parsing (or compare `String(n) === v.trim()` after parsing) and return `null` on any leftover characters, mirroring the strict-or-null contract used elsewhere in this file.

## 4. `czDateHourToIso` / `czDateTimeToIso` skip the range validation `czDateToIso` enforces
- **Lens**: Bug
- **Severity**: Medium
- **Category**: input-validation / silent-data-corruption
- **File**: lib/ingest/unl.ts:111-127
- **Scenario**: A source value like `"2024-13-40 27"` (bad month/day/hour) or a time of `"93:71"` passed to `czDateTimeToIso` matches the permissive regexes (`(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}))?` and `(\d{1,2}):(\d{2})`) and is emitted as a syntactically-ISO but semantically invalid timestamp, e.g. `"2024-13-40T27:00:00.000Z"`.
- **Root cause**: `czDateToIso` explicitly validates `month`/`day` ranges (lines 101-102) before accepting the value, but `czDateHourToIso` and the time-half of `czDateTimeToIso` only check the regex shape, not that hour ∈ [0,23] or minute ∈ [0,59] — an inconsistency within the same module for the same class of publisher data.
- **Impact**: Invalid timestamps are written into membership-window / vote-time columns; consumers that pass these strings to `new Date(...)` get `Invalid Date` (or, in engines that clamp, a silently rolled-over date), producing wrong sitting/membership timelines for a civic-accountability record with no ingest-time signal.
- **Fix sketch**: Add the same bounds checks used in `czDateToIso` (hour 0-23, minute 0-59) and return `null` on violation, matching the "missing beats wrong" policy already documented for this module.

## 5. windows-1250 decode silently swallows unmappable bytes instead of flagging corrupt input
- **Lens**: Bug
- **Severity**: Low
- **Category**: encoding / silent-failure
- **File**: lib/ingest/unl.ts:72-74
- **Scenario**: `decodeUnl` does `new TextDecoder("windows-1250").decode(bytes)` with default options. CP1250 leaves several byte values (e.g. 0x81, 0x83, 0x88, 0x8A, 0x8C-0x8F, 0x98, 0x9A, 0x9C-0x9F) undefined; if a corrupted download, wrong source encoding, or an off-by-one in the zip-extraction path (see finding #2) feeds such bytes in, `TextDecoder` (non-fatal by default) replaces each with U+FFFD and returns normally — no exception, no warning.
- **Root cause**: The decoder is constructed without `{ fatal: true }`, so encoding corruption is indistinguishable from a normal, cleanly-decoded file at the API boundary; every caller downstream (UNL row parsing, ASCII folding) just sees a `�` character mixed into otherwise valid Czech text.
- **Impact**: A corrupted or mis-sourced dump produces mangled names/titles (`�ov�kov�`-style garbage) that are folded, indexed, and persisted as if they were legitimate data — exactly the "silent data corruption" this module's comments elsewhere go out of their way to avoid.
- **Fix sketch**: Construct with `new TextDecoder("windows-1250", { fatal: true })` and let the ingest job fail loudly on truly malformed bytes, or at minimum scan the decoded string for U+FFFD after decode and surface a warning/error with the byte offset for triage.
