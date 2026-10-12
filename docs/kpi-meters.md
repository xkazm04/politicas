# KPI meters — the numbers this repo can actually back

```bash
npm run kpi:citations   # citation coverage on the reader-facing render path
npm run kpi:verify      # the verify loop, stage by stage (runs every check stage)
```

Neither is in `npm run check` and neither should be: a meter reports, a gate
refuses. `kpi:verify` deliberately runs the same stages the gate runs, so it can
stand in for `npm run check` in an unattended run and still report a rate.

## Why meters exist beside the gates

Both gates in this repo report **failures only**, which is the right shape for a
gate and the wrong shape for a number you want to watch:

- `custom/require-source-citation` can report "0 uncited figures" and never "0
  out of how many". A violation count reaches zero both when every figure is
  cited and when nobody renders a figure at all — opposite facts about the same
  brand rule, indistinguishable in the gate's output.
- `npm run check` is an `&&` chain: one bit, reporting the FIRST failure. A run
  that dies in typecheck says nothing about the tests, and a green run says
  nothing about which stage is becoming the bottleneck as the graph grows.

So the meters supply the denominators, and they do it by reusing the gates'
own definitions rather than writing a second scanner beside them.

## `kpi:citations` — citation coverage

Runs `custom/require-source-citation` in **census mode** (`{ census: true }`,
documented in `packages/eslint-plugin-civic-transparency/docs/rules/require-source-citation.md`),
which reports every rendered figure the rule's triggers see, tagged with the
state that decided it:

| state      | meaning                                                      |
| ---------- | ------------------------------------------------------------ |
| `cited`    | a provenance element lives in the same file                   |
| `declared` | a `// citation-ok:` annotation — the citation is one file up   |
| `uncited`  | neither; exactly the gate's error set                          |

Coverage counts `cited + declared`, and reports `declared` separately on
purpose: that part of the ratio rests on a human sentence rather than a visible
element, and a coverage number that hid it would be the same kind of unaudited
claim the brand rule exists to prevent.

The triggers and satisfiers are the *same code paths* in both modes, so the
meter and CI cannot drift apart about what a rendered figure is.

**Known limitation — the denominator is a lower bound.** The triggers only see
formatter calls in JSX child position (precision over recall, by design), so a
figure arriving from a loader as a pre-formatted string is invisible to both the
gate and the meter. On 2026-09-14 the census saw 87 files while 122 files
contain a `<SourceNote>`; the gap is files whose numbers the trigger set does not
classify. Widening it widens the gate too, and that is a deliberate decision, not
a bug fix. The classification is in the audit below.

### Denominator audit — 2026-10-12

Which files render a citation element but have no figure the triggers classify?
`kpi:citations` now answers it (`unclassifiedCitedFiles` in `--json`, and the
`BLIND SIDE` line): **46 files**, plus 15 route files whose only citation element is
`<DataUnavailable>` (an honest empty state, nothing to cite). The 2026-09-14 estimate
was "~35"; the tree grew, and the old count was a `grep -l SourceNote`, which also
matches comments and strings (it counted `features/money/console.a11y.test.ts`, which
only quotes the tag in an assertion).

Each of the 46 was classified by experiment, not by reading alone: the rule was
copied to a scratch file and run in census mode under widened triggers over
`app/** + features/** + components/**` (labs excluded). The real rule was not changed.

| Variant | Triggers | Figures | Files | Uncited |
| --- | --- | --- | --- | --- |
| base (the gate today) | `X.int/dec/czk` in JSX child position, file imports the chokepoint | 646 | 87 | 0 |
| v1 | base, without the chokepoint-import requirement | 727 | 102 | **0** |
| v2 | v1, plus figures in rendered JSX attributes (not `aria-*`, `title`, `className`, ...) | 786 | 104 | 4 (1 file) |
| v3 | any numeric-formatter call anywhere in the file | 961 | 131 | 70 (27 files) |

