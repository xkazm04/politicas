// Kolizní radar — pins the pure ledger derivation (moonshot 4B): ordering
// (dated newest-first, undated tier with the disclosed rule), dedup across
// payload re-reads, the `#r-<id>` anchor convention, the strip day-grouping,
// and the severity-free / verification framing of the copy.

import { describe, expect, it } from "vitest";
import {
  clusterAnchorOf,
  deriveRadar,
  groupRadarDays,
  radarCitationCs,
  type RadarCollisionInput,
  type RadarFlagInput,
} from "./deriveRadar";

const collision = (over: Partial<RadarCollisionInput>): RadarCollisionInput => ({
  pairId: "120-244",
  billA: 120,
  billB: 244,
  lawRef: "586/1992",
  lawTitle: "zákon o daních z příjmů",
  clusterKey: "586/1992§35ba",
  sharedParagraph: "35ba odst. 1",
  classification: "confirmed-collision",
  detectedAt: "2026-07-24T19:27:59.819Z",
  sourceBatch: 3,
  ...over,
});

const flag = (over: Partial<RadarFlagInput>): RadarFlagInput => ({
  cislo: 77,
  title: "Novela zákona o návykových látkách",
  sponsorMoneyCompanies: 3,
  sponsorContractCzk: 12_500_000,
  ...over,
});

