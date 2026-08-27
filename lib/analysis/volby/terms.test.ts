import { describe, expect, it } from "vitest";
import { inTermWindow, TERM_WINDOWS, termWindow } from "./terms";

describe("TERM_WINDOWS", () => {
  it("has one open window per ballot with a Czech label and a source", () => {
    expect(TERM_WINDOWS.map((t) => t.ballot)).toEqual(["komunalni", "krajske", "snemovni"]);
    for (const t of TERM_WINDOWS) {
      expect(t.to).toBeNull();
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.source).toMatch(/volby/);
      expect(t.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(termWindow("komunalni").from).toBe("2022-10-01");
    expect(termWindow("krajske").from).toBe("2024-10-12");
    expect(termWindow("snemovni").from).toBe("2025-10-04");
  });
});

describe("inTermWindow", () => {
  it("is inclusive at `from` and excludes the day before", () => {
    expect(inTermWindow("krajske", "2024-10-12")).toBe(true);
    expect(inTermWindow("krajske", "2024-10-11")).toBe(false);
    expect(inTermWindow("komunalni", "2022-10-01")).toBe(true);
    expect(inTermWindow("komunalni", "2022-09-30")).toBe(false);
  });
  it("accepts a full ISO stamp by its date prefix", () => {
    expect(inTermWindow("snemovni", "2025-10-04T09:00:00Z")).toBe(true);
    expect(inTermWindow("snemovni", "2025-10-03T23:59:59Z")).toBe(false);
  });
  it("never puts an undated or malformed date inside a window", () => {
    expect(inTermWindow("komunalni", null)).toBe(false);
    expect(inTermWindow("komunalni", undefined)).toBe(false);
    expect(inTermWindow("komunalni", "")).toBe(false);
    expect(inTermWindow("komunalni", "12. 10. 2024")).toBe(false);
  });
});
