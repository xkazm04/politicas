# i18n & Number Formatting — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. NaN and Infinity render verbatim in every numeric formatter
- **Lens**: Bug
- **Severity**: Critical
- **Category**: silent-failure / bad-data-passthrough
- **File**: lib/format.ts:14, 31, 34, 17
- **Scenario**: Any upstream computation that can yield `NaN` or `Infinity` (e.g. a ratio divided by zero, a missing value coerced to `undefined` and then arithmetic-ed, or `parseFloat` on empty scraped data — common on a civic-data site aggregating incomplete government records) is passed to `czech()`, `formatDecimal()`, `formatInt()`, or `formatCzk()`. `Number.prototype.toFixed` returns the literal string `"NaN"` or `"Infinity"` for these inputs, and `.replace(".", ",")` leaves `"NaN"` untouched. `toLocaleString` similarly renders `"NaN"` / `"∞"`.
- **Root cause**: None of the formatting primitives guard against non-finite input; they assume every number reaching them is a valid, computed figure. There is no `Number.isFinite` check or fallback placeholder anywhere in the formatting layer that "every rendered number in the app routes through."
- **Impact**: A transparency site showing budget scores, per-capita spend, or voting percentages can literally render the text "NaN Kč" or "NaN,0" to end users, which reads as a broken/untrustworthy site and undermines credibility precisely where trust in numbers matters most.
- **Fix sketch**: Add a shared guard at the top of `formatDecimal`/`formatInt`/`formatCzk` (and the underlying `czech`/`czechInt`) that checks `Number.isFinite(n)` and returns a locale-appropriate placeholder (e.g. `"—"` or `"N/A"`) instead of formatting; log/telemetry the occurrence so bad upstream data is caught.

## 2. `toLocaleString` used for numbers despite the file's own documented ICU/hydration-mismatch rationale for avoiding it
- **Lens**: Bug
- **Severity**: High
- **Category**: SSR/CSR hydration mismatch
- **File**: lib/format.ts:17, 34 (comment context at lines 19-22)
- **Scenario**: `czechInt`/`enInt` call `n.toLocaleString("cs-CZ" | "en-US")`. The file explicitly documents, two lines below, why `czechDate`/`enDate` deliberately avoid `Intl`/`toLocaleDateString`: *"Server a klient mohou mít různé verze ICU; toLocaleDateString by rozjelo hydrataci"* (server and client may have different ICU versions, which would break hydration). `toLocaleString` for numbers goes through the exact same ICU/`Intl.NumberFormat` machinery and is subject to the identical risk — e.g. Node's bundled ICU vs. a browser's ICU can format the Czech thousands separator as a plain space, a NBSP (U+00A0), or a narrow NBSP (U+202F), producing a text-node mismatch between server-rendered and client-rendered output.
- **Root cause**: The stated design principle ("avoid Intl for exactly this reason") was applied inconsistently — only to dates, not to the equally Intl-dependent integer/currency formatters, even though those are used just as pervasively (every score, vote count, and CZK amount in the app).
- **Impact**: Possible React hydration warnings/mismatches or visually-different thousands-separator glyphs between initial SSR paint and client rehydration, and inconsistent copy/paste or search behavior for numbers depending on the invisible separator character used.
- **Fix sketch**: Replace `toLocaleString` with the same deterministic, no-`Intl` grouping approach already used for dates (e.g. a manual digit-grouping function inserting a fixed `" "` or `" "` character), so server and client always agree byte-for-byte.

