---
name: raf-guard-strictmode-trap
description: "A requestAnimationFrame \"already scheduled\" guard in a ref must be zeroed on cleanup, or StrictMode's double-mount kills all rendering in dev only."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1c9c34d2-915c-40e2-83b4-1fc1a71eda67
  modified: 2026-07-26T12:55:46.995Z
---

The canvas rendering pattern `if (frameRef.current) return; frameRef.current =
requestAnimationFrame(...)` is a **dev-only landmine** unless the cleanup resets
the ref:

```ts
useEffect(() => () => {
  cancelAnimationFrame(frameRef.current);
  frameRef.current = 0;          // ← without this, nothing ever draws again
}, []);
```

React 19 StrictMode mounts → cleans up → mounts again. The first mount schedules
a frame; cleanup cancels it but leaves the stale handle in the ref; on the real
mount every `schedule()` sees a truthy handle and returns. `draw()` is never
called once. Cost ~4 debugging rounds on `/graf` (2026-07-26).

**Why it's nasty:** it is invisible to `typecheck`, `lint`, `vitest`, and
`next build` — production has no StrictMode double-mount, so a production probe
renders fine while `npm run dev` shows a blank canvas. Symptom in the browser is
*"nodes are clickable but invisible"*: hit-testing reads `positions` directly and
works perfectly, so only the paint is missing.

**How to apply:** when a bug is visual and the DOM/state look correct, don't keep
reading the draw code — instrument it (`window.__calls++` at the top of the draw
function) and check from the browser whether it runs at all. That one measurement
separated "draws wrong" from "never draws" immediately, after several wrong
guesses. Chrome is installed at `C:\Program Files\Google\Chrome\Application\`;
`puppeteer-core` in the scratchpad drives it without touching package.json, and
`getImageData` pixel counts are a reliable blank-canvas oracle.
Related: [[rendering-gotchas]], [[react-state-lint-patterns]].
