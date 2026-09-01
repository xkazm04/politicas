---
name: shared-index-needs-commit-only
description: Under a concurrent session, `git add <path>` + `git commit` still commits whatever the OTHER session has staged; commit with `git commit --only <paths>` so the commit is exactly your files.
metadata:
  type: feedback
---

`git add <my files>` followed by a plain `git commit` carries every path the shared
index already holds — on 2026-09-01 a scan-sweep commit of two `lib/analysis` files
arrived at the hook with three `app/**` pages another session had staged, and only
the doc-sync hook's drift check (which asked for docs those pages owed) stopped it.
`git diff --cached --stat` before committing shows the contamination, but the
per-file staging discipline in CLAUDE.md is not enough on its own.

**Why:** two sessions share one index; staging is global, so "I only added my
paths" says nothing about what the commit will contain.

**How to apply:** commit with `git commit --only <path> [<path>…]` — it builds a
temporary index from exactly those paths, the hooks (lefthook + doc-sync) run
against that set, and the other session's staged files stay staged for them. Keep
`git diff --cached --stat` as the tripwire; treat any path you did not touch in
that output as veto 4 (a foreign in-flight file), not as something to include.
Related: [[agent-worktrees-carry-crlf]] (the other `--only` use), [[dirty-tree-build-failures-need-a-clean-probe]].
