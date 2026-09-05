import { describe, expect, it } from "vitest";
import { firstParam } from "./searchParam";

/* Next hands a search param as `string | string[] | undefined`. Two routes spelled the same
 * shape guard under a comment naming each other. */
describe("firstParam", () => {
  it.each([
    ["a", "a"],
    [["a", "b"], "a"],
    [[], null],
    [undefined, null],
  ] as const)("%j → %j", (v, out) => {
    expect(firstParam(v as string | string[] | undefined)).toBe(out);
  });
});
