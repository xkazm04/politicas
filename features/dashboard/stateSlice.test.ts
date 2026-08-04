// Invarianty REÁLNÉHO výřezu. Jsou to TYTÉŽ invarianty, které
// lib/civic/stateGraph.test.ts drží nad vzorkovým builderem — plus pravidla,
// která platí jen pro reálná data (přisouzení peněz, čárkovaná neověřená vazba,
// odkazy vedoucí na skutečné pspId / tisk).
//
// Vstup je záměrně ruční fixture, ne dotaz do grafu: test má hlídat PRAVIDLO
// výběru, ne dnešní obsah databáze (ten se mění každou ingescí).

import { describe, expect, it } from "vitest";
import {
  buildStateSlice,
  sliceBillId,
  sliceCompanyId,
  sliceLawId,
  sliceMoneyId,
  slicePartyId,
  slicePersonId,
  SLICE_SEEDS,
  type SliceInput,
  type SliceMp,
  type SliceTie,
} from "./stateSlice";

const tie = (over: Partial<SliceTie> & { ico: string }): SliceTie => ({
  companyId: `company:ico:${over.ico}`,
  company: `Firma ${over.ico}`,
  role: "jednatel",
  tieClass: "owner-operator",
  reviewState: "pending_review",
  contractCzk: 1_000_000,
  contractCount: 4,
  donatedToPartyCzk: null,
  donationRecipientParty: null,
  ...over,
});

const mp = (pspId: number, name: string, ties: SliceTie[]): SliceMp => ({ pspId, name, ties });

/** Šest poslanců, z toho pět s tiskem — pořadí podle mandátu je záměrně jiné
 *  než pořadí v poli, aby test chytil řazení, ne náhodu. */
function fixture(): SliceInput {
  return {
    chamberTotal: 207,
    mps: [
      mp(900, "Devátá Devítka", [tie({ ico: "00000900" })]),
      mp(100, "Stovka Stovková", [tie({ ico: "00000100" })]),
      mp(300, "Trojka Trojková", [
        // steward → peníze se nekreslí, i když jsou velké
        tie({ ico: "00000301", tieClass: "steward", contractCzk: 9_000_000_000 }),
      ]),
      mp(200, "Dvojka Dvojková", [
        tie({ ico: "00000299", contractCzk: 0, contractCount: 0 }), // bez peněz → bez uzlu peněz
        tie({ ico: "00000201", tieClass: "manager", contractCzk: 5_000_000 }),
      ]),
      mp(700, "Sedmá Dárkyně", [
        tie({ ico: "00000700", donatedToPartyCzk: 50_000, donationRecipientParty: "KDU-ČSL" }),
      ]),
      mp(800, "Osmý Bezvazbý", []),
    ],
    bills: [
      {
        cislo: 50,
        title: "Návrh na změnu zákona o DPH",
        sponsors: [{ pspId: 100, name: "Stovka Stovková" }],
        amendedLaws: [
          { urn: "law:sb:586-1992", ref: "586/1992", label: "z. 586/1992", title: "o daních z příjmů" },
          { urn: "law:sb:90-1995", ref: "90/1995", label: "z. 90/1995", title: null },
        ],
      },
      {
        cislo: 20,
        title: "Starší návrh téhož poslance",
        sponsors: [{ pspId: 100, name: "Stovka Stovková" }],
        amendedLaws: [{ urn: "law:sb:111-2006", ref: "111/2006", label: "z. 111/2006", title: null }],
      },
      {
        cislo: 60,
        title: "Společný návrh",
        sponsors: [
          { pspId: 200, name: "Dvojka Dvojková" },
          { pspId: 300, name: "Trojka Trojková" },
        ],
        amendedLaws: [{ urn: "law:sb:114-1992", ref: "114/1992", label: "z. 114/1992", title: null }],
      },
      {
        // bez novelizovaného zákona → do populace se nepočítá
        cislo: 70,
        title: "Návrh, který nic nenovelizuje",
        sponsors: [{ pspId: 900, name: "Devátá Devítka" }],
        amendedLaws: [],
      },
    ],
  };
}

const build = () => {
  const s = buildStateSlice(fixture());
  if (!s) throw new Error("fixture must produce a slice");
  return s;
};

describe("buildStateSlice — pravidlo výběru", () => {
  it("sází semena podle ČÍSLA MANDÁTU vzestupně, ne podle peněz ani pořadí ve vstupu", () => {
    const { graph, rule } = build();
    expect(rule.seeds).toBe(SLICE_SEEDS);
    // 100, 200, 300 mají vazbu i novelizující tisk; 900 tisk bez novely, 800 bez vazby.
    expect(rule.dualBandTotal).toBe(3);
    expect(graph.nodes.some((n) => n.id === slicePersonId(100))).toBe(true);
    expect(graph.nodes.some((n) => n.id === slicePersonId(200))).toBe(true);
    expect(graph.nodes.some((n) => n.id === slicePersonId(300))).toBe(true);
    expect(graph.nodes.some((n) => n.id === slicePersonId(900))).toBe(false);
    // 700 je uvnitř JEN kvůli dárcovské firmě — a je až za semeny.
    const order = graph.nodes.filter((n) => n.kind === "person").map((n) => n.id);
    expect(order).toEqual([slicePersonId(100), slicePersonId(200), slicePersonId(300), slicePersonId(700)]);
  });

  it("bere první firmu podle IČO, první tisk podle čísla a první zákon podle předpisu", () => {
    const { graph } = build();
    // 200 má IČO 00000201 a 00000299 → vyhrává 201.
    expect(graph.nodes.some((n) => n.id === sliceCompanyId("00000201"))).toBe(true);
    expect(graph.nodes.some((n) => n.id === sliceCompanyId("00000299"))).toBe(false);
    // 100 má tisky 20 a 50 → vyhrává 20.
    expect(graph.nodes.some((n) => n.id === sliceBillId(20))).toBe(true);
    expect(graph.nodes.some((n) => n.id === sliceBillId(50))).toBe(false);
    // tisk 60 novelizuje jediný zákon; tisk 20 taky. Nejnižší předpis u tisku 50
    // by byl 90/1995 — ověřeno přes lawKey (rok, pak číslo).
    expect(graph.nodes.some((n) => n.id === sliceLawId("law:sb:111-2006"))).toBe(true);
  });

  it("jeden tisk dvou předkladatelů je jeden uzel a dvě hrany", () => {
    const { graph } = build();
    const sponsorEdges = graph.edges.filter((e) => e.to === sliceBillId(60) && e.rel === "sponsors");
    expect(sponsorEdges.map((e) => e.from).sort()).toEqual([slicePersonId(200), slicePersonId(300)].sort());
    expect(graph.nodes.filter((n) => n.id === sliceBillId(60))).toHaveLength(1);
  });
});

