// The sentinel runner's header describes the unevaluable report — it must not
// hard-code how many checks that report carries (source grep; the count lives in
// SENTINEL_CHECK_ORDER and has already moved once, 16 → 18, while the header
// kept saying sixteen).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SENTINEL_CHECK_ORDER } from "@/lib/testing/sentinel/invariants";

const SRC = readFileSync("scripts/sentinel/run.ts", "utf8");

describe("sentinel runner header (2026-09-06, documentation-auditor)", () => {
  it("names the check list by its symbol instead of a literal count", () => {
    expect(SRC).not.toMatch(/\b(sixteen|eighteen|1[0-9]) (rows|checks|invariants)\b/i);
    expect(SRC).not.toMatch(/0 of 1[0-9] invariants/);
    expect(SRC).toContain("SENTINEL_CHECK_ORDER");
  });

  it("the list it refers to is the one the report is built from", () => {
    expect(SENTINEL_CHECK_ORDER.length).toBeGreaterThan(0);
  });
});
