# Landing Page — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. DataSources renders translation strings by positional index, decoupled from the SOURCES data array
- **Lens**: Bug
- **Severity**: High
- **Category**: silent-data-desync / latent time bomb
- **File**: features/landing/components/DataSources.tsx:19-27 (paired with lib/civic/data.ts:211-219 and messages/cs.json + messages/en.json `landing.content.sources`)
- **Scenario**: `SOURCES.slice(0, 8).map((s, i) => …)` iterates the `SOURCES` array from `lib/civic/data.ts` (currently 7 entries) purely to get a loop count and a React `key`; every visible piece of text is instead pulled from the translation catalog via `tc(\`sources.${i}.name\`)`, `tc(\`sources.${i}.cadence\`)`, `tc(\`sources.${i}.what\`)`. The two collections — the TS data array and the JSON translation array — are maintained in entirely separate files with no shared type or build-time check. If a future edit adds/removes/reorders one entry in `SOURCES` (e.g. drops "Registr dotací") without mirroring the same change in `messages/cs.json` AND `messages/en.json` `sources` object, the card content silently shifts out of alignment (card 4 shows source 5's description) or `next-intl` throws/renders a missing-key fallback for the added index, since nothing type-checks the two lists against each other.
- **Root cause**: Using an array purely for its length/iteration while sourcing all actual content from a same-shaped-but-independently-edited translation object. The comment on the file even calls out "ověřené veřejné zdroje" as source-of-truth data, but the component never reads `s.what`/`s.cadence` from it — a maintainer editing "the data" (SOURCES) reasonably assumes the UI updates, but the UI is actually driven by JSON they didn't touch.
- **Impact**: Silent content corruption on a civic-transparency site whose entire value proposition is data trustworthiness — wrong cadence/description shown against a source name, or a missing translation key breaking the section, with no error surfaced anywhere in dev or prod.
- **Fix sketch**: Either move the source copy (`what`, `cadence`) into `SOURCES` itself (single source of truth, i18n only for chrome labels), or key the translation lookup by a stable field (`s.name` slugified) instead of the loop index, and add a startup/test-time assertion that `SOURCES.length === Object.keys(sourcesTranslations).length` for every locale.

## 2. ScoreBreakdown uses the localized pillar label as the chart series key, so identical translated labels silently merge/overwrite data
- **Lens**: Bug
- **Severity**: High
- **Category**: data-key collision / i18n landmine
- **File**: features/landing/components/ScoreBreakdown.tsx:29-45, 75-91
- **Scenario**: `pillarLabels` maps each `Pillar.key` to its *translated display label* (`tc(\`pillars.${p.key}.label\`)`), and `stackedData` builds each MP's row via `Object.fromEntries(pillarLabels.map((p) => [p.label, ...]))` — i.e. the object key for each stacked-bar segment is the human-readable label string, not the stable `p.key`. The `<Bar dataKey={p.label} .../>` further reads by that same string. If a translator (or a future locale) ever gives two of the four pillars the same label text — e.g. both "integrity" and "independence" rendered as "Nezávislost" by a copy mistake, or any locale that legitimately shortens two distinct concepts to one word — `Object.fromEntries` silently overwrites the earlier key with the later one, so one pillar's bar segment vanishes from every row (its value is never separately stacked) and the remaining bar with that dataKey double-serves two `<Bar>` elements.
- **Root cause**: Coupling a rendering/display concern (translated label text) to a data-identity concern (object key uniqueness). Nothing enforces that translated strings are unique across the 4 pillar keys, and nothing in the type system flags the collision — it degrades silently rather than erroring.
- **Impact**: A pillar's contribution silently disappears from the score-breakdown visualization for any locale/translation edit that produces a label collision; the composite total still looks plausible (bars still sum reasonably) so the bug would likely ship unnoticed until someone cross-checks the numbers.
- **Fix sketch**: Key the stacked data and `<Bar dataKey>` by `p.key` (the stable enum) and pass the translated label only via `name={p.label}` / a legend lookup for tooltip display, decoupling identity from presentation text.

## 3. Primary navigation is completely absent on mobile/tablet viewports with no alternative
- **Lens**: UI
- **Severity**: High
- **Category**: responsive-design gap / missing polish
- **File**: features/landing/components/SiteHeader.tsx:29-43
- **Scenario**: The entire `<nav>` containing all five section anchors (`index`, `ranking`, `system`, `data`, `method`) plus the "enter dashboard" `Link` is wrapped in `hidden ... lg:flex`. Below the `lg` breakpoint (roughly <1024px — i.e. essentially all phones and most tablets/small laptops) this whole block disappears, and no hamburger/menu button is rendered to replace it. A mobile visitor sees only the logo and the language switcher in the header; there is no way to jump to the ranking, system-modules, data-sources, or methodology sections, and no way to reach `/dashboard` from the header at all.
- **Root cause**: The nav was designed for the wide "poster" layout (five numbered anchor links styled as vertical-rule-separated tabs) with no mobile fallback ever built — a straightforward `hidden lg:flex` cutoff with no companion `lg:hidden` menu trigger.
- **Impact**: On mobile — the majority of casual visitors to a public civic-transparency landing page — in-page navigation and the primary conversion path ("enter" the dashboard) via the header are simply unavailable; users must manually scroll the entire page or rely on the two hero CTAs, degrading discoverability and conversion on the platform's front door.
- **Fix sketch**: Add a mobile menu trigger (icon button) shown only `lg:hidden` that opens a simple full-width dropdown/sheet reusing the same `NAV` array and the `/dashboard` link, or at minimum keep the "enter" CTA visible outside the `hidden` nav block at all breakpoints.

## 4. Dragging all pillar weight sliders to zero collapses the composite score to a misleading 0/100 instead of an undefined state
- **Lens**: Bug
- **Severity**: Medium
- **Category**: edge-case / silent-failure (success theater)
- **File**: features/landing/LandingPage.tsx:39-43
- **Scenario**: Each of the four weight sliders in `LiveSpecimen` allows `min={0} max={100}`, independently, with no minimum-sum constraint. If a user drags all four sliders down to 0, `total = PILLARS.reduce((s, p) => s + weights[p.key], 0) || 1` evaluates to `0 || 1 → 1`, and `raw = PILLARS.reduce((s, p) => s + mp.pillars[p.key] * (weights[p.key] / total), 0)` becomes `Σ mp.pillars[key] * (0/1) = 0`. The UI then confidently renders a giant "0.0" score styled identically to any other custom score (just switches to `text-cobalt` and the "scoreCustom" caption), with no indication that the weighting is degenerate/meaningless rather than a genuine "worst possible score."
- **Root cause**: The `|| 1` fallback was added purely to avoid a NaN/divide-by-zero crash, but it silently substitutes a fabricated denominator rather than surfacing that the input configuration is invalid — classic silent-failure/success-theater pattern: the code "succeeds" by producing a number, but the number carries no real meaning.
- **Impact**: A visitor experimenting with the live weighting tool can produce and screenshot/share a "0.0 composite score" for any MP that looks like a legitimate result of the methodology, undermining the credibility of the transparency tool the page exists to showcase.
- **Fix sketch**: Disable/clamp so at least one weight must stay > 0 (e.g. prevent the last non-zero slider from going to 0, or re-normalize remaining weights when one hits 0), or detect `total === 0` explicitly and show a distinct "invalid weighting" state instead of a numeric score.

## 5. Methodology's API-access CTA is a dead `href="#"` link that silently jumps the page to the top
- **Lens**: UI
- **Severity**: Medium
- **Category**: missing polish / broken affordance
- **File**: features/landing/components/Methodology.tsx:28-33
- **Scenario**: The secondary CTA button labelled `t("methodCtaApi")` (styled identically to a real navigational control, full border + hover-invert treatment matching the working "find your MP" CTA right next to it) uses `href="#"` with no `id="#"` target elsewhere on the page. Clicking it from anywhere on the methodology section scrolls the viewport abruptly to the very top of the page (back to the header), which is jarring and reads as a functional bug rather than a "coming soon" placeholder — there is no disabled styling, tooltip, or `aria-disabled` to signal it isn't wired up yet.
- **Root cause**: A placeholder link was styled as a fully interactive, same-weight sibling of a real CTA before the destination (presumably an API docs page) existed, and no defensive `aria-disabled`/`onClick preventDefault` guard was added in the meantime.
- **Impact**: Visitors interested enough to look for API access get an unexplained jump-to-top instead of feedback, reading as site breakage on the same section that markets the product's rigor ("no black box").
- **Fix sketch**: Either point it at a real `/api` docs route if one exists, or visually demote it to a clearly-disabled/"coming soon" state (reduced opacity, `aria-disabled="true"`, `onClick={(e) => e.preventDefault()}`) until the destination ships.
