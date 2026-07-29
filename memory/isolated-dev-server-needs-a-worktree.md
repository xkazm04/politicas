---
name: isolated-dev-server-needs-a-worktree
description: Next 16 refuses a second dev server in one project dir; a node_modules junction breaks Turbopack, so an isolated preview needs a git worktree + real npm ci + PGLITE_PATH.
metadata:
  type: project
---

When another session already holds `npm run dev` in this repo and you need your
own server (to screenshot a change, or because their PGlite connection has
wedged), **you cannot just pick another port.**

What fails, in order:

1. `npx next dev -p 3005` in the repo root → *"Another next dev server is
   already running"* + the other PID. Next 16 locks per **project directory**
   (`.next/dev/lock`), not per port. Do not delete that lock — it is not yours.
2. A `git worktree` + a **junction** for `node_modules` (to skip the install) →
   Turbopack dies with *"Symlink [project]/node_modules is invalid, it points
   out of the filesystem root."* It will not resolve a linked module tree.

What works:

```bash
git worktree add .claude/worktrees/<name> HEAD --detach
cd .claude/worktrees/<name> && npm ci --ignore-scripts   # a REAL install
PGLITE_PATH="<abs path to a .pglite copy>" npx next dev -p 3005
```

The worktree gets its own `.next`, so the lock never collides. `--ignore-scripts`
skips the `prepare` hook so it does not reinstall lefthook's git hooks.

Two things that matter alongside it:

- **A wedged PGlite store is rescued by copying it, not by repairing it.** The
  symptom is every loader degrading to `null` with
  `xlog flush request 0/… is not satisfied --- flushed only to 0/…` in
  `.next/dev/logs/next-development.log`. `robocopy .pglite .pglite-<name> /E /MT:8`
  and point `PGLITE_PATH` at the copy — the fresh process replays the WAL and
  reads fine. `/.pglite-*` is already gitignored.
- **The worktree is a separate checkout**, so an edit in the main tree does not
  reach the running preview. Copy the file across (or commit and reset the
  worktree) or you will scan stale markup and believe a fix did not work.

Clean up with `git worktree remove <path> --force` — and check
`git worktree list` first, because other sessions keep worktrees here too
([[architect-graph-deferrals]] names the parallel-session convention).
