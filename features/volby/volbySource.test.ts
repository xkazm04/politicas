import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for Volby: zrcadlo (scan-sweep 2026-09-07, volby-election-mirror). */

const src = (p: string) => readFileSync(p, "utf8");

describe("volbyLoader reads the person urn through lib/ingest/changeEvents", () => {
  it("imports pspIdFromNodeId and holds no local psp:person regex", () => {
    const s = src("features/volby/volbyLoader.ts");
    expect(s).toMatch(/import \{ pspIdFromNodeId \} from "@\/lib\/ingest\/changeEvents"/);
    expect(s).not.toMatch(/\^psp:person:/);
  });
});
