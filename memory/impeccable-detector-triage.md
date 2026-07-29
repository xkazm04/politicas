---
name: impeccable-detector-triage
description: The impeccable detector is worthless unconfigured here (38/38 false positives) and half-asleep without a frontmatter DESIGN.md; four rules are rejected on record and one cannot tell truncation from breakage.
metadata:
  type: feedback
---

`/impeccable` (v4.0.3, installed at `.claude/skills/impeccable`, hook OFF) is
useful on this repo, but only after three facts are known. Full working in
`docs/design/impeccable-pass-01.md`.

**1. Unconfigured, it is 100% noise.** The first scan of `features/ app/`
returned 38 findings that were all one rule — `side-tab`, i.e. `border-l-4`,
"the most recognizable tell of AI-generated UIs". Konstrukt is a Sutnar
functionalist poster and the thick rule is its primary structural device. Do not
re-litigate this; `.impeccable/config.json` records the rejection with its
reason. Rejected on the same record: `hero-eyebrow-chip` (the „obr. N" caption
is a load-bearing convention), `em-dash-overuse` (standard Czech punctuation),
and `features/labs/**` (declared token-exception zone).

**2. Without a frontmatter `DESIGN.md`, the whole design-system rule family is
dormant.** The detector walks up to `docs/DESIGN.md` on its own, but that file
has no YAML frontmatter, so it parses to zero tokens and silently checks
nothing. The generated mirror at `/DESIGN.md` arms it — the same scan went
38 → 234. Root `DESIGN.md` is therefore GENERATED, `docs/DESIGN.md` stays the
authority, and `docs/feature-doc-map.json` couples the mirror to
`app/globals.css` + `docs/DESIGN.md`.

**3. `text-overflow` cannot distinguish a working `truncate` from a layout
break.** It fires on `scrollWidth > clientWidth`, which is the definition of
truncation. Verify by measuring whether the **box** escapes its parent or the
viewport (`getBoundingClientRect().right`), not whether the content exceeds the
box. A whole P1 in pass 01 was written and then withdrawn on this.

**But do not dismiss a family wholesale.** Rejecting `text-overflow` hid a real
defect the same rule had found: the hero `h1` at `text-6xl` paints „REPUBLIKA"
372px wide into 342px of space at 390px and is shaved by `overflow-x-clip`.
Triage rule that came out of this: reject a *rule* only after checking every
*instance* it flagged — see also [[prototype-rejection-and-labels]], which says
the same thing about rejected variants.

The LLM side is worth more than the detector. Its "**the brief wins**" doctrine
is why a design system with a committed POV survives contact with it: it will
honor a pinned aesthetic over its own defaults, so the collisions are arguable
rather than fatal.
