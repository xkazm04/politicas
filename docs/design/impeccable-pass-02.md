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

## MERGED — 2026-07-29

Recommendations 1 and the CTA half of 2 are **done**. What shipped to the
incumbent landing, and what it measured:

| | before | after |
|---|---|---|
| **Total findings** (desktop+mobile) | **135** | **27** |
| low-contrast | 74 | **0** |
| undersized-ui-text | 8 | **0** |
| tiny-text | 8 | **0** |
| body-text-viewport-edge | 3 | **0** |
| all-caps-body | 42 | 24 |
| line-length / text-overflow | 3 | 3 |

**The landing is contrast-clean.** Every remaining finding is either a rule
rejected on record (`all-caps-body` on Konstrukt display type, `text-overflow`
on a working `truncate`) or advisory (`line-length`).

What was done, and one decision that changed:

- **`SourceNote` itself now measures its children and sets by length.** The
  separate `Citation.tsx` from pass 02 was **deleted**. Two catalog primitives
  for one idea is exactly the drift `docs/DESIGN.md` §6 warns about, and folding
  the logic into the canonical name fixed **all 158 call sites in one change**
  with no migration. Two `!text-[10px]` overrides that were defeating it from
  the call site were removed.
- **`signal-text` was renamed `signal-deep`** — it turned out to serve both
  directions (small red text, and button planes under paper text), and the
  requirement is identical because both are "this red against `paper`".
- **CTA planes moved to `bg-signal-deep`** on the landing's `Methodology`,
  `SiteHeader` and variant A — the defect this pass found in A was also in the
  production page, twice.
- **`DataSources` lost `opacity-70/80`** (nominal 4.6:1, measured 3.2:1) and the
  hero dropped to `text-5xl` at base, clearing the clipped „REPUBLIKA".
- **`features/landing/**` moved wholesale to `steel-aa` / `signal-deep`.**

### Not done — the same defect outside the landing

`bg-signal` under small `text-paper` survives at 8 sites. Listed rather than
swept, because none was visually verified in this pass:

`features/admin/components/ReviewHubSection.tsx:10` ·
`features/civicscore/components/LeaderboardTable.tsx:318` ·
`features/graph/GraphPage.tsx:135` ·
`features/money/components/VerificationConsole.tsx:65` ·
`features/votetrack/components/DisciplineBoard.tsx:114` ·
`app/admin/AdminGate.tsx:80` · `app/error.tsx:61` ·
`app/global-error.tsx:63` (the last three on `hover:bg-signal`).

Also still open repo-wide: the `text-[10px]` count outside the landing, and
whether `steel-aa` / `signal-deep` should simply **replace** the originals.

---

## OUTCOME — all four variants rejected and deleted (2026-07-29)

**The landing stays Konstrukt.** Variant C was adopted as the baseline and then
reverted the same day, and A, B and D were deleted with it. `features/landing`
is byte-identical to the state it reached after the accessibility merge; the
switcher, `getLandingData.ts`, the four variants and `VariantTabs` are gone.

Why this is recorded rather than quietly dropped, per the repo's own lesson that
a rejected direction is evidence:

- **C looked defensible on paper and was worse in the product.** It scored well
  on the detector (6 actionable findings against the incumbent's 129) and it was
  the only variant that proved a replacement world was buildable inside the same
  tokens. Adopting it still lost: replacing a poster with a registry printout
  removes the one thing a Persuade surface needs, and the sections that had to be
  ported into it (five modules, sources, methodology) read as more rows in a
  ledger rather than as an argument.
- **A low finding count is not a quality score.** This pass already warned that
  129 → 2 was partly a length effect. C is the sharper version of the same
  caution: the variant with the fewest findings was the weakest page, because
  the detector cannot see persuasion, and the incumbent's interactive weight
  specimen — the single most convincing thing on the landing — has no ledger
  equivalent and scores nothing either way.
- **The generated variants were not good enough to develop further.** That is
  the honest summary of the round, and it is the user's verdict, not the tool's.

**What survived, and it is the whole value of the exercise:** the accessibility
work. `SourceNote` sets a citation by measured length rather than role, the two
AA tokens exist, the CTA planes are fixed, the hero no longer clips at 390px,
and the landing went 135 → 27 detector findings with **zero contrast failures**.
None of that required a new visual world, and none of it is being reverted.

**Do not rebuild the variants.** If a future round revisits the landing, start
from this file, not from a blank page.

---

## Recommendation (superseded — kept as the record of what was advised)

1. ~~**Merge D's substance now**~~ — **done**, and retained.
2. ~~**Take A as the landing direction**~~ — **not taken.** The landing stays
   Konstrukt.
3. **Keep C archived** as a reference world for an Operate/Read surface. Do not
   delete it — pass 01's own lesson is that a rejected direction is evidence.
4. **Reuse B's discipline** on `/metodika`, not on `/`.

Open, and deliberately not decided here: whether `steel-aa` and `signal-deep`
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
