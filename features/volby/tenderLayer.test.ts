// Pure tests over `foldTenderLayer` — the fold behind every /volby figure. No store boot:
// the rows are the shapes the persist scripts write (scripts/case-loops/tender/*), and the
// assertions are the invariants a reader relies on: an authority's arena is the registry's
// before it is the declared one, dependence is wins-here over wins-everywhere, a lot with
// several winners keeps the earliest dated one, and the CZK figure is a floor over priced
// wins only. The memoised store read is covered in loaders.test.ts (one boot).

import { describe, expect, it } from "vitest";

import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";
import { foldTenderLayer } from "./tenderLayer";

const node = (id: string, kind: string, props: Record<string, unknown>, label = id): KgNodeRow => ({
  id,
  kind,
  label,
  props,
  firstSeenPass: 70,
  provenance: {},
});
const edge = (src: string, rel: string, dst: string, props: Record<string, unknown> = {}, weight: number | null = null): KgEdgeRow =>
  ({ src, rel, dst, weight, props, provenance: {} }) as KgEdgeRow;

const OBEC = "00297488"; // declared krajske by the RVZ category — a registry obec
const KRAJ = "70890692";
const STATE = "00000175";
const W1 = "11111111";
const W2 = "22222222";

const companies = [
  node(`company:ico:${OBEC}`, "company", {
    electoral_arena: "krajske",
    tender_authority_category: "Příspěvková organizace kraje",
    arena_provenance: { pass: 74 },
    tender_winner_circle: { circle3_share: 0.9, switch_rate: 0.1, dated_wins: 12, circle3: [{ ico: W1, name: "W1", wins: 11 }] },
  }, "statutární město Havířov"),
  node(`company:ico:${KRAJ}`, "company", { electoral_arena: "statni", arena_provenance: { pass: 74 } }, "Moravskoslezský kraj"),
  node(`company:ico:${STATE}`, "company", { electoral_arena: "statni" }),
  node(`company:ico:${W1}`, "company", { ico: W1 }), // a winner: no arena, no circle → not an authority
];
const tenders = [
  node("tender:A/1", "tender", { authority_ico: OBEC, flags: ["short_deadline"], flags_provenance: { pass: 72 }, ended_on: "2025-01-05T00:00:00" }),
  node("tender:A/2", "tender", { authority_ico: OBEC, ended_on: null }),
  node("tender:K/1", "tender", { authority_ico: KRAJ, flags: ["single_bid"], flags_provenance: { pass: 72 } }),
  node("tender:S/1", "tender", { authority_ico: STATE }),
  node("tender:X/1", "tender", { authority_ico: "99999999" }), // authority without a node
  node("tender:N/1", "tender", {}), // no authority at all
];
const procures = [
  edge(`company:ico:${OBEC}`, "procures", "tender:A/1"),
  edge(`company:ico:${OBEC}`, "procures", "tender:A/2"),
  edge(`company:ico:${KRAJ}`, "procures", "tender:K/1"),
  edge(`company:ico:${STATE}`, "procures", "tender:S/1"),
  edge("company:ico:99999999", "procures", "tender:X/1"),
];
const wins = [
  edge(`company:ico:${W1}`, "wins", "tender:A/1", { price_czk: 1000, decided_on: "2025-02-01T10:00:00" }, 1000),
  // two winners on A/2: the earlier dated one is the lot's winner; both prices count toward the floor
  edge(`company:ico:${W2}`, "wins", "tender:A/2", { price_czk: 500, decided_on: "2025-03-01" }, 500),
  edge(`company:ico:${W1}`, "wins", "tender:A/2", { price_czk: 250, decided_on: "2025-02-15" }, 250),
  edge(`company:ico:${W1}`, "wins", "tender:K/1", { price_czk: null, decided_on: null }),
  edge(`company:ico:${W2}`, "wins", "tender:S/1", { price_czk: 7, decided_on: "2025-04-04" }, 7),
];
const registryArena = (ico: string) => (ico === OBEC ? ("komunalni" as const) : ico === KRAJ ? ("krajske" as const) : null);

