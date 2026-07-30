# no-silent-null-catch

At the server-loader boundary, `catch { return null; }` (or `return []`) silently
degrades the surface to an empty state with no failure trace. Require a call to
`reportLoaderFailure(...)` in the same catch block.

## Why

The sibling rule `no-silent-catch` only flags *empty* catches — but the loader
failure shape that actually bites is a catch that returns a fallback value. The
page renders, looks intentional, and a dead database becomes indistinguishable
from an empty one. This class of bug cost politicas a day of diagnosis
(2026-07-25; see `docs/architect/decisions/2026-07-26-silent-degradation-observability.md`).

## When it fires

A `catch` block that contains a `return null;` or `return [];` statement
**anywhere** in the block, and no expression-statement call to
`reportLoaderFailure(...)` in the same block. (Deliberately not "exactly one
statement" — prepending busywork must not bypass the check.)

## When it does not fire

- Catches that rethrow, or return a non-empty/substantive value
  (`return { error }`, `return [FALLBACK]`).
- Empty catches (that is `no-silent-catch`'s report).

## Escape hatches / adoption mapping

The fix is a trace call before the fallback return:

```ts
catch (err) {
  reportLoaderFailure("getMoneyData", err);
  return null;
}
```

In politicas, `reportLoaderFailure` lives in `@/lib/db/loaderGuard`. Adopting
projects should point the message at their own equivalent — the rule matches the
call by name, so export a `reportLoaderFailure` wrapper around your reporting
layer. Note that a bare `console.warn` does **not** satisfy the rule: the point
is one grep-able, structured degradation channel, not ad-hoc logging.

## Scoping advice

Scope it to loader files, as politicas does (flat-config `files:
["features/**/get*.ts", "features/**/*Loader.ts"]`), rather than repo-wide —
in UI event handlers a null fallback is often a legitimate, already-visible state.
