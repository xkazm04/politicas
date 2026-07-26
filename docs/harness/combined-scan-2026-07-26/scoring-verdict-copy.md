# Scoring & Verdict Copy — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. `subsidiesByCompany` folds missing subsidy amounts into the total as if they were 0 CZK
- **Lens**: Bug
- **Severity**: High
- **Category**: silent-data-loss
- **File**: lib/analysis/money-feed.ts:350-359
- **Scenario**: Hlídač's `/dotace/hledat` returns a subsidy result whose amount fields (`subsidyAmount`/`payedAmount`) are both null (a known real case in CEDR data — amount undisclosed or not yet settled). `parseSubsidies` correctly keeps `amount: null` (line 343-344, "surfaced, never zero-faked" is the file's own stated discipline for `Contract.amount`). But `subsidiesByCompany` (line 350-359) then does `cur.total += s.amount ?? 0;` while still incrementing `cur.count`, so the company's `subsidies_total_czk` silently becomes a partial sum presented as a complete one.
- **Root cause**: The `?? 0` coalescing conflates "no subsidy" with "subsidy of unknown size" — the exact anti-pattern the file's own module docstring (lines 6-19) warns against for contracts/IČOs ("never invent... surfaced, never zero-faked"), but the discipline was not carried into this aggregate.
- **Impact**: `enrichMoneyCompanies` (line 411+) writes `subsidies_total_czk`/`subsidies_count` onto the company node verbatim; any UI or verdict narration built on it (e.g. "company X received N subsidies totalling Y CZK") understates real public money received whenever any individual subsidy amount is undisclosed, without any signal that the total is a floor rather than an exact figure.
- **Fix sketch**: Track an `incompleteCount` (or `hasUndisclosedAmount: boolean`) alongside `total`/`count` in the returned map so callers/UI can render "Y CZK (N of M subsidies with disclosed amount)" instead of a bare total that looks exact.

