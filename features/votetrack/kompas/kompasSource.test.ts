import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the kompas (scan-sweep 2026-09-07, votetrack-kompas). */

const src = (p: string) => readFileSync(p, "utf8");

describe("getKompas reads the MP's club as of the Prague day", () => {
  it("imports pragueDay and holds no UTC slice", () => {
    const s = src("features/votetrack/getKompas.ts");
    expect(s).toMatch(/import \{ pragueDay \} from "@\/features\/denik\/pragueDay"/);
    expect(s).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });
});

describe("QuestionCard renders only a KNOWN outcome through the catalog", () => {
  it("accepted/rejected go through voteResult.*; anything else prints as the stored token", () => {
    const s = src("features/votetrack/kompas/QuestionCard.tsx");
    expect(s).toMatch(/KNOWN_OUTCOMES/);
    expect(s).not.toMatch(/q\.outcome === "accepted" \? tcom\("voteResult\.accepted"\) : tcom\("voteResult\.rejected"\)/);
  });
});

describe("KompasPage formats the coverage counts it publishes", () => {
  it("valid / tagged / candidates go through f.int in rulesSource", () => {
    const s = src("features/votetrack/kompas/KompasPage.tsx");
    const block = /source: t\("kompas\.rulesSource", \{[\s\S]*?\}\)/.exec(s)?.[0] ?? "";
    expect(block).toMatch(/valid: f\.int\(data\.coverage\.valid\)/);
    expect(block).toMatch(/tagged: f\.int\(data\.coverage\.tagged\)/);
    expect(block).toMatch(/candidates: f\.int\(data\.coverage\.candidates\)/);
  });
});
