# Memory Index

Durable, cross-session knowledge for Politicas — one line per entry. Read this
at session start; the linked files hold the fact + why it matters. Convention
and upkeep rules are in `CLAUDE.md` → "Agent memory". Add an entry only for a
learning worth recalling in three months that isn't derivable in ten seconds
from `docs/`.

## Decisions & strategy (do not relitigate casually)
- [Konstrukt visual philosophy](memory/konstrukt-visual-philosophy.md) — Sutnar functionalist poster won the prototype round; Broadsheet fused, Rentgen archived. Don't re-propose a redesign.
- [Sample-data-first strategy](memory/sample-data-first.md) — UI built against final data shapes over a deterministic, test-pinned mock (`lib/civic/`) before real ingestion; keep the shapes when ingestion lands.
- [Evidence-citation doctrine](memory/evidence-citation-doctrine.md) — every number cites its source; non-partisanship is enforced in the data model (unverified ties never feed the score). The brand rule.

## Project state
- [Graph bench: no graph DB (case #4)](memory/graph-bench-kuzu-x64-ready.md) — ran `graph.ts` on x64; Kuzu lost every workload to recursive-CTE/DuckDB on the dense co-voting graph. Verdict recorded (R12–R15); don't re-propose Kuzu until a millions-edge sparse graph exists.

## Conventions & traps
- [Token + catalog discipline](memory/token-and-catalog-discipline.md) — colors only in `globals.css` tokens (3 declared exceptions); shared catalog is a lint-enforced import boundary. Know these before fighting lint.
- [Rendering gotchas](memory/rendering-gotchas.md) — recharts livelock, SVG float drift, Czech formatting via `lib/format.ts`, SSR==CSR determinism. Four hydration/layout landmines.
