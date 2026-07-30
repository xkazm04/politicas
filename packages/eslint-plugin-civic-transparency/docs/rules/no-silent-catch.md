# no-silent-catch

No swallowed errors: an empty `catch` block (or an empty `promise.catch(() => {})`
handler) erases every trace of a failure.

## Why

A silent catch turns a production failure into an unexplained behavior. The next
person debugging needs the log line, not a comment saying the error was expected.
In a transparency product this is doctrine: a system that publishes accountability
data cannot itself fail unaccountably.

## When it fires

- A `catch` clause whose block contains **zero statements** — including
  comment-only blocks (`catch { /* ignored */ }`).
- A promise-chain `.catch()` whose handler is an arrow/function expression with an
  **empty block body**: `p.catch(() => {})`.

## When it does not fire

- Any catch with at least one real statement (a log call, a rethrow, a fallback
  assignment). This rule checks emptiness only — whether the statement is a *good*
  handler is `no-silent-null-catch`'s job at the loader boundary.
- Expression-body arrows (`p.catch((e) => console.warn(e))`) — not empty.
- Computed access (`obj["catch"](...)`) and other methods named similarly.

## Escape hatches

Minimum acceptable fix: `catch (err) { console.warn("[context]", err); }`.
Prefer routing through your error-reporting layer (in politicas:
`Sentry.captureException(err)` — a safe no-op when the DSN is unset).

If a failure is genuinely uninteresting, disable the line and say why:

```ts
// eslint-disable-next-line custom/no-silent-catch -- best-effort cache warm; cold path is correct
```

A bare disable with no reason defeats the audit trail — always attach the why.