## 3. `formatDecimal` never groups thousands, unlike `formatInt` — inconsistent look for large decimal figures
- **Lens**: UI
- **Severity**: Medium
- **Category**: formatting-consistency
- **File**: lib/format.ts:14, 31, 50-51
- **Scenario**: `czech()`/`enDecimal()` are implemented purely as `n.toFixed(1)` (+ comma swap for cs), with no thousands grouping. Any decimal value ≥ 1000 (e.g. a large per-mandate score, an aggregated budget ratio shown to one decimal) renders as `"12345,6"`, while an integer of the same or smaller magnitude rendered via `formatInt` on the very same page renders as `"5 214"` (grouped). The module's own header comment promises the file is "the single place decimal separators, thousands groups… are decided," implying grouping should apply uniformly.
- **Root cause**: `formatDecimal`'s primitives were written only with small "score" values (documented example: `88.3`) in mind and never extended to add grouping for larger magnitudes, unlike the integer formatter.
- **Impact**: Two numbers of comparable magnitude shown side-by-side (a decimal score/ratio next to an integer count) can visually disagree on separator conventions, looking like a formatting bug to users and breaking the "every number goes through the same pipe" guarantee the file claims to provide.
- **Fix sketch**: Route `formatDecimal` through the same grouping logic as `formatInt` before/after applying the fixed decimal, e.g. group the integer part with the deterministic grouping helper (see finding 2) and append `",X"`/`".X"` for the fractional part.

## 4. `czechDate`/`enDate` assume a strict, untimestamped `yyyy-mm-dd` string with no validation
- **Lens**: Bug
- **Severity**: High
- **Category**: edge-case / input-validation
- **File**: lib/format.ts:23-26, 42-45
- **Scenario**: Both date primitives do `iso.split("-").map(Number)` and directly interpolate the results. If `iso` ever carries a time component (e.g. `"2026-07-14T10:00:00Z"`, a very plausible shape if any upstream API/DB timestamp column is passed through without truncation), the day segment becomes `"14T10:00:00Z"`, and `Number("14T10:00:00Z")` is `NaN`, giving output like `"NaN. 7. 2026"` (cs) or `"Jul NaN, 2026"` (en). An empty string or `undefined`-coerced-to-`""` produces `"NaN. NaN. NaN"`. There is no length/format assertion anywhere in the call chain (`formatDate` → `czechDate`/`enDate`).
- **Root cause**: The helper trusts every caller across the app to pre-truncate to exactly `YYYY-MM-DD`, but nothing enforces that contract at the type or runtime level, and the function is otherwise deliberately defensive-by-design (avoiding `Intl` for determinism) which suggests it should also be defensive against malformed input.
- **Impact**: A single upstream record with a full ISO-8601 timestamp instead of a bare date silently produces garbled "NaN. NaN. NaN"-style dates anywhere in the transparency UI (vote dates, term dates, contract dates), with no error surfaced to developers.
- **Fix sketch**: Validate the input shape (regex `^\d{4}-\d{2}-\d{2}` or split then `Number.isFinite` check on each part) and either truncate a valid `T`-suffixed ISO datetime to its date portion, or return a placeholder + dev-time warning for genuinely malformed input.

## 5. `formatInt`'s underlying `toLocaleString` calls do not constrain fraction digits, so non-integer input silently renders decimals
- **Lens**: UI
- **Severity**: Medium
- **Category**: formatting-consistency / silent-fallback
- **File**: lib/format.ts:17, 34, 54-55
- **Scenario**: `czechInt`/`enInt` call `n.toLocaleString(locale)` with no `maximumFractionDigits` option. `Number.prototype.toLocaleString`'s default allows up to 3 fractional digits for non-integer values. If any caller passes a non-integer to `formatInt`/`f.int(...)` (e.g. a count that turns out to be an average or a value that wasn't `Math.round`-ed upstream — easy to happen when the same underlying metric is sometimes used as a raw score and sometimes as a "count"), the "integer" formatter will happily emit something like `"5 214,567"` instead of erroring, rounding, or truncating.
- **Root cause**: The function name and doc comment (`/** Grouped integer: cs "5 214" · en "5,214". */`) promise integer semantics, but nothing in the implementation enforces or coerces that — it relies entirely on caller discipline.
- **Impact**: A stray non-integer value flowing into an "int" display slot silently produces an inconsistent, unintended decimal rendering instead of a clear rounded integer, which is easy to miss in review since it "looks like a number" and won't throw or warn.
- **Fix sketch**: Pass `{ maximumFractionDigits: 0 }` (or explicitly `Math.round`/`Math.trunc` the input before formatting) in `czechInt`/`enInt` so the function's integer contract is enforced rather than assumed.
