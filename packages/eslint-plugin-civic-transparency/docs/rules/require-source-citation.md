# require-source-citation

**Doctrine rule.** A file that renders a formatted domain number in JSX must also
carry a provenance marker. "Every rendered number carries its source" stops being
a review convention and becomes a build gate.

## Why

politicas' brand rule (politicas.md §6, docs/DESIGN.md provenance discipline) is
that no figure reaches the reader without its source. A convention enforced by
review erodes; a lint rule does not. This is the flagship claim of the pack: an
uncited number is a build failure — provable, not promised.

## When it fires (the triggers)

Precision over recall — every trigger requires positive evidence that the value
is a *formatted domain number rendered to the reader*:

1. Member formatter calls `X.dec(...)` / `X.int(...)` / `X.czk(...)` in JSX
   **child** position, in a file that imports the formatting chokepoint
   (`lib/format`, `lib/i18n/useFormat`, or `moneyTypes`). Any receiver identifier
   matches (bound bundles like `const f = useFormat()`), but without the
   chokepoint import the file is not using house formatters and stays silent.
2. Calls to formatter names **imported from the chokepoint** (`czech`,
   `czechInt`, `formatDecimal`, `formatInt`, `formatCzk`, `compactCzk`) in JSX
   child position — renamed imports are tracked by local name.
3. An `<AnimatedScore …/>` element — the canonical score display.

Deliberate non-triggers: date formatting (dates are context, not claims),
formatter calls in JSX *attributes* (`aria-label`, `title`), raw numeric
literals (statically indistinguishable from indexes and counts).

## What satisfies it (file-scoped)

Any of these anywhere in the same file:

- A provenance element: `<SourceNote>`, `<SourceRef>`, `<DataUnavailable>`,
  `<LiveDataNotice>`, `<CitableNumber>`, `<ProvenanceCapsule>`.
- A `data-undisclosed` JSX attribute — the explicit "no source" marker.
  **Convention**: an element carrying `data-undisclosed` must render a visible
  „bez zdroje" badge, so the disclosure reaches the reader, not just the linter.

File scope (not JSX-subtree scope) is deliberate: many correct layouts render
the figure in a leaf element and the `SourceNote` as a sibling caption; a
subtree walk would flag exactly those.

## Escape hatches

`// citation-ok: <reason>` on the flagged line or the line above — for when the
citation genuinely exists but lives outside the file (e.g. the parent component
renders the caption). Grep-able audit trail; a bare disable comment is not.

## Adoption mapping

This rule is politicas-shaped: it assumes a formatting chokepoint and a
provenance component family. Adopt it only with that architecture (that is why
it lives in `configs.strict`, not `recommended`). The names to map: chokepoint
module paths (`CHOKEPOINT_SOURCE`), formatter names, and satisfier element names
— all constants at the top of the rule source.

## Severity policy (politicas precedent)

Ship **warn-first** against a measured violation inventory; burn a module down,
then move its glob to `error`. Never flip a scope to `error` while it still
warns — a red repo lint destroys trust in the whole pack.
