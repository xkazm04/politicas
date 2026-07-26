# MP Profile Dossier — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. "Pracovní profil" dossier section is hardcoded Czech, breaking the English locale
- **Lens**: UI
- **Severity**: High
- **Category**: i18n-inconsistency
- **File**: features/profile/components/DossierSection.tsx:58, 64, 71, 87, 126, 136
- **Scenario**: Switch the app to the English locale and open `/en/poslanec/<id>` for any of the 165/207 MPs who carry effort_* dossier data. Every other section on the page ("Složky přispění"/"Nejbližší spojenci"/etc.) is translated via `useTranslations`, but the whole "Pracovní profil" section — heading, "Veřejná role", "Tematické zaměření", "Legislativní stopa", "Poznámky k datům", "Datová výhrada" — renders in Czech regardless of locale.
- **Root cause**: DossierSection never imports `useTranslations`; its labels are Czech string literals typed straight into JSX, unlike the parent `ProfilePage`, which routes every visible string through `t(...)`. The file's own header comment even flags this as a known gap ("Copy je český inline literál… navržené i18n klíče jsou v handoffu"), but the debt was never surfaced to the audience-facing page.
- **Impact**: For the majority of profiles (165/207), an English-locale reader hits an abrupt, unexplained language switch mid-page — the single largest content block on the dossier is unlocalized, undermining the app's international/civic-transparency positioning and making `[id]/page.tsx`'s locale-aware `generateMetadata` (which does translate the page title/description) misleading about what the body actually shows.
- **Fix sketch**: Add the missing keys to the shared `messages/*.json` catalogs (cs + en) and swap the literals for `useTranslations("profile.dossier")` calls, mirroring the pattern already used in `ProfilePage.tsx`; apply the same treatment to `LowScoreReasonBadge`/`TenureNote`/`TenureTrendGate` copy helpers which have the identical gap.

## 2. TenureTrendGate does not suppress the trend panel when tenure length is unknown
- **Lens**: Bug
- **Severity**: High
- **Category**: silent-degradation-gap
- **File**: features/profile/components/TenureTrendGate.tsx:36; lib/analysis/tenure-copy.ts:39-41
- **Scenario**: An MP has a real `trend` object (PSP9→PSP10 comparison exists) but `effort_tenure_days` is `null` — e.g. one of the MPs `getProfileData.ts`'s own comment says are "missing a chamber membership row" for tenure purposes. `TenureTrendGate` calls `isTrendTooEarly(null)`.
- **Root cause**: `isTrendTooEarly` is defined as `typeof tenureDays === "number" && … && tenureDays < TREND_MIN_TENURE_DAYS` — for any non-number input (including `null`) it returns `false`, i.e. "not too early." The gate's whole purpose is to prevent misleading rate comparisons on short/uncertain tenures, but it silently treats "we don't know the tenure length" as equivalent to "tenure is long enough," which is the opposite of the conservative behavior the surrounding code otherwise practices everywhere else (graceful-null-first).
- **Impact**: `TrendPanel` renders full rate/delta comparisons (participation, attendance deltas) for exactly the population this component exists to protect — MPs whose tenure can't be measured — reintroducing the "statistically nonsensical" noisy comparison the component's own doc comment describes as the reason it exists.
- **Fix sketch**: Change `isTrendTooEarly` (or the call site) to treat non-numeric/absent `tenureDays` as "too early" as well (fail closed): `typeof tenureDays !== "number" || tenureDays < TREND_MIN_TENURE_DAYS`, or add an explicit third "unknown" branch in `TenureTrendGate` with its own honest copy.

