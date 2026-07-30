# role-button-requires-keydown

A non-`<button>` element that opts into button semantics (`role="button"` +
`onClick`) must also handle keyboard activation (`onKeyDown`).

## Why

`role="button"` promises assistive technology a button — but a `<div onClick>`
only delivers for mouse users. Keyboard users (and switch-device users) get a
focusable-looking element that does nothing on Enter/Space. This is the most
common WCAG 2.1.1 (Keyboard) failure in React codebases.

## When it fires

A JSX element that is **not** `<button>`, with a statically-analyzable
`role="button"` (string literal, bare or in an expression container), an
`onClick` attribute, and **no** `onKeyDown` attribute.

## When it does not fire

- Real `<button>` elements (they get keyboard activation for free).
- `role="button"` without `onClick` (nothing to activate).
- Other roles, or a dynamic `role={expr}` that cannot be statically read.
- Elements that already have `onKeyDown` (the handler's correctness — Enter and
  Space — is trusted, not verified).

## Escape hatches

Prefer the structural fix — use a real `<button>`; it is nearly always possible
and also brings focusability and disabled semantics. Otherwise:

```tsx
<div
  role="button"
  tabIndex={0}
  onClick={activate}
  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") activate(); }}
>
```

There is no annotation escape: an element claiming to be a button with no
keyboard path has no legitimate variant.