describe("ids and anchors", () => {
  it("collision id encodes the statute+§ locus and the ascending bill pair; anchor is r-<id>", () => {
    const [e] = deriveRadar({ collisions: [collision({ billA: 244, billB: 120 })], flags: [] });
    expect(e.id).toBe("kolize-586-1992-35ba-120-244");
    expect(e.anchor).toBe("r-kolize-586-1992-35ba-120-244");
    expect(e.bills).toEqual([120, 244]);
  });

  it("flag anchor is r-priznak-<cislo> and the cluster anchor matches the cluster-card sanitization", () => {
    const [e] = deriveRadar({ collisions: [], flags: [flag({})] });
    expect(e.anchor).toBe("r-priznak-77");
    expect(clusterAnchorOf("586/1992§35ba")).toBe("k-586-1992-35ba");
  });

  it("all ids are unique across a mixed ledger", () => {
    const entries = deriveRadar({
      collisions: [
        collision({}),
        collision({ clusterKey: "40/2009§88", lawRef: "40/2009", billA: 111, billB: 207, detectedAt: "2026-07-26T00:00:00.000Z" }),
      ],
      flags: [flag({}), flag({ cislo: 12 })],
    });
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});

describe("dedup", () => {
  it("the same locus+pair re-read in a later payload is ONE finding keeping the earliest detectedAt", () => {
    const entries = deriveRadar({
      collisions: [
        collision({ detectedAt: "2026-07-26T00:00:00.000Z", sourceBatch: 8 }),
        collision({ detectedAt: "2026-07-24T19:27:59.819Z", sourceBatch: 3 }),
      ],
      flags: [],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].detectedAt).toBe("2026-07-24T19:27:59.819Z");
    expect(entries[0].sourceCs).toContain("dávka 3");
  });

  it("a dated occurrence always beats an undated one, regardless of input order", () => {
    const a = collision({ detectedAt: null, sourceBatch: 1 });
    const b = collision({ detectedAt: "2026-07-25T00:00:00.000Z", sourceBatch: 5 });
    for (const collisions of [[a, b], [b, a]]) {
      const entries = deriveRadar({ collisions, flags: [] });
      expect(entries).toHaveLength(1);
      expect(entries[0].detectedAt).toBe("2026-07-25T00:00:00.000Z");
    }
  });

  it("the same pairId on a DIFFERENT statute stays two findings (4-121 case)", () => {
    const entries = deriveRadar({
      collisions: [
        collision({ pairId: "4-121", billA: 4, billB: 121, clusterKey: "586/1992§35c" }),
        collision({ pairId: "4-121", billA: 4, billB: 121, clusterKey: "117/1995§30", lawRef: "117/1995" }),
      ],
      flags: [],
    });
    expect(entries).toHaveLength(2);
  });

  it("duplicate flag cisla collapse to one entry", () => {
    const entries = deriveRadar({ collisions: [], flags: [flag({}), flag({})] });
    expect(entries).toHaveLength(1);
  });
});

describe("ordering", () => {
  it("dated newest-first, then undated collisions, then flags by print number — input-order independent", () => {
    const input = {
      collisions: [
        collision({ clusterKey: "40/2009§88", lawRef: "40/2009", billA: 111, billB: 207, detectedAt: "2026-07-26T00:00:00.000Z" }),
        collision({ detectedAt: "2026-07-24T19:27:59.819Z" }),
        collision({ clusterKey: "243/2000§3", lawRef: "243/2000", billA: 28, billB: 140, detectedAt: null }),
      ],
      flags: [flag({ cislo: 120 }), flag({ cislo: 12 })],
    };
    const ids = deriveRadar(input).map((e) => e.id);
    expect(ids).toEqual([
      "kolize-40-2009-88-111-207",
      "kolize-586-1992-35ba-120-244",
      "kolize-243-2000-3-28-140",
      "priznak-12",
      "priznak-120",
    ]);
    const shuffled = deriveRadar({
      collisions: [...input.collisions].reverse(),
      flags: [...input.flags].reverse(),
    }).map((e) => e.id);
    expect(shuffled).toEqual(ids);
  });

  it("equal timestamps tiebreak on id ascending", () => {
    const t = "2026-07-26T00:00:00.000Z";
    const ids = deriveRadar({
      collisions: [
        collision({ clusterKey: "40/2009§88", lawRef: "40/2009", billA: 111, billB: 207, detectedAt: t }),
        collision({ detectedAt: t }),
      ],
      flags: [],
    }).map((e) => e.id);
    expect(ids).toEqual(["kolize-40-2009-88-111-207", "kolize-586-1992-35ba-120-244"]);
  });
});

describe("copy discipline", () => {
  it("collision copy is factual and process-framed, never a verdict", () => {
    const [e] = deriveRadar({ collisions: [collision({})], flags: [] });
    expect(e.titleCs).toBe("tisk 120 × tisk 244 — § 35ba odst. 1, zákon č. 586/1992 Sb.");
    expect(e.detailCs).toContain("Nález legislativního procesu, ne etický nález");
    expect(e.requiresVerification).toBe(false);
  });

  it("flag copy carries the verification sentence and the derived framing", () => {
    const [e] = deriveRadar({ collisions: [], flags: [flag({})] });
    expect(e.detailCs).toContain("vyžaduje lidské ověření");
    expect(e.detailCs).toContain("nejde o zjištěné pochybení");
    expect(e.detailCs).toContain("12,5 mil. Kč");
    expect(e.requiresVerification).toBe(true);
    expect(e.detectedAt).toBeNull();
  });
});

describe("radar strip (day grouping)", () => {
  it("groups dated entries by day newest-first and excludes undated ones", () => {
    const entries = deriveRadar({
      collisions: [
        collision({ detectedAt: "2026-07-24T19:27:59.819Z" }),
        collision({ clusterKey: "40/2009§88", lawRef: "40/2009", billA: 111, billB: 207, detectedAt: "2026-07-24T20:56:05.214Z" }),
        collision({ clusterKey: "243/2000§3", lawRef: "243/2000", billA: 28, billB: 140, detectedAt: "2026-07-26T15:00:00.000Z" }),
      ],
      flags: [flag({})],
    });
    const days = groupRadarDays(entries);
    expect(days).toEqual([
      { day: "2026-07-26", collisions: 1, flags: 0, total: 1 },
      { day: "2026-07-24", collisions: 2, flags: 0, total: 2 },
    ]);
  });
});

describe("citation block", () => {
  it("cites title, framing, source and permalink; undated entries disclose the missing date", () => {
    const [dated] = deriveRadar({ collisions: [collision({})], flags: [] });
    const c = radarCitationCs(dated, "https://politicas.example/zakony/kolize#r-x", "24. 7. 2026");
    expect(c).toContain(dated.titleCs);
    expect(c).toContain("zaznamenáno 24. 7. 2026");
    expect(c).toContain("https://politicas.example/zakony/kolize#r-x");

    const [undated] = deriveRadar({ collisions: [], flags: [flag({})] });
    expect(radarCitationCs(undated, "u", null)).toContain("bez data detekce");
  });
});