| Class | Files | Why invisible | Decision |
| --- | --- | --- | --- |
| **A. Formatter bundle injected** | 15 | The file gets `f` from a feature-local `volbyIntl()` / `profileIntl()` / `landingIntl()` (they wrap `formattersFor` from `lib/format`) or as a prop. The rule trusts `X.int/dec/czk` only when the SAME file imports the chokepoint, so an ordinary `<td>{f.int(r.yes)}</td>` (`features/volby/components/ContestedMatrix.tsx:84`) is not seen. Volby 8 files, profile 6, `landing/components/DenikTeaser.tsx` 1. | **Widen (recommended, not applied here).** v1 adds 81 figures in exactly these 15 files, with **0 new uncited** and no false positive anywhere in the tree, so the gate stays at zero and only the denominator grows (646 to 727 figures, 87 to 102 files). It changes the gate, so it lands as its own change: rule, tests, baseline re-measure here, rule doc. |
| **B. Figure in an attribute** | 1 | `features/landing/components/ScoreBreakdown.tsx:73` formats inside a recharts `formatter={...}` callback. Attribute position is excluded on purpose (`aria-label={f.int(n)}` is not a rendered claim). | **Do not widen.** It needs a per-prop allowlist (`value=`, `formatter=`). The blanket version (v2) adds 59 figures but 4 are uncited, all in the sample-data `features/money/components/MockStatTiles.tsx`. |
| **C. Figure computed away from the JSX** | 3 | `features/civicscore/MetodikaVolbySection.tsx:51` (a `pct` helper that returns a template literal), `features/overeni/OvereniPage.tsx:166` (`num = (v, kind) => formatByKind(...)`), `features/votetrack/kompas/KompasPage.tsx:45,60` (values bound to variables, passed on as ICU arguments). The call is not in child position. | **Do not widen.** Only v3 sees them, and v3 is not a render surface: its 70 uncited sit in loaders, notes, OG routes and tests. Seeing these properly is data-flow analysis, not a trigger. A named blind spot. |
| **D1. Dates only** | 3 | `RadarLedger`, `ReceiptPage`, `OutcomeTimeline` call `f.date` and nothing numeric. Dates are not figures to the rule (`dec/int/czk` only), and the dated half of this meter already measures citation dates. | **Not a figure class.** |
| **D2. Pre-formatted or raw figure** | 5 | `money/components/StatTiles.tsx:48` renders `{s.value}`, a string the loader already formatted; `shared/components/StatTile.tsx:55` renders its `{value}` prop; `landing/components/Methodology.tsx` renders a constant `{c.weight}`; `landing/components/HeroStory.tsx:88` and `votetrack/VoteTrackPage.tsx:70` pass a RAW number (`count`, `ROLL_CALLS.length`) as an ICU argument, so next-intl formats it and `lib/format` never sees it. | **A real blind spot a trigger cannot close.** The raw-number-into-`t()` shape is regex-shaped and belongs in `scripts/census/rules.json` as its own inventory (a candidate, not yet measured). Pre-formatted props would need a typed figure carrier; out of scope. |
| **D3. No numeric figure in the file** | 16 | Legal pages (`PrivacyContent`, `TermsContent`, `app/svedectvi`), `sidebarParts`, `TrailMethod`, `StageOverlays`, `MockGraphFeedPanel` (renders through `FeedPanelShell`, which the census does see), `VaultHeadsPanel`, `KompasNeverComputed`, `LowScoreReasonBadge`, `SubjectCard`, `KrajPage`, `SnemovnaPage`, `KauzyPage`, `BillDossierPage`, `LandingPage`. No `dec/int/czk` call in the file; the citation is prose or structure. Established by absence of any numeric formatter, not by reading each file line by line. | **Not figures** as far as the triggers can tell; re-read the list from `--json`. |
| **E. Satisfier definitions** | 3 | `shared/components/DataUnavailable.tsx`, `LiveDataNotice.tsx` and `SourceNote.tsx` ARE the citation elements. | **Not figures.** |

