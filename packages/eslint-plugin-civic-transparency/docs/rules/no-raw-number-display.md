# no-raw-number-display

**Doctrine rule.** No direct `.toFixed()` / `.toLocaleString()` /
`.toLocaleDateString()` / `.toLocaleTimeString()` calls in product surfaces —
formatting is decided **once**, in the formatting chokepoint.

## Why

Two reasons, one architectural and one nasty-practical:

- One chokepoint (`lib/format.ts` in politicas) is what makes the sibling rule
  `require-source-citation` *detectable* — house formatters are the only way
  numbers reach the page, so call sites can be found statically.
- `toLocaleString` output depends on the runtime's ICU — server and client can
  ship different versions, so the same call can render different bytes and
  **break hydration**. The chokepoint is deterministic and Intl-free.

## When it fires

Any non-computed member call named `toFixed`, `toLocaleString`,
`toLocaleDateString`, or `toLocaleTimeString` — in the file scopes the config
applies the rule to.

## When it does not fire

- Computed access (`n["toFixed"]`) and unrelated method names.
- Files outside the configured scope — politicas scopes it to `features/**` and
  `app/**`, because the `lib/` chokepoint itself legitimately calls `toFixed`.

## Escape hatches

`// raw-format-ok: <reason>` on the line or the line above, for deliberate
exceptions (e.g. an internal admin console that never server-renders, or a
build-time static table):

```ts
const pct = (w * 100).toFixed(0); // raw-format-ok: build-time static methodology table
```

## Adoption mapping

Generic in mechanism, doctrine in intent: adopt it when you have (or are
introducing) a single formatting module. Scope it so the chokepoint itself is
exempt, and follow the warn-first burn-down policy described in
`require-source-citation.md`.
