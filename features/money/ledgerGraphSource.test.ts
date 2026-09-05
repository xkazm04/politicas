import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the /penize ledger and its loader (scan-sweep 2026-09-07,
 * money-ledger-graph). moneyLoader.ts is `server-only` and cannot be imported here; what
 * CAN be pinned is that it reads through the repo's shared definitions instead of copies. */

const src = (p: string) => readFileSync(p, "utf8");

describe("moneyLoader.ts reads ids and states through the shared definitions", () => {
  const s = src("features/money/moneyLoader.ts");
  it("re-exports the strict pspIdFromNodeId instead of a last-segment copy", () => {
    expect(s).toMatch(/export \{ pspIdFromNodeId \} from "@\/lib\/ingest\/changeEvents"/);
    expect(s).not.toMatch(/function pspIdFromNodeId/);
  });
});

describe("moneyLoader.ts narrows review_state through reviewStateOf", () => {
  const s = src("features/money/moneyLoader.ts");
  it("imports the shared vocabulary and carries no hand-spelled ternary", () => {
    expect(s).toMatch(/import \{[^}]*\breviewStateOf\b[^}]*\} from "\.\/reviewTypes"/);
    expect(s).not.toMatch(/rawState === "verified" \?/);
  });
});
