import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pspIdFromParam } from "./pspIdParam";

/* The rule "a route's pspId segment is a plain run of digits" - because Number("1e3"),
 * Number("0x10") and Number(" 5") are all integers and would give one MP several addresses -
 * was spelled as `/^\d+$/` in three routes and held together by comments naming each other. */

describe("pspIdFromParam", () => {
  it.each([["6202", 6202], ["1", 1], ["0007", 7]])("%s → %i", (raw, id) => {
    expect(pspIdFromParam(raw)).toBe(id);
  });
  it.each(["1e3", "0x10", " 5", "5 ", "-3", "3.0", "", "abc", "6202/x"])("refuses %j", (raw) => {
    expect(pspIdFromParam(raw)).toBeNull();
  });
});

describe("the money routes read the segment through it", () => {
  it.each(["app/penize/[pspId]/page.tsx", "app/penize/[pspId]/paket/page.tsx"])("%s", (f) => {
    const src = readFileSync(f, "utf8");
    expect(src).toMatch(/import \{ pspIdFromParam \} from "@\/lib\/routing\/pspIdParam"/);
    expect(src).not.toMatch(/\^\\d\+\$/);
  });
});