## 2. `daysBetween` silently clamps a negative (backwards) timestamp gap to 0, reporting maximal freshness for corrupt data
- **Lens**: Bug
- **Severity**: Medium
- **Category**: silent-failure
- **File**: lib/analysis/quality.ts:334-341
- **Scenario**: A slice's newest row timestamp is somehow earlier than the ingest-run's `startedAt` reference it's compared against (e.g. a backfilled row, a clock-skewed writer, or a bad join picking the wrong run), so `later < earlier`. `daysBetween` computes `(a - b) / 86_400_000` as negative, then `Math.max(0, Math.round(...))` clamps it to `0`.
- **Root cause**: The clamp was presumably added to avoid a stray `-1` rounding artifact from tie-breaking, but it also swallows a genuinely impossible input (row newer than the run that's supposed to have produced it) without distinguishing "0 days old" (perfectly fresh) from "negative — the inputs are wrong."
- **Impact**: `scoreSlice` feeds this straight into `syncAgeScore`/`lagScore`, both of which score `<= 1` day as a perfect `5`. A data-integrity bug (backwards timestamps) is thus reported as the BEST possible freshness score instead of surfacing as an anomaly — the opposite of the intended signal, and exactly the "logging lies" failure mode this scan targets.
- **Fix sketch**: Return `null` (or a sentinel) when `a < b` instead of clamping to 0, and have `syncAgeScore`/`lagScore` treat that as unscoreable (score 1, same as `null` today) rather than silently treating corrupt data as pristine.

## 3. TrendPanel's pending-components note is hardcoded to "participation and attendance" but `pendingComponents` is computed generically
- **Lens**: Bug
- **Severity**: Medium
- **Category**: contradictory-copy
- **File**: lib/analysis/contribution-trend.ts:88-100 (data) + features/civicscore/components/TrendPanel.tsx:99-105 (copy)
- **Scenario**: `computeTrend` iterates all six `COMPONENT_ORDER` keys and pushes ANY key whose `priorComponents[key]` is missing/non-numeric into `pendingComponents` (line 88-100) — not just `participation`/`attendance`. If a future or malformed `contribution_psp9` prop is missing, say, `committee` or `leadership` instead (e.g. an older PSP9 backfill pass that only wrote participation+attendance+legislative+speech), `pendingComponents` would correctly contain `["committee", "leadership"]`.
- **Root cause**: `TrendPanel.tsx` renders that non-empty condition with a single hardcoded sentence (lines 100-104): "Účast při hlasování a docházka za období … se zobrazí po doingestování jmenných hlasování … teď je srovnatelná jen výborová, legislativní a řečnická složka." This text assumes the pending set is ALWAYS exactly `{participation, attendance}` and the available set is ALWAYS exactly `{committee, legislative, speech}` — an assumption baked into prose, not derived from `trend.pendingComponents`.
- **Impact**: For any prior-term payload where the missing components differ from the current PSP9-ingest-order assumption (which the code explicitly anticipates handling generically, per the type's own docstring at line 52 "Components that could not be compared..."), the panel would tell readers committee/legislative/speech ARE comparable while actually blaming the wrong two components — a nonsensical, actively misleading civic-transparency statement rendered with confidence ("teď je srovnatelná jen...").
- **Fix sketch**: Build the sentence from `trend.pendingComponents` (map each `ComponentKey` to its Czech label) instead of a fixed string, e.g. "Složky {pendingLabels.join(", ")} za období … se zobrazí po doplnění dat — teď je srovnatelná jen {availableLabels.join(", ")}."

## 4. Batch/sample self-reference jargon filter only recognizes Czech numerals 3–5, letting "1 vzorku"/"2 vzorcích" leak to readers
- **Lens**: UI
- **Severity**: Medium
- **Category**: copy-leak / i18n-completeness
- **File**: lib/analysis/public-copy.ts:38-41
- **Scenario**: The rule `/\b(batch|dávka)\s*\d|v tomto vzorku|ve vzorku (pěti|čtyř|tří)|tomto vzorku/i` is meant to catch an analyst writing a self-referential pipeline aside like "ve vzorku pěti MPs..." into public dossier prose. It only lists the Czech declined forms for 5/4/3 ("pěti"/"čtyř"/"tří"). The much more likely early-batch phrasing for a SMALL sample — "v jednom vzorku", "ve vzorku dvou", "u jednoho vzorku" — is not covered, and the numeral-free `\b(batch|dávka)\s*\d` alternative only matches Latin-script "batch"/"dávka" immediately followed by a digit, not a spelled-out Czech number at all.
- **Root cause**: The regex was evidently built by enumerating the specific numerals seen in the batch history mentioned in the file's own comment (5→18→84→140→199 field-instances), rather than matching the general pattern (any Czech cardinal/ordinal + "vzorku"/"vzorek"/"dávka"), so it is complete only by coincidence for the sizes on hand at write time.
- **Impact**: Per the module's own stated purpose, this same array is now the SOLE definition imported by both the persist-time gate (`gate.ts`) and the render-time withholder (`getProfileData.ts`) — a gap here is a gap at BOTH enforcement points simultaneously (the exact class of bug the file's own history section (lines 42-51) documents as having already happened once with the "endpoint/JSON/pipeline" rule). A future small-sample batch note ("v tomto vzorku dvou poslanců...") ships straight to `/poslanec` undetected.
- **Fix sketch**: Replace the enumerated numeral alternation with a general pattern, e.g. `/\b(v|ve|u)\s+(tomto\s+)?vzork(u|ách|ěch)\b/i` plus `/\bvzorek\s+\d+/i`, so coverage doesn't depend on which specific numerals happened to occur in past batches.

## 5. `mandateNoteCopy` renders a broken gender-neutral suffix — "náhradník/nice" is not the feminine of "náhradník"
- **Lens**: UI
- **Severity**: Low
- **Category**: czech-grammar
- **File**: lib/analysis/tenure-copy.ts:73
- **Scenario**: For a `replacement`-tenure MP, the copy always renders: `"Mandát vznikl {start} (nastoupil/a jako náhradník/nice)."` The feminine form of "náhradník" is "náhradnice" (drop the "-ík" ending, add "-ice"), so the intended shorthand should read "náhradník/-nice" attached to the stem "náhrad-" or, following the file's own pattern elsewhere in the codebase (e.g. "předseda/kyně", "poslanec/poslankyně"), spelled out in full. As written, concatenating the slash-alternative literally onto "náhradník" yields "náhradníknice" (not a word) when read as a suffix-append, or simply the nonsensical standalone word "nice" (which also happens to collide with the unrelated English word) when read as a full alternative — neither is the correct Czech feminine form "náhradnice".
- **Root cause**: The gender-neutral slash convention used consistently elsewhere in this codebase (`předseda/kyně`, `poslanec/poslankyně`, `mistopředseda/kyně` in low-score-reason.ts) replaces a suffix on a stem that ends the same way in both genders; "náhradník" doesn't fit that pattern (masculine "-ík" vs feminine "-ice" diverge earlier in the word), and the author applied the same slash-suffix template without checking the actual feminine inflection.
- **Impact**: Every "seated as a replacement" mandate note — a copy path the codebase's own comments call out as needing to read as an "honest, non-judgmental" correction to a low score — ships with a visibly broken/nonsensical word to native Czech readers, undermining the credibility of exactly the honesty-focused copy this module exists to produce.
- **Fix sketch**: Use the correct full feminine form: `"nastoupil(a) jako náhradník/náhradnice"` (or restructure to avoid the slash entirely: `"nastoupila jako náhradnice"` / `"nastoupil jako náhradník"` if gender is ever known, otherwise the safe combined form above).
