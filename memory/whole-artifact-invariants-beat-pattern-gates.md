---
name: whole-artifact-invariants-beat-pattern-gates
description: Per-string pattern gates stay green while falsehoods ship — whole-artifact invariants (digits unchanged, syntax balance not worsened, arithmetic closes, quotes locatable in source) are what actually catch content corruption. Make every automated rewrite pass them.
metadata:
  type: project
---

Batch-015's audit cycle (2026-08-05) ran four rounds. In every round that carried a real
falsehood — a municipally-owned company elevated as a "private" tie, a sweep that turned
„paušální dávkou 15 000 Kč" into „dřívějším zpracováním 000 Kč", two fabricated bill
quotations, sponsor counts that didn't add up — **every code gate was green**: schema,
language gate, jargon regexes, all of it. The gates check per-string FORM; the defects were
whole-artifact TRUTH.

What closed the gap was a different class of check, each cheap and deterministic:
1. **Digit invariant** — a rewrite may never alter the multiset of digit sequences (explicit
   allowlist for intended drops/transforms). Catches eaten amounts and stripped identifiers
   outright.
2. **Syntax invariant** — a rewrite may never worsen parenthesis balance nor introduce a full
   stop before a lowercase continuation. MUST be *relative* (before vs after), never absolute:
   Czech legal prose is legitimately full of unmatched closers („písm. m)").
3. **Arithmetic closure** — any stated count („z dvanácti … tři … zbývajících devět") must sum
   against the source payload.
4. **Quotation locatability** — any guillemet span must be findable verbatim
   (whitespace-normalized, NFC) in the cached source text (the P49 guard generalized).

Both regex traps recurred from earlier passes while building this: ASCII `\w`/`\b` cannot match
Czech letters (use `\p{L}` + `/u`), and „dávka" is genuinely ambiguous (pipeline batch vs
social benefit) — only enumerated forms are decidable.

**How to apply:** any script that rewrites reader-facing prose asserts invariants 1–2 in code
before emitting; any audit of generated analysis runs 3–4 before accepting. See
`scripts/case-loops/law/sweep-old27-015.ts` for the reference implementation. Related:
[[corpus-role-snapshots-go-stale]], [[reader-facing-loaders-need-the-language-gate]].
