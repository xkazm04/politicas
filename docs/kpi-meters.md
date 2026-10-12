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
a bug fix.

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

**What is NOT measured here:** the *dated* half of "every rendered number carries
a dated, sourced citation". The rule satisfies a file on the PRESENCE of a
provenance element, and `SourceNote` takes free-form children, so a citation with
no retrieval date passes. The construct that guarantees a date is the optional
`provenance` receipt prop — 11 call sites out of 441 `<SourceNote>` sites on
2026-09-14. Building that measurement is a filed backlog item; until it exists,
no target is set for it.

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
