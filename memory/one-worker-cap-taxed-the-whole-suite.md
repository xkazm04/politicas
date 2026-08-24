---
name: one-worker-cap-taxed-the-whole-suite
description: The global maxWorkers:3 protected 16 PGlite files and was charged to all 219 — worth 86,6 s; and a PGlite fixture's cost is initdb (~4,1 s), not the DDL (~0,3 s), so a build-once template that is CLOSED before it is copied cuts a store-backed file from ~4,5 s of boot to ~1,0 s.
metadata:
  type: project
---

Measured 2026-08-24 on the 12-CPU / 63,5 GB box, vitest 4.1.11, `@electric-sql/pglite` 0.4.x.

## 1. The cap was right and was charged to the wrong 203 files

`memory/vitest-pglite-needs-tamed-workers.md` is correct: PGlite files flake at
default parallelism and pass at 3. What nobody had measured is what the cap cost
everything else. Only **16 of 219** test files boot a store.

```
the 203 non-PGlite files, maxWorkers 3 ..... 111,8 s wall
the 203 non-PGlite files, maxWorkers 11 ....  25,2 s wall
```

**86,6 s of wall clock, paid by pure-logic files to protect a WASM boot they never
perform.** The same misattribution applied to the timeouts: the 60 s test/hook
budget was a PGlite contention measurement, and charging it to unit tests meant a
genuinely hung unit test hung the gate for a minute instead of failing in five
seconds. Both now live in `vitest.pglite.config.ts` where they were measured;
`vitest.unit.config.ts` runs wide at the 5 s default.

**The rule this generalises to: a taming measured against one class of file must be
scoped to that class, or it becomes a tax with a good story attached.** Before
capping anything globally, count how many files actually need the cap.

## 2. A PGlite fixture's cost is `initdb`, not the DDL

The obvious reading — "every store test re-runs `CORE_DDL`, so cache the DDL" — is
wrong by an order of magnitude. Decomposed:

```
new PGlite(<empty dir>) + waitReady ....... 3 843–4 405 ms   ← initdb. this is the cost.
exec(CORE_DDL) ............................   279–  346 ms
                                            ─────────────
                                              4 122–4 751 ms

cpSync(closed template → fresh dir) .......   727–  865 ms
new PGlite(<provisioned dir>) + waitReady .   210–  397 ms
exec(CORE_DDL) again, every guard hits ....    24–   61 ms   ← re-running it is free
probe query ...............................     8–   22 ms
                                            ─────────────
                                                969–1 219 ms
```

Two consequences. **`open()` in `lib/db/pglite/internals.ts` needed no change** —
re-applying CORE_DDL over a provisioned database costs 24–61 ms because every
`if not exists` short-circuits. And **the fix is to skip `initdb`, not the DDL**:
build one template, close it, and let each file copy it.

## 3. Copying a PGlite store is safe *iff* nothing holds it

`memory/robocopy-of-a-live-pglite-store-can-corrupt.md` says a copy of `.pglite`
taken while another process holds it can abort on every open. That hazard is about
a **live store with a concurrent writer**, and it does not forbid a fixture
template — it dictates how to build one:

- the template is built by one module and by nothing else,
- `await pg.close()` before the path is published (PGlite's clean shutdown IS the
  checkpoint — nothing is in flight when the first copy is taken),
- the closed directory is **reopened and probed with a real query**, and only then
  does a `TEMPLATE_READY` sentinel appear; a directory without that sentinel is a
  crashed build's residue and is deleted, never used,
- no test ever opens the template — every test opens its own copy,
- each copy is compared to the template by file count + byte total at handoff, so a
  torn copy fails at the fixture naming itself rather than as a baffling assertion
  failure deep inside whichever test read the data first.

The template's directory NAME is `sha256(CORE_DDL + pglite version)`, so a DDL
change or a PGlite bump cannot find the old one — which matters here because the
WASM build decides the on-disk `PG_VERSION`
(`memory/pglite-05-ships-postgres-18.md`). Stale-fingerprint templates are reaped
at startup.

## 4. After the fixture, the lane's wall clock is one file

With the boot removed, the PGlite lane stopped being boot-bound and became
**floor-bound on `lib/testing/sentinel/sentinel.test.ts` (22–29 s alone)**. Ordering
files longest-first from measured history took the lane 47,6 s → 40,0 s, and no
further split helps: the floor is that one file. Its cost is real test work over
one memoised connection, not fixture overhead, so it is the product's cost, not the
harness's.

## Result

```
npm run test, before (one flat config, maxWorkers 3, no template) ... 276,7 s
npm run test, after  (unit lane + pglite lane) .......................  70,6 s
```

3,9× — and the tree grew by 8 files / 82 tests between the two measurements
(concurrent sessions), so the figure is understated. Test count is conserved
exactly: the flat fallback config collects 225 files / 3 111 tests and the two
lanes collect 209 + 16 = 225 files and 2 936 + 175 = 3 111 tests, with an empty
intersection. `lib/testing/lane-partition.test.ts` re-proves that on every run and
fails with the offending path named if a store-booting test is ever added to the
wide lane.

**Diagnostic rule unchanged and still primary: a test that fails in the full run
and passes in isolation is contention, not code.**