## 3. Unguarded `topComponent.label` access crashes the whole profile page if `components` is empty
- **Lens**: Bug
- **Severity**: Medium
- **Category**: unguarded-crash
- **File**: features/profile/ProfilePage.tsx:40-42, 91
- **Scenario**: `data.components` (from `buildLeaderboard()`) is expected to always carry the six fixed contribution components, but nothing in `ProfilePage` enforces that invariant at the render boundary — if `components` is ever empty (partial ingest, a future refactor of `LeaderboardData`, or a bad build), `[...components].sort(...)[0]` evaluates to `undefined`, and line 91's `topComponent.label` throws a `TypeError` with no fallback.
- **Root cause**: Every other data gap on this page degrades gracefully by design (dossier section hides itself with `hasAny`, badges/notes return `null` when their source prop is absent) — but the "headline" derivation is the one place that assumes a non-empty array without a defensive check, breaking the page's own stated pattern of "never crash, always degrade."
- **Impact**: A single missing/empty `components` array takes down the entire MP profile page (no partial render, no error boundary shown in scope) instead of degrading one line of copy, which is disproportionate given every sibling section on the page handles absent data safely.
- **Fix sketch**: Guard with `const topComponent = components.length > 0 ? [...components].sort(...)[0] : null;` and fall back to a neutral string (or omit the paragraph) when `topComponent` is null, consistent with the rest of the page's null-handling.

## 4. Ally rows can link to `/poslanec/NaN` when a co-vote edge id doesn't parse
- **Lens**: Bug
- **Severity**: Medium
- **Category**: unvalidated-input
- **File**: features/profile/getProfileData.ts:135-136; features/profile/ProfilePage.tsx:180-181
- **Scenario**: `otherPspId` is derived via `Number(otherId.split(":").pop())` with no validation that the edge's `src`/`dst` actually matches the `psp:person:<id>` shape. If a `co_votes_with` edge ever points at a malformed or non-person node id (data-quality slip in the knowledge-graph ingest, which the surrounding comments acknowledge is an ongoing concern for this dataset), `otherPspId` becomes `NaN`.
- **Root cause**: The value flows straight from a split/parse into the `CoVoter` object with no `Number.isFinite` check (unlike `num()`/`nullableNum()` helpers used everywhere else in this same file for numeric props), and `ProfilePage` renders it directly into `href={`/poslanec/${cv.pspId}`}` without validation.
- **Impact**: The rendered link becomes `/poslanec/NaN`; clicking it round-trips through `[id]/page.tsx`'s `Number.isFinite` guard into `notFound()` — a dead link presented as a legitimate ally with a name and agreement percentage, silently misleading the reader with no visual indication anything is wrong.
- **Fix sketch**: Validate `otherPspId` with `Number.isFinite` when building `coVoters` and drop/skip malformed entries (mirroring how `sponsoredBills` already treats `cislo === null` as "render without a link" rather than a broken one).

## 5. Repeated `!text-[10px]` `!important` overrides on `SourceNote` indicate a missing size variant
- **Lens**: UI
- **Severity**: Low
- **Category**: design-system-standardization
- **File**: features/profile/ProfilePage.tsx:87, 147, 197; features/profile/components/DossierSection.tsx:118; features/profile/components/LowScoreReasonBadge.tsx:54; features/profile/components/TenureNote.tsx:39
- **Scenario**: Every single caller of `SourceNote` in this context needs a smaller footnote size than the component's own default, and every one reaches for the same Tailwind "important" escape hatch: `className="mt-… !text-[10px]"`.
- **Root cause**: `SourceNote`'s built-in text size is apparently wrong for this context's dominant use case (compact attribution footnotes under stats/badges), so instead of exposing a `size`/`variant` prop, six separate call sites fight the component's own default with `!important`. This is a design-system smell: any future change to `SourceNote`'s base size or specificity will interact unpredictably with six scattered `!important` overrides instead of one variant definition.
- **Impact**: Low direct user-facing harm today (the sizes render correctly), but it's a standardization gap that will keep replicating as new sections are added to this and other profile-like pages, and it makes `SourceNote`'s actual rendered size non-obvious from its own definition.
- **Fix sketch**: Add a `size="compact"` (or similar) prop to `SourceNote` that applies `text-[10px]` internally, and replace all six `!text-[10px]` call-site overrides with the prop.
