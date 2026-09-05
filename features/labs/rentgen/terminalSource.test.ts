import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Guards for the rentgen terminal (scan-sweep 2026-09-07, shell-navigation): the terminal
 * is a press product over the money module's data, so it speaks that module's vocabulary
 * and dates itself on the same calendar as every other loader. */

const src = (p: string) => readFileSync(p, "utf8");

describe("getTerminalData dates its retrieval on the Prague day", () => {
  it("imports pragueDay and holds no UTC slice", () => {
    const s = src("features/labs/rentgen/getTerminalData.ts");
    expect(s).toMatch(/import \{ pragueDay \} from "@\/features\/denik\/pragueDay"/);
    expect(s).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });
});

describe("the terminal speaks the money module's review vocabulary", () => {
  it("terminalModel aliases ReviewState and TieClass instead of respelling them", () => {
    const s = src("features/labs/rentgen/terminalModel.ts");
    expect(s).toMatch(/export type TerminalReviewState = ReviewState;/);
    expect(s).toMatch(/export type TerminalTieClass = TieClass;/);
  });
  it("getTerminalData classifies a change payload through reviewStateOf", () => {
    const s = src("features/labs/rentgen/getTerminalData.ts");
    expect(s).toMatch(/reviewStateOf\(e\.payload\.review_state\) !== "verified"/);
  });
});
