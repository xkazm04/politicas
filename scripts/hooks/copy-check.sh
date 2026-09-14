#!/bin/sh
# Pre-push English copy gate (native-copy, 2026-09-14), run by lefthook.yml
# `pre-push` job `copy-check`. Lints messages/en.json against
# .ai/copy-baseline.json; only NEW error findings block, warnings print.
#
# Kept as a script, not inline in lefthook.yml: an inline if/then/else failed
# under lefthook on Windows ("-c: line N: syntax error: unexpected end of
# file") in both multi-line and single-line form, which would block every push.
#
# The checker is a gitignored link into ai-registry (fresh clones and CI do
# not have it), so without it the gate skips LOUDLY. See docs/i18n/style-en.md.
CHECKER=.claude/skills/native-copy/scripts/copy-check.mjs

if [ -f "$CHECKER" ]; then
  exec node "$CHECKER"
fi

echo "pre-push: native-copy checker not installed - copy gate SKIPPED (run ai-registry/scripts/link-registry.mjs)" >&2
exit 0
