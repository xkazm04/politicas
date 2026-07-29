# Impeccable pass 01 — audit + triage ledger

**Date:** 2026-07-29 · **Tool:** impeccable v4.0.3, built from a clone of
`pbakaus/impeccable` at HEAD · **Surface:** `/` (landing), Persuade mode ·
**Detector:** 60 deterministic rules, no LLM.

This is an **external** audit. Its verdicts are not automatically right: every
finding below is triaged against this repo's own rules, and the ones that lose
say so and why. Nothing here has been applied to `master` — the accepted items
are demonstrated in the landing variants (pass 02) so they can be compared
before they are adopted.

---

## How the scans were run

| # | Scan | Command | Findings |
|---|---|---|---|
| 1 | Source, no design system | `detect features app` | 38 |
| 2 | Source, with `DESIGN.md` present | `detect features app` | **234** |
| 3 | Rendered, desktop 1280×800 | `detect http://localhost:3000/` | 69 |
| 4 | Rendered, mobile 390×844 | `detect … --viewport 390x844` | 66 |

Scan 1 → 2 is the single most useful mechanical fact of this pass. The detector
already walks up to `docs/DESIGN.md`, but that file carries **no YAML
frontmatter**, so it parses to zero tokens and the whole `design-system-*` rule
family stays dormant. Writing the generated mirror at `/DESIGN.md` armed it and
added 196 findings that were always true and simply unmeasured.

Scans 3–4 need a browser. They are where contrast and layout rules live, and
they found things no amount of source reading does.

---

## Audit health score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | **2**/4 | `steel`, the secondary-text token, is 4.11:1 on `paper` — below AA — and it is what `SourceNote` is set in |
| 2 | Performance | **3**/4 | partial assessment; nothing measured regressed, entry motion is once-only and short |
| 3 | Responsive | **2**/4 | an MP's name overflows its row by 27px at 390px; 3 paragraphs reach the viewport edge |
| 4 | Theming | **4**/4 | one off-token color in the whole tree, inside a declared exception zone |
| 5 | Implementation integrity | **4**/4 | coherent, product-specific, and the detector's top slop rule is this system's own idiom |
| **Total** | | **15/20** | Good — address accessibility and responsive |

**Implementation integrity verdict: PASS.** The landing could not be swapped
into another product. Konstrukt's vocabulary (poster numerals, mono index
captions, `gap-px` tile grids over an ink ground, the red rule) is specific,
consistent, and carries meaning rather than decoration. The detector's single
loudest complaint is an artifact of that specificity, not evidence against it.

---

## P1 · The citation primitive is illegible

**This is the finding of the pass.** Three separate rules landed on the same
component, and only together do they mean anything.

`SourceNote` — `features/shared/components/SourceNote.tsx` — is what makes
"every rendered number cites its source" visible. It is currently typeset as:

```
font-mono text-[11px] uppercase tracking-widest text-steel     (10px in places)
```

Measured on the rendered page at 390×844:

| Property | Value | Against |
|---|---|---|
| Contrast | **4.11:1** (`#77726a` on `#f0eee7`) | WCAG AA needs 4.5:1 |
| Size | **10px** on 4+ instances | `docs/DESIGN.md` §5 sets an 11px floor |
| Case | uppercase + `tracking-widest` | on runs up to **115 characters** |

The longest instance, verified in the DOM:

> `obr. 3 — ILUSTRATIVNÍ UKÁZKA · kompozit = Σ pilíř × váha, přepočet každé čtvrtletí; skutečný žebříček viz /zebricek`

115 characters, uppercase, letter-spaced, 11px, at 4.11:1, on a phone.

**Why it matters more than its severity suggests.** `docs/DESIGN.md` §2 permits
"uppercase tracked labels only for meta", and `SourceNote` is meta — so this is
*compliant*. The rule classifies by **role**, not by **length**, and a
115-character sentence wearing a label's clothes slips straight through it. The
system enforces that the citation is **present** and has never once checked that
it is **readable**. For a product whose entire claim to trust is "check the
number yourself", and whose primary user is a voter on a phone, an unreadable
citation is a failure of the brand rule, not of typography.

**Recommendation.** Split the rule by length, not role: keep tracked caps for
true labels (`obr. 4`, `01 · denně`), and set anything sentence-shaped in
sentence case at `text-xs` minimum with an AA-passing ink. Demonstrated in
variant D.

---

## P1 · Two palette tokens sit just under AA

Independently recomputed, not taken from the tool:

| Pair | Contrast | Verdict |
|---|---|---|
| `steel #77726a` on `paper #f0eee7` | **4.11:1** | fails AA for text < 18.66px |
| `signal #d5372c` on `paper #f0eee7` | **4.10:1** | fails AA at small sizes; **passes** the 3:1 large-text bar |
| `paper` on `signal` (small text) | **4.1:1** | fails AA |

This is a property of the palette, not of any component — 22 of the 40 landing
contrast findings are the single `steel`-on-`paper` pair. `signal` is fine where
Konstrukt actually uses it big (the red period, poster numerals, section rules);
it fails only where it is small.

**Candidate token values** (computed, AA-passing, hue preserved):

| Token | Now | Proposed | New ratio |
|---|---|---|---|
| `steel` | `#77726a` (4.11:1) | `#6b665f` | **4.90:1** |
| new `signal-text` | — | `#b82b21` | **5.31:1** |

