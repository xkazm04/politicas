import { describe, expect, it } from "vitest";
import { isCzechSafe } from "@/lib/analysis/language-gate";
import {
  hasStaleOngoingFlag,
  KNOWN_TIE_FLAGS,
  STALE_ONGOING_FLAG,
  tieFlagInfo,
  tieFlagInfos,
} from "./tieFlags";

/**
 * Every distinct `flags` token carried by the 211 `linked_to` edges of the live
 * knowledge graph, measured 2026-08-04 (counts in comments). 82 of the 211 ties
 * carry at least one flag; before this module every one of these tokens was
 * rendered VERBATIM to a public reader on /penize/[pspId].
 */
const LIVE_GRAPH_FLAGS: readonly string[] = [
  "stale-ongoing-in-graph", // 42
  "dataor-checked-not-isvr-registered", // 9
  "sonnet-reviewed", // 7
  "dataor-ico-not-in-dataset", // 6
  "clean-handoff-not-revolving-door", // 4
  "dataor-closed", // 4
  "dataor-fetch-incomplete", // 4
  "no-birthdate-match-in-vr", // 3
  "vr-missing-dob-on-old-record", // 3
  "approximate-dates-no-day-precision", // 3
  "dataor-court-form-unresolved", // 3
  "dataor-no-match-some-officers-birthdate-null", // 3
  "prak-repoint-batch006", // 2
  "undisclosed-asset-declaration-lead", // 1
  "dataor-no-match", // 1
  "dataor-dataset-not-found", // 1
  "q-money-15-live-flip", // 1
  "q-money-21-contract-window", // 1
  "opus-verified", // 1
];

describe("tieFlags — the flag dictionary", () => {
  it("translates every flag token the live graph actually carries", () => {
    const missing = LIVE_GRAPH_FLAGS.filter((t) => !tieFlagInfo(t).known);
    expect(missing).toEqual([]);
  });

  it("writes Czech copy for every known flag (language gate)", () => {
    for (const token of KNOWN_TIE_FLAGS) {
      const info = tieFlagInfo(token);
      expect(info.labelCs.length, token).toBeGreaterThan(0);
      expect(info.labelEn.length, token).toBeGreaterThan(0);
      expect(info.noteEn.length, token).toBeGreaterThan(0);
      // The note is the reader-facing sentence — it must not read as English on a
      // Czech-first surface (lib/analysis/language-gate.ts).
      expect(isCzechSafe(info.noteCs), `${token}: noteCs`).toBe(true);
    }
  });

  it("never renders a machine token as an established human verdict", () => {
    // Two flags record that a LANGUAGE MODEL looked at the tie. The human gate is
    // the only thing that may read as "verified", so the copy must say so itself.
    for (const token of ["sonnet-reviewed", "opus-verified"]) {
      const info = tieFlagInfo(token);
      expect(info.noteCs).toMatch(/(nenahrazuje|strojová)/);
    }
  });

  it("degrades an unmapped token honestly — verbatim, labelled, never hidden", () => {
    const info = tieFlagInfo("some-future-batch-token");
    expect(info.known).toBe(false);
    expect(info.token).toBe("some-future-batch-token");
    expect(info.labelCs).toBe("some-future-batch-token"); // shown, not swallowed
    expect(info.tone).toBe("machine");
    expect(info.noteCs.length).toBeGreaterThan(0);
  });

  it("keeps an empty token representable rather than crashing or vanishing", () => {
    const info = tieFlagInfo("   ");
    expect(info.known).toBe(false);
    expect(info.labelCs).toBe("(prázdný příznak)");
  });

  it("deduplicates and preserves the edge's own flag order", () => {
    const infos = tieFlagInfos(["dataor-closed", STALE_ONGOING_FLAG, "dataor-closed"]);
    expect(infos.map((i) => i.token)).toEqual(["dataor-closed", STALE_ONGOING_FLAG]);
  });

  it("returns nothing for an absent flags array", () => {
    expect(tieFlagInfos(null)).toEqual([]);
    expect(tieFlagInfos(undefined)).toEqual([]);
    expect(tieFlagInfos([])).toEqual([]);
  });

  it("detects the stale-ongoing flag — the console's staleness prompt hinge", () => {
    expect(hasStaleOngoingFlag([STALE_ONGOING_FLAG])).toBe(true);
    expect(hasStaleOngoingFlag([` ${STALE_ONGOING_FLAG} `])).toBe(true);
    expect(hasStaleOngoingFlag(["dataor-closed"])).toBe(false);
    expect(hasStaleOngoingFlag(null)).toBe(false);
  });
});
