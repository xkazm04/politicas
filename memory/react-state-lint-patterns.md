---
name: react-state-lint-patterns
description: react-hooks/set-state-in-effect is an ERROR here — use useSyncExternalStore for localStorage state and rAF/observer callbacks for DOM measurement.
metadata: 
  node_type: memory
  type: project
  originSessionId: 1c9c34d2-915c-40e2-83b4-1fc1a71eda67
  modified: 2026-07-26T11:08:43.954Z
---

`npm run lint` (eslint-config-next 16 + React 19 rules) fails the build on
**`react-hooks/set-state-in-effect`**: any `setState(...)` called synchronously
in a `useEffect` body is an error, not a warning. Hit twice on 2026-07-26 while
building the dashboard/sidebar prototypes.

Two patterns that pass and are also the better code:

- **UI state hydrated from `localStorage`** (prototype variant switchers):
  `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` with a
  module-level cache + listener Set. `getServerSnapshot` returns the default,
  so SSR and the first client render agree and there is no hydration mismatch —
  the classic "read in `useEffect`, then `setState`" fix is exactly what the
  rule forbids. See `features/shell/AppShell.tsx`.
- **Measuring the DOM** (scroll-spy, "does this anchor exist?"): do the work
  inside a `requestAnimationFrame` callback, and set state only from there or
  from an `IntersectionObserver` callback. Both count as "external system
  callbacks", which the rule allows. Measuring after paint is also correct on
  its own terms — during a route transition the target nodes may not be in the
  DOM yet when the effect runs. See `features/shell/useActiveSection.ts`.

**Why:** both problems look like textbook `useEffect` work, so the instinct is
to write the forbidden form first and then fight the linter. Reach for these
two shapes directly. Related: [[rendering-gotchas]].
