---
name: gates-report-failures-meters-need-denominators
description: Every gate in this repo reports failures only, so none of them can produce a ratio — the census mode and the stage-splitter that fix that, and the flake the one-bit gate hid.
metadata:
  type: project
---

**A gate's output cannot be a KPI.** Measured 2026-09-14 while instrumenting the
project's first two meters, and it held for both gates:

- `custom/require-source-citation` reports only violations, so it says "0 uncited
  figures" and can never say "0 out of how many". A violation count reaches zero
  both when every figure is cited and when nobody renders a figure — opposite
  facts, identical output. The fix was a `{ census: true }` option on the rule
  itself (reports every rendered figure tagged `cited`/`declared`/`uncited`), not
  a second scanner: a separate scanner would have its own idea of what a rendered
  figure is, and the meter and CI would drift. Consumer: `npm run kpi:citations`.
- `npm run check` is an `&&` chain: one bit, and it stops at the FIRST failure.
  `npm run kpi:verify` runs the same stages independently — stage list derived
  from `package.json`'s `check` at runtime, so a new stage joins the denominator
  by itself.

**What the one-bit gate was hiding:** `lib/testing/archivedScripts.test.ts >
"is referenced by nothing live"` flaked at 17,7 s against the unit lane's
deliberate 5 s budget, 1 run in 3. It reads every live source file in the repo
while riding a lane tuned for pure logic at 11 workers. Its sibling whole-tree
test (`server-boundary.test.ts:169`) already carries an explicit `180_000`; this
one never got it. Nothing had recorded the flake — the flake apparatus exists
in full (`lib/testing/flake/*`, `npm run flake:detect`, a quarantine lane) and
the register prints `0/5 entries` on every run, which reads identically whether
there are no flakes or nothing writes to the register. It is the second.

**Why it matters:** a timing-out whole-tree guard reports a finding it never
made. And the repo's own `CLAUDE.md` was a year-stale on its flagship rule —
it described 11 warnings burning down under `features/**` when the rule had been
at `error` everywhere reader-facing since 2026-08-24 at a measured 0. Baselines
live in `docs/kpi-meters.md`; see [[whole-artifact-invariants-beat-pattern-gates]]
for the same lesson about gates that pass while the thing they guard is wrong.
