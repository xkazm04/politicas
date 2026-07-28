---
name: Run a server-only loader under tsx with --conditions=react-server
description: NODE_OPTIONS="--conditions=react-server" npx tsx <script> lets an offline script import features/**/get*Data.ts directly.
---

`import "server-only"` throws under plain `npx tsx`: the package's default export
condition resolves to `index.js`, which is a bare `throw`. Its `react-server` condition
resolves to `empty.js` instead, so:

```
NODE_OPTIONS="--conditions=react-server" npx tsx scripts/my-probe.ts
```

runs a real feature loader (`getMoneyData`, `getMoneyMpDetail`, `getVerificationQueue`,
`getProfileData` …) against the store with no Next server and no vitest harness. React's
`cache()` is a no-op outside a request scope, so each call is a fresh read — which is
exactly what a before/after benchmark wants.

Why it matters: this is the only cheap way to prove a read-path refactor changed nothing.
It produced the byte-identity evidence for the money-layer indexed reads (dump loader
output to JSON on the old code, `git stash`, dump again, `JSON.stringify` compare — 8 MPs
plus the whole ledger and console queue, all identical). PGlite is single-connection, so
stop any dev server first.
