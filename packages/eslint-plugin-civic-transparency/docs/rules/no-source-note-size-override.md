# no-source-note-size-override

**Doctrine rule.** No font-size utility in a `<SourceNote>` `className`. The
citation primitive sets its own size by measuring its own children; a call site
that reaches past that puts citations back under the readability floor.

## Why

`docs/DESIGN.md` §3 says it in plain words:

> One consequence to respect: `className="!text-[10px]"` on a `SourceNote`
> defeats the fix from the call site. Two such overrides existed on the landing
> and were removed. **Do not add another.**

On 2026-08-24 there were **72 of them across 29 files** (66 at 10 px, 6 at
11 px), removed in commit `776f01a`. A cultural rule that failed 72 times is
not a rule.

The fix it defeats is real, not cosmetic. The 2026-07-29 `/impeccable` audit
found the primitive that *carries the brand rule* — every rendered number
carries its source — set at 4,11:1 contrast, sometimes 10 px, in letter-spaced
verzálky on runs up to 115 characters. A citation that cannot be read has not
been made. `SourceNote` answered it internally: it measures `textLength` of its
children against `LABEL_MAX_CHARS` and picks label-vs-sentence typesetting,
both at `text-xs` (12 px) in `steel-aa`. That decision belongs to the
primitive, so a caller cannot get it wrong by judgement.

## When it fires

A `<SourceNote>` element whose `className` contains a **font-size** utility.
Tailwind's `text-*` namespace is overloaded, so the matcher requires positive
evidence of a size:

| shape | example | flagged |
| --- | --- | --- |
| named scale `xs`…`9xl` | `text-xs`, `text-sm` | yes |
| arbitrary length | `text-[10px]`, `text-[0.625rem]` | yes |
| explicit length hint | `text-[length:var(--tiny)]`, `text-(length:--tiny)` | yes |
| size-shaped function | `text-[clamp(…)]`, `text-[calc(…)]` | yes |
| colour token | `text-ochre`, `text-steel-aa`, `text-paper/90` | no |
| arbitrary colour | `text-[#c8102e]`, `text-[var(--color-ochre)]` | no |
| non-size `text-*` | `text-balance`, `text-center` | no |

Variant prefixes (`sm:`, `hover:`, `data-[state=open]:`) are stripped
bracket-aware before matching, as is the important marker in both spellings —
`!text-xs` (Tailwind v3, which is what this repo writes) and `text-xs!`
(Tailwind v4, the current syntax). A trailing line-height modifier
(`text-[10px]/[1.4]`) does not hide the size.

The `!` is **not** required. Without it a second font-size utility wins or
loses by generated-stylesheet order, which is worse than losing: it is
nondeterministic from the call site. And a redundant `text-xs` is the seed the
next author edits into `text-[10px]`.

Template-literal `className`s are read through their **static quasis**, so
``className={`!text-[10px] ${extra}`}`` is caught and ``className={`!${tone.text}`}``
correctly stays silent.

## When it does not fire

- Any element other than `<SourceNote>`. The rule hard-codes that name.
- Colour overrides on `SourceNote`, which are deliberate and live in this repo
  (`!text-ochre` ×6, `!text-cobalt`, `` `!${tone.text}` ``).
- Spacing, layout, case and tracking utilities (`mt-3`, `min-w-0 truncate`,
  `normal-case tracking-wider`) — all live call sites.

## Escape hatches

**There is no annotation, and that is deliberate.** DESIGN.md does not permit
an exception; it permits a **mode override**. `SourceNote` already ships the
hatch for when the measurement genuinely lies:

```tsx
<SourceNote as="label">…</SourceNote>     {/* force tracked verzálky */}
<SourceNote as="sentence">…</SourceNote>  {/* force sentence case */}
```

Both stay at `text-xs`. Inventing a `// size-ok:` annotation here would reopen
the hole 72 call sites already walked through.

## Known recall gap

The matcher reads **static class text only**. A class string laundered through
a variable or a prop default is invisible to it. As of 2026-08-24 exactly one
such site survives `776f01a`:

```
features/money/components/BasisDisclosure.tsx:61
  className = "mt-2 !text-[10px]",   // default param, then <SourceNote className={className}>
```

Resolving single-definition static initialisers through ESLint's scope
analysis is implementable and is the intended widening. It was deliberately
not taken in the change that introduced the rule, because it would have
shipped a rule that is red on arrival against product source, and the honest
sequence is: fix that default, then widen the matcher. Zones and matchers in
this repo shrink and sharpen; they do not get exemptions.

## Severity

Ships at `error` under `features/**` and `app/**` from day one, because the
measured inventory of the shape it matches is **zero** — the same graduation
`no-raw-number-display` and `require-source-citation` took this week. A
warn-level rule enforces nothing here: `npm run lint` sets no
`--max-warnings`, so an advisory finding cannot fail any gate.

## Adoption mapping

Project-specific by construction — it names one component. Adopt it if you
have a typographic primitive that decides its own size from its content, and
change `PRIMITIVE` to your component's name. The generalisable idea is the one
worth stealing: when a primitive exists to make a decision the call site kept
getting wrong, the call site must not be able to override that decision, and a
lint rule is the only thing that says so at 3 a.m.
