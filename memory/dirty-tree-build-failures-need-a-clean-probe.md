---
name: dirty-tree-build-failures-need-a-clean-probe
description: An opaque `next build` crash on the shared tree is diagnosed by building the same commit in a detached worktree — round 4's "broken master" was a corrupted .next cache from two sessions racing builds.
metadata:
  type: project
---

`next build --webpack` on the main tree died with an opaque `uncaughtException TypeError: Cannot read properties of undefined (reading 'length')` immediately after "Creating an optimized production build", while the IDENTICAL commit built clean in a detached worktree (`git worktree add … --detach HEAD` + junctioned node_modules + `.env.local` copied in). Root cause: a corrupted `.next` cache — multiple concurrent sessions build in this tree. `rm -rf .next` fixed it; nothing was wrong with the code.

**Why:** with 2–3 concurrent sessions in this repo, the working tree is not a clean function of HEAD. Blaming (or "fixing") a merge on the basis of a dirty-tree build wastes an evening and risks a wrong revert.

**How to apply:** before diagnosing any main-tree build failure, (1) build the same commit in a throwaway detached worktree — 5 minutes, definitive; (2) if the clean build passes, clear `.next` and retry before reading a single stack frame. Related: [[isolated-dev-server-needs-a-worktree]], [[vitest-pglite-needs-tamed-workers]].
