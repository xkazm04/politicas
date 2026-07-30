# enforce-reduced-motion-fallback

Looping framer-motion animations (`transition: { repeat: ... }`) must have a
reduced-motion fallback in the same component. One-shot entry fades are fine.

## Why

Continuously cycling motion is the real vestibular hazard (WCAG 2.3.3 Animation
from Interactions / 2.2.2 Pause, Stop, Hide). A user who sets
`prefers-reduced-motion` is asking for loops to stop — an ungated
`repeat: Infinity` keeps spinning regardless.

## When it fires

A `motion.*` or `m.*` JSX element with an `animate` attribute whose transition
repeats — either via a sibling `transition={{ repeat: ... }}` attribute or a
`transition: { repeat: ... }` nested inside the `animate` object — in a
**component** (outermost enclosing function) that contains no reference to a
fallback token: `useReducedMotion`, `prefersReducedMotion`, or `shouldAnimate`.

Scoping is per-component, not per-file: one component's fallback does not exempt
a sibling component's loop in the same file. A fallback at the top of a component
does gate loops inside nested callbacks (`.map`, effects) of that component.

## When it does not fire

- No `animate` attribute, or a transition with `repeat: 0` / `repeat: false`.
- Non-motion elements, even with repeat-shaped props.
- The component references a fallback token (it is then **trusted** to gate
  itself — the rule verifies presence, not correctness of the gating logic).

## Escape hatches

- Gate the loop: `const reduced = useReducedMotion();` then
  `animate={reduced ? {} : loopKeyframes}`.
- One-off decorative exception, annotated on the element or the line above:

```tsx
// reduced-motion-ok: 2px shimmer on a 6s cycle, imperceptible as motion
<motion.div animate={{ opacity: [0.6, 1] }} transition={{ repeat: Infinity }} />
```

As always: the annotation requires a reason, and the reason should survive review.