A token change touches every surface, so **this is not applied here.** It is a
`docs/DESIGN.md` decision. Variant D shows what it looks like.

---

## P1 · Mobile layout breaks at 390px

- `features/landing/components/Standings.tsx:36` — `<span class="block truncate
  text-lg font-black uppercase tracking-tight">` holding an MP's **name
  overflows its box by 27px**. `min-w-0` is on the span but not on the flex
  parent, so `truncate` never gets a bounded width to truncate against.
- Three `<p>` elements reach the right viewport edge (`right -6px`).

Measured caveat, in the tool's disfavour: `document.scrollWidth === innerWidth
=== 390` at rest, so **there is no horizontal scrollbar.** The name is clipped
and the paragraphs are crowded; the page does not break. Severity is real but
lower than "overflow" sounds.

---

## P2 · The design system is wrong about its own debt

`docs/DESIGN.md` §2: *"No pixel-valued arbitrary sizes (`text-[10px]`) in new
shipped surfaces (legacy `text-[11px]` meta is being consolidated into
`SourceNote`)."*

The actual count, once the mirror armed the rule — **195 instances**:

| Count | Value |
|---|---|
| 143 | `10px` |
| 27 | `13px` |
| 9 | `14px` |
| 6 | `9px` |
| 5 | `12px` |
| 5 | `8rem` / `10rem` / `7rem` / `12.5px` |

The doc names the debt as *legacy 11px*. The dominant value is **10px** — below
the 11px floor §5 sets — and there are **6 instances at 9px**. The debt is
larger than documented and points the other way.

---

## P2 · Meta text on cobalt renders at 3.2:1

`features/landing/components/DataSources.tsx:21,25,29` set `text-[11px]` and
`text-sm` at `opacity-70` / `opacity-80` over `bg-cobalt`.

Nominal color math says the blend is ~4.6:1 and passes. The detector
**screenshots and measures real pixels**, and gets a **3.2:1 median** — thin
antialiased mono strokes at 11px never reach full opacity, so the effective
contrast is well below the nominal figure. This one is worth internalizing: for
small type over a colored plane, computed contrast is optimistic.

**Recommendation:** drop the opacity and use a solid lighter tint of `paper`.

---

## Rejected — the brief wins

Impeccable's own doctrine: *"Honor pinned aesthetics… Redirecting a clear brief
toward your taste is failure."* Recorded here rather than silently ignored.

### `side-tab` × 38 — REJECTED (all instances)

> *"Thick colored border on one side of a card — the most recognizable tell of
> AI-generated UIs."*

Every hit is `border-l-4`. Konstrukt is a **Sutnar functionalist poster**: the
thick rule is the system's primary structural device, used at three declared
weights (4px structural, 2px list head, 1px hairline). This is the design
language, and it was chosen in a prototype round on 2026-07-22. The rule is a
good default for generic SaaS UI and simply does not apply to a system with a
committed poster idiom.

**This was the entire unconfigured signal** — before `DESIGN.md` existed, 38 of
38 findings were this rule, i.e. **100% false positives**. Configure before
believing.

### `all-caps-body` — REJECTED on display, **ACCEPTED on `SourceNote`**

Uppercase headings, buttons, module names and row names are Konstrukt by
declaration and stay. The same rule firing on 115-character citation sentences
is not a style disagreement — see P1 above. Same rule, opposite verdicts,
decided by length.

### `hero-eyebrow-chip` × 1 — REJECTED

The tracked-caps eyebrow above the h1 is `obr. 1 — hlavní zpráva · 9. volební
období`. In generic SaaS this is the "eyebrow chip" tell; here the numbered
`obr. N` caption is a load-bearing convention of the poster idiom and appears
on every figure in the product.

### `em-dash-overuse` × 28 — REJECTED (advisory)

The em dash is standard Czech typographic punctuation. The rule is calibrated
for English AI-slop prose.

---

## Positive findings

- **Token discipline is airtight.** One `design-system-color` finding in the
  entire tree (`#33404f`), inside `features/labs/rentgen/` — a declared,
  lint-scoped exception zone. `custom/no-hardcoded-colors` has effectively zero
  leakage. An external tool with no knowledge of the lint rule independently
  confirms it.
- **The illustrative/real distinction survives an adversarial read.** Every
  sample figure on the landing carries `ILUSTRATIVNÍ UKÁZKA`, and the tile form
  itself changes (`ochre` edge, `steel` numeral, `paper-strong` ground). Nothing
  reads as real that isn't.
- **No horizontal scroll at any tested viewport**, despite the crowding.
- **Motion is disciplined** — entry-only, short, no ambient loops on the landing.

---

## Detector configuration written from this triage

`.impeccable/config.json` records the rejections so future runs surface signal
instead of the same 38 lines. Each ignore carries its reason; a rule is never
silenced without one.

---

## Where each accepted item goes

| Finding | Severity | Demonstrated in |
|---|---|---|
| `SourceNote` legibility | P1 | Variant D (and adopted by A/B/C) |
| `steel` / `signal-text` tokens | P1 | Variant D |
| Standings 27px overflow | P1 | all variants |
| 195 arbitrary type sizes | P2 | backlog — repo-wide, not a landing fix |
| DataSources opacity contrast | P2 | Variant D |

Commands impeccable itself recommends next, in priority order:
`/impeccable typeset` (P1, the citation), `/impeccable adapt` (P1, 390px),
`/impeccable colorize` (P1, the two tokens), `/impeccable polish` (last).
