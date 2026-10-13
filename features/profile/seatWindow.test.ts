import { describe, expect, it } from "vitest";
import { seatWindow } from "./seatWindow";

const ASOF = Date.parse("2026-10-13T00:00:00.000Z");
const FROM = "2025-10-04T00:00:00.000Z";

// Arm A: the predicate getProfileData carried before this change (verbatim logic).
function armA(toAt: string | null) {
  const toAtMs = toAt ? Date.parse(toAt) : null;
  const toAtUnreadable = toAtMs !== null && !Number.isFinite(toAtMs);
  return { current: !toAt || toAtUnreadable || (toAtMs as number) > ASOF, unreadable: toAtUnreadable };
}

describe("seatWindow", () => {
  it("null end is open; a past end is closed (floor: unchanged vs arm A)", () => {
    for (const to of [null, "2026-03-01T00:00:00.000Z"]) {
      expect(seatWindow(FROM, to, ASOF).current).toBe(armA(to).current);
    }
    expect(seatWindow(FROM, null, ASOF).state).toBe("open");
    expect(seatWindow(FROM, "2026-03-01T00:00:00.000Z", ASOF).state).toBe("closed");
  });

  it("placeholder year-2925 end: arm A calls the seat current, arm B does not and flags it", () => {
    const to = "2925-01-01T00:00:00.000Z";
    expect(armA(to).current).toBe(true);
    const w = seatWindow(FROM, to, ASOF);
    expect(w).toEqual({ state: "unknown", current: false, unreadable: true });
  });

  it("unparseable end: arm A calls it current, arm B unknown", () => {
    expect(armA("garbage").current).toBe(true);
    expect(seatWindow(FROM, "garbage", ASOF).state).toBe("unknown");
  });

  it("end before start is impossible, flagged, not current (arm A: silent past)", () => {
    const to = "2024-01-01T00:00:00.000Z";
    expect(armA(to)).toEqual({ current: false, unreadable: false });
    expect(seatWindow(FROM, to, ASOF)).toEqual({ state: "impossible", current: false, unreadable: true });
  });

  it("a missing start cannot make a window impossible", () => {
    expect(seatWindow(null, "2024-01-01T00:00:00.000Z", ASOF).state).toBe("closed");
  });
});
