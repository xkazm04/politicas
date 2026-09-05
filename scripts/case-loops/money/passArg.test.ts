import { describe, expect, it } from "vitest";
import { parsePassArg } from "./passArg";

/* persist-contract-harvest.ts promised "--commit requires --pass=<n>" and checked
 * `Number.isFinite(Number(arg ?? 0))` - which is true for a MISSING flag, so a commit without
 * a pass wrote provenance `pass: 0` onto 152 702 nodes. */
describe("parsePassArg", () => {
  it.each([["41", 41], ["1", 1]])("%s → %i", (raw, n) => {
    expect(parsePassArg(raw)).toBe(n);
  });
  it.each([undefined, "", "0", "-1", "4e1", "41.0", "abc", " 41"])("refuses %j", (raw) => {
    expect(parsePassArg(raw)).toBeNull();
  });
});
