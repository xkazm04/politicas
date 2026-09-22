import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the state-graph components (scan-sweep 2026-09-08, dashboard-state-graph). */

const src = (p: string) => readFileSync(p, "utf8");

describe("the legend's kind order is complete by type", () => {
  it("GraphLegend declares the order as a Record over EVERY StateNodeKind, not a free subset list", () => {
    const s = src("features/dashboard/components/GraphLegend.tsx");
    expect(s).toMatch(/as const satisfies Record<StateNodeKind, number>/);
    expect(s).not.toMatch(/const KIND_ORDER: StateNodeKind\[\] = \[/);
  });
});
