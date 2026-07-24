# A/B — analyst context WITH vs WITHOUT the DataHub Lite metalayer (2026-07-24)

Does routing the data-analysis loop's context through the **DataHub Lite** catalog change
what the analyst reads, versus assembling that context locally? This is the hackathon's
core question, run against Politicas's real corpus. Wrapper: `lib/analysis/context-provider.ts`
(`DirectContextProvider` = WITHOUT Lite; `LiteContextProvider` = WITH Lite). Runner:
`scripts/data-analysis/ab-datahub.ts`.

## Method

| | Arm A — WITHOUT Lite (`--mode=direct`) | Arm B — WITH Lite (`--mode=lite`) |
| --- | --- | --- |
| Context source | assembled locally from `context-model` + the deterministic slice stats | read back from the DataHub catalog (GMS OpenAPI) |
| Slices | 8 real slices from the live graph (`slice-stats.ts`): psp-hlasovani×PSP10×{absence, vote_ballot (406k), vote_event}, psp-poslanci×{all×person (7045), all×organ, PSP10×mandate, PSP10×membership}, pumper-psp-opendata×all×source_release | identical |
| Comparison | canonical (key-sorted) JSON of the full `SliceContext`, `contextSource` label excluded | same |

The Lite arm's GMS is **simulated in-process** from the exact aspects `datahub-sync.ts`
would publish — legitimate because publisher and reader draw from the SAME
`lib/analysis/context-model` (a live GMS round-trip is deterministic and separately unit-
tested by the 6-case parity test in `context-provider.test.ts`). No heavy DataHub container
is needed to measure fidelity.

## Result

```
slices: 8 · content-identical: 8 · differing: 0
```

Every slice's context — documentation (source known-issues + corpus rules + coverage),
the 13-field scoring rubric, the deterministic stats, upstream provenance, and the
sibling-slice coverage map — is **byte-identical** across the two arms.

## Verdict

**DataHub Lite is content-transparent.** The analyst reads the same context with or without
the metalayer, so the analysis-quality delta is **zero by construction** — both arms source
the one `context-model`. The metalayer therefore earns its keep as a **delivery mechanism**
(a queryable, portable catalog the orchestrator need not hand-carry; coverage state stops
being something a human keeps in sync), **not** as an analysis-quality uplift.

This is the honest reading, and it is deliberately different from the earlier **Grant A/B**
(`docs` in the sibling repo), where the catalog arm beat the vault arm **3.3×** on rubric
conformance. That gap existed because Grant's *naive prompt lacked the rubric definitions*
the catalog carried. Here the **direct arm carries the same rubric** (via `context-model`),
so the gap is closed on both sides — which is why Lite shows no uplift over a properly-built
local arm. Engineering the parity is what makes the measurement trustworthy: any delta would
have been an artifact of one arm knowing less, not of the metalayer itself.

**Hackathon claim (honest, both-true):** the pipeline is *built on DataHub Lite* — the
`LiteContextProvider` is a first-class arm and the loop runs through it — **and** we
*measured* it to be a faithful, content-transparent delivery layer rather than overclaiming
an uplift it does not produce.

## Transport-level confirmation (live, 2026-07-24)

The result above was first produced against an in-process catalog simulation (mocked
`fetch`). It was then **re-confirmed over real HTTP**: `scripts/data-analysis/lite-serve.ts`
stands up a lightweight, read-only DataHub-OpenAPI-v3 catalog (functionally DataHub Lite —
the same aspects `datahub-sync` publishes, served from `context-model`), and
`ab-datahub.ts --gms=http://localhost:8090` runs the **real** `LiteContextProvider` (actual
global `fetch`, real network) against it:

```
DataHub-Lite A/B — 8 real slices · WITHOUT-Lite (direct) vs WITH-Lite (LIVE http://localhost:8090, real HTTP transport)
slices: 8 · content-identical: 8 · differing: 0
```

So the whole path — real fetch → live HTTP server → JSON parse → `SliceContext` — is
byte-identical to the local arm. (Acryl's `datahub-lite` pip package does not install on
this box's Python 3.14 — `pydantic-core` has no 3.14 wheel and there is no Rust toolchain —
and the full multi-container GMS is the heavy path we avoid; `lite-serve.ts` is the
equivalent lightweight, embeddable, read-only catalog for this confirmation. A production
deploy would run acryl DataHub Lite on a supported Python.)

## Limitations — read before generalizing

- The live catalog is `lite-serve.ts` (a compatible OpenAPI-v3 read server), not the acryl
  `datahub-lite` package (un-installable here on Python 3.14). It exercises the real
  `LiteContextProvider` transport and content mapping end-to-end; only the serving
  implementation differs from the shipped product.
- Parity is a *property we engineered* (shared `context-model`), not luck — the value of the
  A/B is confirming we achieved it on real data, and documenting what Lite does and does not buy.
- 8 slices, one corpus. The conclusion (content-transparency) is structural, not statistical,
  so it holds regardless of slice count — but the *delivery-mechanism* benefits (discoverability,
  portability, coverage-state-as-data) grow with corpus size and are not captured by this diff.