So the honest reading of "100 % of files" is: 100 % of the 87 files in which the
triggers see a figure, with 15 more that the rule can pick up cheaply (A), 4 that are
bounded blind spots (B, C), 5 of the pre-formatted/raw shape (D2), and the rest
structurally not figures. Reproduce with `npm run kpi:citations -- --json`.

### Baseline — 2026-09-14

```
scope        app/** + features/** + components/**, minus features/labs/**
files linted 681
figures      646 total — 624 cited, 22 declared, 0 uncited
files        87 render a figure — 77 cited, 10 declared, 0 uncited
COVERAGE     100 % of figures, 100 % of files
             (96,59 % carry a provenance ELEMENT; the rest are declared)
```

Cross-checked against the gate: `npx eslint --format json` over all 1 245 files
reports 0 errors and 2 warnings, neither of them this rule.

### The dated half — measured since 2026-10-11

The rule satisfies a file on the PRESENCE of a provenance element, and
`SourceNote` takes free-form children, so a citation with no retrieval date
passes the gate. `kpi:citations` therefore also classifies every satisfier
element (`SourceNote`, `SourceRef`, `DataUnavailable`, `LiveDataNotice`,
`CitableNumber`, `ProvenanceCapsule`, and `<PosterFrame citation>`) by its
OWN subtree:

- **dated** — a `provenance` / `receipt` / `citation` prop (the receipt carries
  the retrieval date), or a date formatter call (`f.date`, `czechDate`,
  `formatDate`, ...) or an ISO / Czech date literal inside the element;
- **undated** — none of those.

Baseline 2026-10-11 (`--json` adds `dated.byElement` and `dated.undatedFiles`):

```
DATED SHARE  5,07 % of 473 citation elements carry a date —
             3 by receipt prop, 21 by a date in the element, 449 undated
```

Limits, stated so the number is not over-read: the pass is syntactic. A date
computed elsewhere and passed in as a variable (`{lastDecidedAt}`) reads as
undated, so this is a lower bound on how many citations are really dated. It
is a measurement, not a gate, and **no target is set** — the number exists first;
a target follows the number, not the other way round.

## `kpi:verify` — the verify loop, stage by stage

Runs every stage of `npm run check` independently (no `&&`), recording exit code
and wall clock for each, and reports the share that exited 0. The stage list is
**derived from `package.json`'s `check` script at runtime**, not copied, so a
stage added to the gate enters the denominator on the next run instead of quietly
falling out of it. `test` is expanded into its two lanes (`test:unit`,
`test:pglite`) because they fail for different reasons and cost different time.

`build` is CI-only, not part of `check`, so it is opt-in behind `--with-build`
rather than silently included — otherwise the meter and the local gate would
disagree about what "the verify loop" is.

### Baseline — 2026-09-14

```
green  typecheck        41,6 s
green  lint             47,6 s
RED    test:unit        25,3 s   ← lib/testing/archivedScripts.test.ts timed out
green  test:pglite      61,2 s
green  test:rules        2,6 s
green  census:test       1,4 s
green  library:check     1,2 s
green  docs:sync:test   13,6 s
green  docs:sync         1,0 s
PASS RATE   88,89 % (8/9 stages), 195,5 s wall clock
```

The red stage was a flake the one-bit gate could not have characterised: the
whole-tree test `archivedScripts.test.ts > is referenced by nothing live` reads
every live source file in the repo while riding the unit lane's deliberate 5 s
budget, measured at 17,7 s and failing 1 run in 3. Fixed in the same change by
giving it the explicit headroom its sibling whole-tree test
(`server-boundary.test.ts`, 180 s) already carries — not by raising the lane's
budget, which exists to make a genuinely hung unit test fail in five seconds.

Two thirds of the wall clock sits in `typecheck`, `lint` and `test:pglite`; those
are the three to watch as the graph grows.

## Recording a reading

A reading belongs in the project's KPI store, not in a commit message. Each
meter's stdout IS the evidence string — paste the block, not a summary of it.
