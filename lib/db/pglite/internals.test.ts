// Pure-logic test only — does NOT open PGlite. `limitOf` is the relational
// listers' default cap and the one place their limit clamp lives.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KG_READ_CAP } from "../readCap";
import { limitOf } from "./internals";

describe("limitOf — the relational listers' default is the ONE shared cap (2026-09-08)", () => {
  it("defaults to KG_READ_CAP, honours an explicit limit, and never goes below 1", () => {
    expect(limitOf()).toBe(KG_READ_CAP);
    expect(limitOf({})).toBe(KG_READ_CAP);
    expect(limitOf({ limit: 5 })).toBe(5);
    expect(limitOf({ limit: 0 })).toBe(1);
    expect(limitOf({ limit: -3 })).toBe(1);
  });

  it("internals.ts reads the cap from readCap.ts instead of re-typing its value", () => {
    const s = readFileSync("lib/db/pglite/internals.ts", "utf8");
    expect(s).toMatch(/import \{ KG_READ_CAP \} from "..\/readCap"/);
    expect(s).not.toMatch(/\?\? 1_000_000/);
  });
});
