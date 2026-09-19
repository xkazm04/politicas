import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FACT_SOURCE_LINKS, SLICE_SOURCE_LINKS } from "./exhibit";

/* Source-grep guards for the velín's loader and exhibit (scan-sweep 2026-09-08, dashboard-instruments). */

const src = (p: string) => readFileSync(p, "utf8");

describe("the velín's build day is the PRAGUE day", () => {
  it("getDashboardData stamps builtOn with pragueDay(), never the UTC day of toISOString()", () => {
    const s = src("features/dashboard/getDashboardData.ts");
    expect(s).toMatch(/import \{ pragueDay \} from "@\/features\/denik\/pragueDay"/);
    expect(s).toMatch(/const builtOn = pragueDay\(\)/);
    expect(s).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });
});

describe("the exhibit's source links cover every source name the book of facts emits", () => {
  // datedFacts.ts (dashboard-state-graph) keeps its registry names as private
  // `SOURCE_*` literals; FACT_SOURCE_LINKS re-types them as keys. A renamed
  // registry on one side would silently strip the link on the other — the
  // footer then prints a bare name. Read the literals, do not re-type them.
  const literals = [...src("features/dashboard/datedFacts.ts").matchAll(/^const SOURCE_\w+ = "([^"]+)";$/gm)].map(
    (m) => m[1],
  );

  it("datedFacts declares its registry names as SOURCE_* literals (the instrument's own precondition)", () => {
    expect(literals.length).toBeGreaterThanOrEqual(3);
  });

  it("every emitted source name has a link", () => {
    for (const name of literals) expect(FACT_SOURCE_LINKS[name], name).toMatch(/^https:\/\//);
  });

  it("a registry named in both link lists points at the same host", () => {
    for (const s of SLICE_SOURCE_LINKS) {
      const fact = FACT_SOURCE_LINKS[s.label];
      if (fact !== undefined) expect(fact, s.label).toBe(s.href);
    }
  });
});
