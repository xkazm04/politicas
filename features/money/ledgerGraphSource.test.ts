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

describe("loadMpMoneySlice dates its plausibility bound in Prague", () => {
  const s = src("features/money/moneyLoader.ts");
  it("calls pragueDay() and no longer slices the UTC ISO string", () => {
    expect(s).toMatch(/import \{ pragueDay \} from "@\/features\/denik\/pragueDay"/);
    expect(s).toMatch(/const datesCheckedOn = pragueDay\(\)/);
    expect(s).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });
});

describe("company id → IČO goes through companyId.icoFromCompanyNodeId", () => {
  it.each(["features/money/moneyLoader.ts", "features/money/MoneyGraph.tsx"])("%s carries no tail-of-id read", (f) => {
    const s = src(f);
    expect(s).toMatch(/icoFromCompanyNodeId/);
    expect(s).not.toMatch(/\.id\.split\(":"\)\.pop\(\)/);
  });
});

describe("TiesLedger: the search field has an accessible name (placeholder is not one)", () => {
  it("the type=search input carries aria-label", () => {
    const s = src("features/money/components/TiesLedger.tsx");
    expect(s).toMatch(/type="search"[\s\S]{0,400}aria-label=\{t\("real\.ledger\.searchPlaceholder"\)\}/);
  });
});
