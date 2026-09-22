# no-server-import-in-client

In modules that start with the `"use client"` directive, forbid **value** imports
of server loader modules (`get*` / `*Loader` files) and of `lib/db/*`.

## Why

A value import from a client component pulls the server data layer (in politicas:
`getStore()` / PGlite WASM) toward the browser bundle. Before this rule the
boundary was enforced only by header comments. Type-only imports are allowed —
they erase at compile time.

## When it fires

Only in files whose **first statement** is the `"use client"` directive:

- `import { getX } from "./getXData"` — a value import whose source's last path
  segment matches `get[A-Z]...` or `...Loader`, or whose path contains `lib/db/`.
- Mixed specifier lists (`import { getX, type XData } from ...`) — one value
  specifier is enough to pull the module.
- **Dynamic imports** (`await import("./getXData")`) — there is no type-only
  dynamic import; every one is a real runtime breach.
- **Re-exports** (`export { getXData } from "./getXData"`, `export * from`) — a
  client barrel pulls the module exactly like an import; `export type { … } from`
  erases like `import type` (and is reported under `typeImports: "forbid"`).

## When it does not fire

- Non-client modules (no leading `"use client"`).
- `import type { X } from ...` declarations, and specifier lists where **every**
  specifier is `type` — unless `typeImports: "forbid"` (see Options).
- Paths that merely resemble the pattern (`lib/dbg/...` does not match).

## Options

```js
"custom/no-server-import-in-client": ["error", { typeImports: "forbid" }]
```

- `typeImports: "allow"` (default) — `import type` from a loader is tolerated; it erases at
  compile time. This is the preset contract for external adopters.
- `typeImports: "forbid"` — a type-only import of a loader is reported too (message
  `typeImportInClient`). A type-only import still couples the client file to the server
  module, and the next value specifier added to that line is a bundle breach that reads
  as "a type moved". The intended home for the shapes is a sibling pure `*Types.ts`
  module both sides import. politicas runs in this mode since 2026-09-01, after every
  loader's prop types were moved out (29 client import sites across 9 loaders).

## Escape hatches

There is deliberately no annotation escape — the fix is structural:

1. Import only types: `import type { MoneyData } from "./getMoneyData"` (politicas
   convention: prefer a sibling `*Types.ts` module as the type home; see
   `docs/architect/decisions/2026-07-26-server-only-boundary-enforcement.md`).
2. Receive data via props from the server page that owns the loader call.

## Adoption mapping

The server-module heuristic is a filename convention (`get*.ts`, `*Loader.ts`,
`lib/db/`). If your project uses different loader naming, adopt the convention or
fork the `SERVER_SOURCE` regex — the rule is intentionally convention-driven
rather than resolution-driven, so it stays fast and dependency-free.
