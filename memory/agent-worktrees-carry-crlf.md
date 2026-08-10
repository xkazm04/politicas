---
name: agent-worktrees-carry-crlf
description: Windows agent worktrees check out CRLF, so diffing a worktree copy against the main tree manufactures phantom whole-file diffs — recovery comparisons need --strip-trailing-cr
---

# Agent worktrees carry CRLF — phantom diffs during recovery

When a builder session dies inside a `.claude/worktrees/agent-*` worktree and a
resuming Director harvests its work by comparing worktree files against the main
checkout, **every file looks fully modified**: the worktree working copies carry
CRLF line endings while the main tree is LF, so `diff` reports whole-file changes
and `git status` in the worktree shows phantom `M` entries for files the builder
never touched.

**The fix:** compare with `diff --strip-trailing-cr <worktree-file> <main-file>`
(or `git diff --ignore-cr-at-eol`). Only files with a REAL delta survive; harvest
exactly those with `git commit --only` onto the wave branch.

Paid for on 2026-08-10 (perfect round 7, third Director session): two killed
builder worktrees flagged dozens of files; after `--strip-trailing-cr` the real
deltas were 3 files in one and 3 in the other. Without the flag the recovery
would have committed phantom rewrites of files owned by the sibling builder.

Related: [[isolated-dev-server-needs-a-worktree]] (worktrees for dev servers),
and the perfect skill's rule that builders work in the MAIN checkout on one
shared branch — worktree isolation is what created this trap; the recovery
knowledge matters because harnesses sometimes create agent worktrees anyway.