describe("buildStateSlice — přisouzení peněz (pravidlo /penize)", () => {
  it("steward vazba nikdy nedostane uzel peněz, i když jsou to miliardy", () => {
    const { graph, rule } = build();
    expect(graph.nodes.some((n) => n.id === sliceCompanyId("00000301"))).toBe(false);
    expect(graph.nodes.some((n) => n.id === sliceMoneyId("00000301"))).toBe(false);
    // 300 má jen steward vazbu → v peněžním pruhu nemá nic, a plocha to řekne.
    expect(rule.stewardOnlySeeds).toBe(1);
  });

  it("dárcovská firma se kreslí kvůli daru; peníze dostane jen když je vazba přisouditelná", () => {
    const { graph, rule } = build();
    expect(rule.donorCompanies).toBe(1);
    expect(graph.nodes.some((n) => n.id === slicePartyId("KDU-ČSL"))).toBe(true);
    const donor = graph.edges.find((e) => e.rel === "donor");
    expect(donor?.from).toBe(sliceCompanyId("00000700"));
    expect(donor?.czk).toBe(50_000);
  });

  it("firma bez smluv nedostane uzel peněz", () => {
    const { graph } = build();
    expect(graph.nodes.some((n) => n.id === sliceMoneyId("00000299"))).toBe(false);
  });
});

describe("buildStateSlice — invarianty společné se vzorkovým grafem", () => {
  it("žádná hrana nevisí do prázdna a id uzlů se neopakují", () => {
    const { graph } = build();
    const ids = new Set(graph.nodes.map((n) => n.id));
    expect(ids.size).toBe(graph.nodes.length);
    for (const e of graph.edges) {
      expect(ids.has(e.from), `${e.from} -> ${e.to}`).toBe(true);
      expect(ids.has(e.to), `${e.from} -> ${e.to}`).toBe(true);
    }
  });

  it("souřadnice jsou v rozsahu 0..100 a zaokrouhlené na 2 desetinná místa", () => {
    const { graph } = build();
    for (const n of graph.nodes) {
      expect(n.x, n.id).toBeGreaterThanOrEqual(0);
      expect(n.x, n.id).toBeLessThanOrEqual(100);
      expect(n.y, n.id).toBeGreaterThanOrEqual(0);
      expect(n.y, n.id).toBeLessThanOrEqual(100);
      expect(n.x, n.id).toBe(Math.round(n.x * 100) / 100);
      expect(n.y, n.id).toBe(Math.round(n.y * 100) / 100);
    }
  });

  it("je deterministický — dvě sestavení téhož vstupu dají totéž", () => {
    expect(JSON.stringify(buildStateSlice(fixture()))).toBe(JSON.stringify(buildStateSlice(fixture())));
  });

  it("neověřená vazba je verified:false (kreslí se čárkovaně) a uzel nese pending", () => {
    const { graph, rule } = build();
    const tieEdges = graph.edges.filter((e) => e.rel === "tie");
    expect(tieEdges.length).toBeGreaterThan(0);
    expect(tieEdges.every((e) => e.verified === false)).toBe(true);
    expect(graph.nodes.filter((n) => n.kind === "company").every((n) => n.pending === true)).toBe(true);
    expect(rule.pendingTies).toBe(rule.tiesDrawn);
  });

  it("odkazy vedou na reálné cíle — pspId, číslo tisku, spis firmy", () => {
    const { graph } = build();
    const person = graph.nodes.find((n) => n.id === slicePersonId(100))!;
    expect(person.href).toBe("/poslanec/100");
    expect(graph.nodes.find((n) => n.id === sliceBillId(20))!.href).toBe("/zakony/20");
    // Firma vede na SVŮJ spis, ne na spis prvního navázaného poslance: 14 firem
    // v grafu je navázaných na víc poslanců a u nich by ten odkaz lhal.
    expect(graph.nodes.find((n) => n.id === sliceCompanyId("00000100"))!.href).toBe(
      "/penize/firma/00000100",
    );
    // Uzel peněz zůstává u poslance — přisouzené peníze jsou tvrzení o NĚM.
    expect(graph.nodes.find((n) => n.id === sliceMoneyId("00000100"))!.href).toBe("/penize/100");
  });

  it("bez poslance, který má vazbu i novelizující tisk, výřez nevznikne (spadne se na vzorek)", () => {
    const input = fixture();
    input.bills = input.bills.map((b) => ({ ...b, amendedLaws: [] }));
    expect(buildStateSlice(input)).toBeNull();
  });
});
