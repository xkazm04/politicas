# no-hardcoded-colors

No literal colors (`#hex`, `rgb()`/`rgba()`, `hsl()`/`hsla()`) in TS/TSX source.
Colors originate in the design-token layer; components consume token classes.

## Why

Every hardcoded color is a fork of the design system: it will not follow theme
changes, print styles, or contrast fixes. In politicas the token origin is
`app/globals.css` (`bg-paper`, `text-ink`, `fill-signal`, …) and every literal
color elsewhere is UI drift by definition.

## When it fires

A string literal or template chunk containing a hex color (`#abc`, `#aabbcc`,
4/8-digit alpha forms) or a `rgb(`/`rgba(`/`hsl(`/`hsla(` function head —
anywhere in TS/TSX source, including Tailwind arbitrary values
(`className="text-[#ff0000]"`).

## When it does not fire

False-positive suppression is built in for JSX attributes that never carry CSS
colors even when their value is hex-shaped: `href="#deadbe"` (fragment), `id`,
`key`, `htmlFor`, `src`, `aria-*`, `data-testid`, and the rest of the
`NON_COLOR_ATTRS` list in the rule source.

## Escape hatches

Structural, via config scoping — not annotations. Declare your token-mirror and
data-color zones in `eslint.config.mjs` and switch the rule off **for those
files only**. The politicas precedent (three declared zones):

```js
{
  files: ["features/landing/palette.ts", "features/labs/**/*.{ts,tsx}", "lib/civic/data.ts"],
  rules: { "custom/no-hardcoded-colors": "off" },
}
```

- a chart-chrome palette mirror (charting libs need raw hex),
- archived fixed art directions,
- domain data where color IS data (party colors).

Keeping the exemptions in config (not inline) means the full list of declared
exceptions is readable in one place — an auditable property, in keeping with the
pack's doctrine.

## Adoption mapping

The rule itself is token-system-agnostic; only the message text names the
politicas token homes. Adopt as-is, declare your own zones in config.