describe("foldTenderLayer", () => {
  const layer = foldTenderLayer(tenders, procures, wins, companies, 0, false, registryArena);

  it("keeps only authority nodes and corrects their arena from the registry, keeping the declared one", () => {
    expect([...layer.authorities.keys()].sort()).toEqual([STATE, OBEC, KRAJ].sort());
    const obec = layer.authorities.get(OBEC)!;
    expect(obec.arena).toBe("komunalni");
    expect(obec.arenaDeclared).toBe("krajske");
    expect(layer.authorities.get(KRAJ)!.arena).toBe("krajske");
    expect(layer.authorities.get(STATE)!.arena).toBe("statni");
    expect(layer.provenance.counts.arenaCorrectedByRegistry).toBe(2);
    expect(layer.provenance.arenaPass).toBe(74);
    expect(layer.provenance.flagsPass).toBe(72);
    expect(layer.provenance.pass).toBe(74);
  });

  it("folds lots with the wins edge's decided_on, the node's ended_on, flags and the earliest dated winner", () => {
    const lots = layer.authorities.get(OBEC)!.lots;
    expect(lots.map((l) => l.id)).toEqual(["tender:A/1", "tender:A/2"]);
    expect(lots[0]).toEqual({ id: "tender:A/1", decidedOn: "2025-02-01", endedOn: "2025-01-05", flags: ["short_deadline"], winnerIco: W1 });
    expect(lots[1]).toEqual({ id: "tender:A/2", decidedOn: "2025-02-15", endedOn: null, flags: [], winnerIco: W1 });
    expect(layer.provenance.counts.multiWinnerLots).toBe(1);
    // an undated win keeps the lot undated — never guessed
    expect(layer.authorities.get(KRAJ)!.lots[0].decidedOn).toBeNull();
  });

  it("counts wins per authority and per winner so dependence = here / everywhere", () => {
    expect(layer.authorities.get(OBEC)!.winCounts).toEqual({ [W1]: 2, [W2]: 1 });
    expect(layer.winnerTotals.get(W1)).toBe(3);
    expect(layer.winnerTotals.get(W2)).toBe(2);
    expect(layer.authorities.get(OBEC)!.circle).toEqual({
      circle3_share: 0.9,
      switch_rate: 0.1,
      dated_wins: 12,
      circle3: [{ ico: W1, name: "W1", wins: 11 }],
    });
  });

  it("builds the census over corrected arenas, a CZK floor over priced wins, and discloses the unmapped", () => {
    const by = Object.fromEntries(layer.census.map((c) => [c.arena, c]));
    expect(by.komunalni).toEqual({ arena: "komunalni", authorities: 1, lots: 2, flaggedShare: 0.5, czkFloor: 1750 });
    expect(by.krajske).toEqual({ arena: "krajske", authorities: 1, lots: 1, flaggedShare: 1, czkFloor: 0 });
    expect(by.statni).toEqual({ arena: "statni", authorities: 1, lots: 1, flaggedShare: 0, czkFloor: 7 });
    expect(by.nejasne).toEqual({ arena: "nejasne", authorities: 0, lots: 0, flaggedShare: 0, czkFloor: 0 });
    expect(layer.baselines.komunalni.shortDeadlineShare).toBe(0.5);
    expect(layer.baselines.komunalni.source).toBe("claim:volby-census:flagged-share:komunalni");
    expect(layer.provenance.counts).toMatchObject({ lotsNoAuthority: 1, lotsUnmappedAuthority: 1, pricedWins: 4, procuresFallback: 0 });
    expect(layer.provenance.czkFloorBasis).toContain("4 z 5 výher");
  });

  it("falls back to the node's authority_ico when a tender has no procures edge", () => {
    const l = foldTenderLayer(tenders, [], wins, companies, 0, false, registryArena);
    expect(l.provenance.counts.procuresFallback).toBe(5);
    expect(l.authorities.get(OBEC)!.lots).toHaveLength(2);
  });

  it("an empty corpus is an empty layer with a zero census, not a throw", () => {
    const l = foldTenderLayer([], [], [], [], 0, false);
    expect(l.authorities.size).toBe(0);
    expect(l.census.map((c) => c.lots)).toEqual([0, 0, 0, 0]);
    expect(l.provenance.pass).toBeNull();
  });
});
