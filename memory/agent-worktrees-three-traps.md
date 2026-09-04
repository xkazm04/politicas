---
name: agent-worktrees-three-traps
description: Agent worktrees are cut from origin/master (not local master), share the session scratchpad, share one %TEMP% PGlite template, and live INSIDE the repo dir where tree-walking tests see them — four traps paid for in the 2026-09-04 moonshot wave.
metadata:
  type: feedback
---

Dispatching five builders with `isolation: "worktree"` on 2026-09-04 hit four
things at once, none of them in the builder's code:

1. **The worktree branch is cut from `origin/master`, not local `master`.** Local
   master was 38 commits ahead (unpushed) and origin 14 ahead on a divergent line,
   so every builder started without its design file and without the week's fixes.
   Fix: make `git merge --no-edit master` the builder's step 0 (conflict is only
   `.ai/applied.jsonl`, append-only, keep both sides), and expect the merge into
   master to carry origin's commits along.
2. **All builders share the session scratchpad.** One overwrote another's
   commit-message temp file mid-run and a commit briefly carried the wrong group's
   text. Fix: temp files under `<worktree>/.tmp-<group>/`, deleted before the gate.
3. **One PGlite template under `%TEMP%\politicas-pglite-template-*` serves every
   worktree** and goes stale ("could not open file global/1232") once a builder
   changes DDL; PGlite-lane tests then fail in a suite and pass alone. Fix: delete
   the template dir and let the lane rebuild it.
4. **Worktrees live inside the repo dir (`.claude/worktrees/<agent>/`)**, each a
   full clone with `node_modules`, so a test that walks the tree
   (`lib/testing/archivedScripts.test.ts`) read 10 730 of 16 431 files from other
   checkouts and timed out. Fixed in `c9ded85` by skipping `worktrees`; any new
   tree-walker needs the same skip.

**Why:** each of these looks like a builder defect (missing file, wrong commit,
red PGlite test, red gate) and is not; diagnosing them cost the coordinator a
round each.

**How to apply:** put 1–3 in every builder prompt; after the wave, `git worktree
remove --force` each worktree (branches survive) so the tree-walkers and disk
recover. Related: [[shared-index-needs-commit-only]] (the merge side),
[[isolated-dev-server-needs-a-worktree]] (why a worktree needs a real `npm ci`),
[[agent-worktrees-carry-crlf]].
