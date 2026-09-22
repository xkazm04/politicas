import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tieClassInfo } from "@/features/money/moneyTypes";
import { deriveTerminalLedger, type TerminalTieLike } from "./terminalModel";

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

// The fixture is only as wide as the model needs; deriveTerminalLedger reads every field.
const tieOf = (cls: TerminalTieLike["tieClass"]): TerminalTieLike => ({
  srcId: "psp:person:1",
  dstId: "company:ico:00000001",
  pspId: 1,
  mpName: "A",
  club: null,
  ico: "00000001",
  company: "F",
  role: "r",
  reviewState: "verified",
  tieClass: cls,
  contractCount: 1,
  contractCzk: 100,
  subsidiesCzk: 0,
  source: "s",
});

describe("tie-class labels come from tieClassInfo, the P29 single source of that copy", () => {
  it("each ledger row carries the money module's Czech label, byte for byte", () => {
    for (const cls of ["owner-operator", "manager", "steward"] as const) {
      expect(deriveTerminalLedger([tieOf(cls)])[0].tieClassCs, cls).toBe(tieClassInfo(cls).labelCs);
    }
  });
});
