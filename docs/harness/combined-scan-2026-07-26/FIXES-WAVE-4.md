# Combined Scan Fix Wave 4 — Ingestion Normalization Hardening

> 2 commits, 5 findings closed.
> Baseline preserved: 0 TS errors → 0 TS errors, 352/352 tests → 352/352 tests.

## Commits

| # | Commit | Findings closed | Severity | Files |
|---|---|---|---|---|
| 1 | `e4d61c4` fix(ingest): cap zip inflate output and reject truncated archives | ingestion-normalization.md #1, #2 | Critical, High | `lib/ingest/zip.ts` |
| 2 | `4a8ebc7` fix(ingest): validate UNL integers, date/time ranges, and cp1250 decoding | ingestion-normalization.md #3, #4, #5 | Medium×2, Low | `lib/ingest/unl.ts` |

## What was fixed (grouped by sub-pattern)

1. **Unbounded resource consumption at the decompression boundary (zip.ts)** — `inflateRawSync` had no output-size cap, so a crafted archive with a small compressed size but a multi-gigabyte deflate stream (a zip bomb) could exhaust process memory across the entire shared ingest path. Added a 512MB `maxOutputLength` cap.

2. **Silent clamping instead of loud rejection on malformed offsets (zip.ts)** — a truncated/tampered archive's declared `compressedSize`/`localHeaderOffset` could point past the buffer end; `subarray` clamped instead of throwing, contradicting the module's own "rejected loudly rather than silently mis-read" guarantee. Added an explicit bounds check that throws a named error.

3. **Prefix-parse accepting trailing garbage (unl.ts colInt)** — `Number.parseInt` silently ignores non-numeric trailing characters, so a malformed field like `"123abc"` parsed to `123` instead of failing. Now requires the full trimmed value to match `^-?\d+$`.

4. **Regex-shape validation without range validation (unl.ts date/time helpers)** — `czDateToIso` already validated month/day ranges, but the hour-precision and combined date+time variants only checked the regex shape, letting `"2024-13-40 27"` emit a syntactically-ISO but semantically invalid timestamp. Added the same range checks (month 1-12, day 1-31, hour 0-23, minute 0-59) to all three date/time helpers.

5. **Non-fatal decoding masking corruption (unl.ts decodeUnl)** — the windows-1250 `TextDecoder` was constructed without `{ fatal: true }`, so an unmappable byte (corrupted download, wrong source encoding) silently became U+FFFD instead of raising. Now decodes with `fatal: true`.

## Verification table (before/after counters)

| Check | Before wave | After wave |
|---|---|---|
| TypeScript errors | 0 | 0 |
| Tests passing | 352/352 (36 files) | 352/352 (36 files) |
| Lint (pre-commit hook) | — | clean on every commit |

## Cumulative status (across all waves so far)

- **Wave 1**: 5 findings closed — Theme A, Review-Gate Race Conditions & Data Trust.
- **Wave 2**: 9 findings closed — Theme B, Silent Numeric Failures.
- **Wave 3**: 4 findings closed — Theme C, Money/Graph Data-Integrity Mismatches.
- **Wave 4 (this wave)**: 5 findings closed (1 Critical, 1 High, 2 Medium, 1 Low) — Theme D (part 1), Ingestion Normalization Hardening.
- **Running total**: 23/125 findings closed.
- Remaining: 102 findings across themes D (remainder — PGlite backend robustness), E–J.

## Patterns established (additions to the catalogue, items 10-11)

10. **A module whose header comment promises "rejected loudly, never silently mis-read" needs that promise re-verified against every offset/length it trusts from untrusted input** — the zip reader already threw named errors for ZIP64/encryption/unsupported methods, but the actual byte-slicing step (`subarray`) silently clamped instead of throwing, because JS array/buffer slicing is clamp-by-default and doesn't inherit a module's stated philosophy automatically.
11. **"Missing beats wrong" needs range validation, not just shape validation** — a regex match confirms a value LOOKS like a date/int, not that it IS a valid one; three of five findings in this file were variations of "the shape check passed but the value was still nonsense," which is a durable review lens for any ingest-boundary parser (check the sibling functions of any correctly-validated one — they're often missing the same check).

## What remains

Themes D (remainder — PGlite Store poisoned-state, chunked-upsert transaction-safety, timezone coercion), E (lint-rule false negatives), F–J (UI polish, graph/canvas robustness, shared primitives, legislative-data correctness, test coverage) are all still open — see `INDEX.md` for the full per-theme breakdown.
