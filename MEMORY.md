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
- [Architect graph deferrals](memory/architect-graph-deferrals.md) — /architect (2026-07-26) executed 5/8 loader-boundary findings but deferred 4 follow-ups on features/graph (in-flight round 4); the eslint `features/graph/**` exclusion hides violations until they're applied.
- [Graph bench: no graph DB (case #4)](memory/graph-bench-kuzu-x64-ready.md) — ran `graph.ts` on x64; Kuzu lost every workload to recursive-CTE/DuckDB on the dense co-voting graph. Verdict recorded (R12–R15); don't re-propose Kuzu until a millions-edge sparse graph exists.
- [/poslanec takes a pspId](memory/profile-route-takes-pspid.md) — the profile route resolves real psp.cz ids, so links built from mock MP slugs (dashboard leaderboard, graph nodes) 404.
- [The KG stores no source URLs](memory/kg-has-no-source-urls.md) — provenance ≠ citation; official links are rebuilt from stable ids, and which registry patterns actually resolve is recorded there.
- [Company node ids are 8-digit zero-padded IČOs](memory/ico-node-id-canonical-form.md) — an unpadded id silently duplicates a node and makes every IČO join a false negative; it already severed one ownership chain.
- [Registr smluv needs no token](memory/registr-smluv-token-free-access.md) — per-IČO contract search is open; no structured export, Nette session pagination, aggressive 429s.
- [OR shareholder entries mean *sole* shareholder](memory/or-shareholder-entry-semantics.md) — an a.s. shareholder is registered only when there's one; and those dates are registration, never acquisition, dates.

## Conventions & traps
- [Token + catalog discipline](memory/token-and-catalog-discipline.md) — colors only in `globals.css` tokens (3 declared exceptions); shared catalog is a lint-enforced import boundary. Know these before fighting lint.
- [Rendering gotchas](memory/rendering-gotchas.md) — recharts livelock, SVG float drift, Czech formatting via `lib/format.ts`, SSR==CSR determinism. Four hydration/layout landmines.
- [React state patterns the linter demands](memory/react-state-lint-patterns.md) — `set-state-in-effect` is an error; use `useSyncExternalStore` for localStorage state and rAF/observer callbacks for DOM measurement.
- [The rAF guard / StrictMode trap](memory/raf-guard-strictmode-trap.md) — zero the frame ref on cleanup or the canvas never draws in dev only; plus how to drive Chrome to measure a blank canvas.
- [Prototype rejection ≠ concept rejection; one label engine](memory/prototype-rejection-and-labels.md) — ask which axis a rejected variant failed on before deleting; all canvas text shares one collision queue; verify by eyeballing screenshots at two viewports.
- [Reader-facing loaders need the language gate](memory/reader-facing-loaders-need-the-language-gate.md) — analyst prose ships to Czech readers as English unless the loader imports `lib/analysis/language-gate.ts`; found on three surfaces across three passes. Also: a payload vocabulary mismatch drops every row silently.
- [KG upsert replaces props](memory/kg-upsert-replaces-props.md) — upsertKgNodes/Edges wholesale-replace props; re-running an old ingest erases later passes (140 summaries + 27 verdicts at risk). Backfill merge-preservingly, verify on a copy.
