import { describe, expect, it } from "vitest";
import { temporalBadge } from "./moneyTypes";

/* The badge is the ONE place a tie's ARES-VR state reads to a viewer. Five edges in the
 * live payloads (batch-006 dataor ×2, the PRaK re-point ×2, one batch-008 live flip) were
 * written `corroboration: registry-confirmed` WITHOUT a `temporal_status`, and until
 * 2026-09-07 the switch's default branch badged them „neověřeno vůči ARES VR“ — a tie the
 * registry confirmed, labelled as never checked. */

describe("temporalBadge", () => {
  it("absent corroboration is 'not checked', never active", () => {
    expect(temporalBadge({ corroboration: null, temporalStatus: null, roleValidTo: null }).tone).toBe("unknown");
  });
  it("conflicting / unconfirmed keep their own tones", () => {
    expect(temporalBadge({ corroboration: "conflicting" }).tone).toBe("warn");
    expect(temporalBadge({ corroboration: "registry-unconfirmed" }).tone).toBe("unknown");
  });
  it("registry-confirmed with a recorded status", () => {
    expect(temporalBadge({ corroboration: "registry-confirmed", temporalStatus: "current" })).toMatchObject({ labelCs: "trvá", tone: "current" });
    expect(temporalBadge({ corroboration: "registry-confirmed", temporalStatus: "money-postdates-role", roleValidTo: "2019-03-01" }).tone).toBe("warn");
    expect(temporalBadge({ corroboration: "registry-confirmed", temporalStatus: "historical-no-money", roleValidTo: "2012-12-13" })).toMatchObject({ labelCs: "ukončeno 2012", tone: "ended" });
  });
  it("registry-confirmed WITHOUT a status reads from the role's end date, never as 'not checked'", () => {
    expect(temporalBadge({ corroboration: "registry-confirmed", temporalStatus: null, roleValidTo: "1999-07-28" })).toMatchObject({ labelCs: "ukončeno 1999", labelEn: "ended 1999", tone: "ended" });
    expect(temporalBadge({ corroboration: "registry-confirmed", temporalStatus: null, roleValidTo: null })).toMatchObject({ labelCs: "trvá", tone: "current" });
    expect(temporalBadge({ corroboration: "registry-confirmed", temporalStatus: "a-word-no-writer-uses", roleValidTo: "2006-05-29" }).tone).toBe("ended");
  });
});
