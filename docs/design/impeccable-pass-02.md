# Impeccable pass 02 — four landing variants, compared

**Date:** 2026-07-29 · **Surface:** `/` (Persuade mode) · **Data:** the real
knowledge graph — 207 MPs, contribution index pass 42 · **Inputs:** the accepted
findings of [pass 01](impeccable-pass-01.md).

Live at `/?v=a` … `/?v=d`. The incumbent is the default: an experiment must not
replace the production front page merely by being deployed.

---

## What changed under all four

Every variant reads `getLandingData()`, which wraps the same
`getLeaderboardListData()` that `/zebricek` renders. Consequences worth stating:

- The landing can now say **207** and mean it — which is the positioning
  PRODUCT.md records ("complete chamber coverage; non-selection is the
  non-partisanship guarantee"). The sample-data landing could only imply it.
- Nothing carries „ILUSTRATIVNÍ UKÁZKA" any more, because nothing is illustrative.
- **Vesecká and Malá both print rank 2** with „dělené pořadí, 2 se stejným
  skóre". The competition-rank work from pass 42 reaches the front page intact
  instead of being flattened into a podium.
- The chamber spread is real: mean 65,7 · median 67,6 · σ 17,0.

---

## Detector scorecard

Desktop 1280×800 + mobile 390×844, both counted. "Actionable" removes the
rejections recorded in pass 01 **and** the `text-overflow`-on-`truncate` false
positive verified there.

| | incumbent | **A** bolder | **B** distill | **C** ledger | **D** typeset |
|---|---|---|---|---|---|
| **Actionable findings** | **129** | 7 | **2** | 6 | 12 |
| low-contrast | 74 | 2 | 0 | 0 | 2 |
| all-caps-body | 42 | 4 | 0 | 2 | 6 |
| undersized-ui-text | 8 | 0 | 0 | 0 | 0 |
| body-text-viewport-edge | 3 | 0 | 0 | 0 | 0 |
| line-length | 2 | 1 | 2 | 2 | 2 |
| flat-type-hierarchy | 0 | 0 | 0 | 2 | 0 |
| kicker-above-heading | 0 | 0 | 0 | 0 | 2 |

### Read this table honestly

**129 → 2 is not a 65× improvement.** The incumbent renders nine sections; the
variants render three to five. A page with less text on it earns fewer text
findings, and some of that gap is length, not quality.

The comparison that *does* survive normalization is categorical, not numeric:

- **Every citation on the incumbent fails AA. None does on any variant.** 39 of
  the incumbent's 74 contrast hits are the single `steel`-on-`paper` pair, which
  is what `SourceNote` is set in — so the failure count scales with how honest
  the page is being. That is the perverse incentive pass 01 found, and the
  `Citation` primitive removes it: a variant can add citations without adding
  failures.
- **`undersized-ui-text` goes 8 → 0 everywhere**, because `Citation` uses
  `text-xs` in both modes rather than an arbitrary `text-[10px]`.
- The two residual `low-contrast` hits in each of A and D are **different in
  kind**, and only one is a defect — below.

---

## The two residual contrast hits

**A · 2 hits, `#f0eee7` on `#d5372c` — a real defect I introduced.** The primary
CTA is `bg-signal` with `text-paper` at `text-sm font-black` (14px bold) →
4.1:1. WCAG's large-text exemption starts at 18.66px bold, so 14px bold does not
qualify and this fails AA. Fix: the button needs either a darker red plane or
larger type. Recorded rather than quietly patched, because it is the same class
of mistake pass 01 found in the incumbent — an accent used at a size its
contrast does not support.

**D · 2 hits, `#77726a` on `#f0eee7` — intentional and correct.** Variant D's
before/after panel renders the *unmodified* `SourceNote` beside the new
`Citation` on the same sentence. The detector flagging exactly the specimen D
exists to exhibit is a validation, not a regression.

---

## Per-variant verdicts

### A · bolder — the strongest landing for the stated user

Gives the largest surface on the page to `207` and lets the poster idiom carry
it. For a voter arriving from social media with low patience, the first viewport
answers "what is this and why should I trust it" in one number and one sentence,
and the ranked names beneath are real people they can recognize. It is the only
variant where the positioning is *visible* rather than *stated*.

Costs: the CTA contrast defect above; the tallest page of the four.

### B · distill — cleanest, and the most likely to be wrong

Two findings, both `line-length`. Nothing is unreadable, nothing is unsourced,
nothing is decorative. But `/` is a **Persuade** surface, and B reads as
documentation: one sentence, one table, one footnote. It answers the visitor who
already trusts the project. The voter who has never heard of it gets no reason
to start. Excellent as `/metodika`; too austere as the front page.

### C · ledger — the replacement world, and it loses on purpose

C is the only variant that abandons Konstrukt: monospace throughout, ruled
columns, numbered lines, accent reduced to a margin mark. It proves the
out-of-distribution claim is real — this is a genuinely different visual world,
built inside the same tokens and the same Czech copy.

It should not ship as `/`. Two reasons, one of them the detector's:

- `flat-type-hierarchy` ×2 is **correct**. The world is deliberately uniform in
  type, and uniformity is a scanability cost that Persuade mode cannot afford.
  In Operate or Read mode it would be a virtue.
- An official-record aesthetic signals *bureaucracy* to a Czech voter — the
  precise association a public-accountability project is trying not to inherit.
  Trust here has to read as evidence, not as officialdom.

Worth keeping as a living reference for a future export, `/admin`, or press-kit
surface, the way `features/labs/rentgen/` is kept.

### D · typeset — merge this one regardless of which landing wins

D changes no composition. It carries the pass-01 fixes and a side-by-side of the
same citation in both settings, so the argument is visible rather than asserted.
It also caught a defect pass 01 missed: at 390px the hero `h1` at `text-6xl`
paints „REPUBLIKA" 372px wide into 342px of space and gets shaved by
`overflow-x-clip`. **That bug is in the incumbent hero too.**

---

## Recommendation

1. **Merge D's substance now** — `Citation`, the two AA tokens, and the
   `text-5xl` hero at mobile. It is orthogonal to the landing question and it
   closes the P1 from pass 01.
2. **Take A as the landing direction**, after fixing its CTA contrast.
3. **Keep C archived** as a reference world for an Operate/Read surface. Do not
   delete it — pass 01's own lesson is that a rejected direction is evidence.
4. **Reuse B's discipline** on `/metodika`, not on `/`.

Open, and deliberately not decided here: whether `steel-aa` and `signal-text`
should simply **replace** `steel` and `signal` rather than sit beside them. That
is a repo-wide token change and belongs to `docs/DESIGN.md`, not to a landing
experiment.

---

## What this pass says about the tool

- The deterministic detector is only worth running **after** it is configured.
  Unconfigured it produced 38 findings that were 100% false positives; the
  design-system rule family was dormant until a machine-readable `DESIGN.md`
  existed; and one rule (`text-overflow`) cannot tell truncation from breakage.
- It is nonetheless the reason three real defects are known: the citation
  contrast, the 10px floor breach, and the clipped hero. **None of them was
  visible to `npm run check`**, which was green throughout — and none was
  visible to the design doc, which described its own debt incorrectly.
- Its LLM-side doctrine ("the brief wins") is what made the collisions
  tractable. A tool that had insisted on removing `border-l-4` would have been
  uninstallable here.
