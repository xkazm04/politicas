// Shim-equivalence guard for the czech-civic-data extraction (batch 6, 6A).
// lib/ingest/{normalize,unl,zip}.ts are re-export shims over
// packages/czech-civic-data; this test pins two invariants:
//   1. the shim exposes EXACTLY the package's export surface (nothing dropped,
//      nothing added — a rename in the package cannot silently orphan an app
//      import), and
//   2. every runtime export is the SAME binding (Object.is), so there is one
//      implementation, not a drifting copy.
// Plus one behavior smoke check per module through the shim path, proving the
// app-facing imports still parse/fold/read as before the move.
import { describe, expect, it } from "vitest";
import * as pkgNormalize from "../../packages/czech-civic-data/src/normalize";
import * as pkgUnl from "../../packages/czech-civic-data/src/unl";
import * as pkgZip from "../../packages/czech-civic-data/src/zip";
import * as shimNormalize from "./normalize";
import * as shimUnl from "./unl";
import * as shimZip from "./zip";

function expectSameSurface(shim: Record<string, unknown>, pkg: Record<string, unknown>) {
  expect(Object.keys(shim).sort()).toEqual(Object.keys(pkg).sort());
  for (const key of Object.keys(pkg)) {
    expect(Object.is(shim[key], pkg[key]), `export "${key}" must be the same binding`).toBe(true);
  }
}

describe("czech-civic-data shims", () => {
  it("lib/ingest/normalize re-exports the package surface unchanged", () => {
    expectSameSurface(shimNormalize, pkgNormalize);
  });
  it("lib/ingest/unl re-exports the package surface unchanged", () => {
    expectSameSurface(shimUnl, pkgUnl);
  });
  it("lib/ingest/zip re-exports the package surface unchanged", () => {
    expectSameSurface(shimZip, pkgZip);
  });

  it("behaves identically through the shim path (smoke)", () => {
    expect(shimNormalize.asciiFold("Nováková")).toBe("novakova");
    expect(shimNormalize.voteChoice("K")).toBe("abstain_or_not_voting");
    expect(shimUnl.parseUnlLine("86327|Zákon \\| 2. čtení|A|")).toEqual([
      "86327",
      "Zákon | 2. čtení",
      "A",
    ]);
    expect(() => shimZip.readZip(new Uint8Array([1, 2, 3]))).toThrow(/not a ZIP/);
  });
});
