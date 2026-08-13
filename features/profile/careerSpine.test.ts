import { describe, expect, it } from "vitest";
import { deriveCareerSpine, PSP_ERA_FROM, type CareerSpineOptions } from "./careerSpine";

// Fixtury podle reálného tvaru registru (poslanci.zip, ověřeno 2026-07-30):
// sněmovní organy PSP8–PSP10 s okny, mandáty bez dat, membership okna s časem.
const CHAMBERS = [
  { termCode: "PSP8", validFrom: "2017-10-21", validTo: "2021-10-20" },
  { termCode: "PSP9", validFrom: "2021-10-09", validTo: "2025-10-08" },
  { termCode: "PSP10", validFrom: "2025-10-04", validTo: null },
  { termCode: "PSP6", validFrom: "2010-05-29", validTo: "2013-08-28" },
];

const ASOF = "2026-07-30";

const base = (over: Partial<CareerSpineOptions> = {}): CareerSpineOptions => ({
  served: [
    { termCode: "PSP10", region: "Středočeský kraj", partyList: "TOP 09" },
    { termCode: "PSP8", region: "Středočeský kraj", partyList: "TOP 09" },
    { termCode: "PSP9", region: "Středočeský kraj", partyList: "TOP 09" },
  ],
  chambers: CHAMBERS,
  windows: [
    { termCode: "PSP9", fromAt: "2021-10-09T14:00:00.000Z", toAt: "2025-10-08T00:00:00.000Z" },
    { termCode: "PSP10", fromAt: "2025-10-04T00:00:00.000Z", toAt: null },
    { termCode: "PSP8", fromAt: "2017-10-21T14:00:00.000Z", toAt: "2021-10-20T00:00:00.000Z" },
  ],
  currentTermCode: "PSP10",
  asOf: ASOF,
  termCoverage: { PSP9: "partial" },
  ...over,
});

describe("deriveCareerSpine — řazení", () => {
  it("řadí chronologicky podle čísla období bez ohledu na pořadí vstupu", () => {
    const spine = deriveCareerSpine(base());
    expect(spine.terms.map((t) => t.termCode)).toEqual(["PSP8", "PSP9", "PSP10"]);
    expect(spine.servedTermCount).toBe(3);
  });

  it("je deterministické: dvojí běh nad stejným vstupem dá identický výstup", () => {
    const a = deriveCareerSpine(base());
    const b = deriveCareerSpine(base());
    expect(a).toEqual(b);
  });

  it("kód mimo konvenci (ORGANx) jde deterministicky za očíslovaná období", () => {
    const spine = deriveCareerSpine(
      base({ served: [...base().served, { termCode: "ORGAN999", region: null, partyList: null }] }),
    );
    expect(spine.terms.map((t) => t.termCode)).toEqual(["PSP8", "PSP9", "PSP10", "ORGAN999"]);
    expect(spine.terms[3].termNumber).toBeNull();
    expect(spine.terms[3].windowUnknown).toBe(true);
  });

  it("dedupuje duplicitní mandátní řádek stejného období", () => {
    const spine = deriveCareerSpine(
      base({ served: [...base().served, { termCode: "PSP9", region: "jiný", partyList: "jiná" }] }),
    );
    expect(spine.terms.filter((t) => t.termCode === "PSP9")).toHaveLength(1);
    expect(spine.servedTermCount).toBe(3);
  });
});

describe("deriveCareerSpine — běžící období", () => {
  it("aktuální období s otevřeným oknem je openEnded s mandateTo null", () => {
    const spine = deriveCareerSpine(base());
    const psp10 = spine.terms.find((t) => t.termCode === "PSP10")!;
    expect(psp10.current).toBe(true);
    expect(psp10.openEnded).toBe(true);
    expect(psp10.mandateTo).toBeNull();
    expect(psp10.mandateFrom).toBe("2025-10-04");
    expect(psp10.chamberTo).toBeNull();
    expect(psp10.coverage).toBe("full");
  });

  it("uzavřené okno v aktuálním období (odešel z mandátu) NENÍ openEnded", () => {
    const spine = deriveCareerSpine(
      base({
        windows: [{ termCode: "PSP10", fromAt: "2025-10-04T00:00:00.000Z", toAt: "2026-03-01T00:00:00.000Z" }],
        served: [{ termCode: "PSP10", region: null, partyList: null }],
      }),
    );
    expect(spine.terms[0].openEnded).toBe(false);
    expect(spine.terms[0].mandateTo).toBe("2026-03-01");
  });

  it("odchod a návrat v jednom období se sloučí: min od, otevřený konec vítězí", () => {
    const spine = deriveCareerSpine(
      base({
        served: [{ termCode: "PSP10", region: null, partyList: null }],
        windows: [
          { termCode: "PSP10", fromAt: "2026-02-01T00:00:00.000Z", toAt: null },
          { termCode: "PSP10", fromAt: "2025-10-04T00:00:00.000Z", toAt: "2025-12-01T00:00:00.000Z" },
        ],
      }),
    );
    const t = spine.terms[0];
    expect(t.stintCount).toBe(2);
    expect(t.mandateFrom).toBe("2025-10-04");
    expect(t.mandateTo).toBeNull();
    expect(t.openEnded).toBe(true);
  });

  it("minulé období není nikdy openEnded, ani s otevřeným oknem (vada dat)", () => {
    const spine = deriveCareerSpine(
      base({
        served: [{ termCode: "PSP8", region: null, partyList: null }, { termCode: "PSP10", region: null, partyList: null }],
        windows: [
          { termCode: "PSP8", fromAt: "2017-10-21T14:00:00.000Z", toAt: null },
          { termCode: "PSP10", fromAt: "2025-10-04T00:00:00.000Z", toAt: null },
        ],
      }),
    );
    expect(spine.terms[0].openEnded).toBe(false);
  });
});

describe("deriveCareerSpine — mezery a pokrytí", () => {
  it("období bez ingestované aktivity nese coverage none; PSP9 podle vstupu; běžící full", () => {
    const spine = deriveCareerSpine(base());
    expect(spine.terms.map((t) => [t.termCode, t.coverage])).toEqual([
      ["PSP8", "none"],
      ["PSP9", "partial"],
      ["PSP10", "full"],
    ]);
  });

  it("období s úplným záznamem propaguje complete pokrytí", () => {
    const spine = deriveCareerSpine(base({ termCoverage: { PSP9: "full" } }));
    expect(spine.terms.find((t) => t.termCode === "PSP9")!.coverage).toBe("full");
  });

  it("pokrytí čte KÓD OBDOBÍ z dat, ne z literálu v odvození", () => {
    // Odvození do 2026-08-13 znělo `termCode === "PSP9" ? psp9Coverage : "none"`.
    // Až se sněmovna posune, období, jehož záznam JE ingestovaný, by na všech
    // spisech tisklo „období zatím mimo záznam" — a nic v testech by se nehnulo.
    // Tenhle případ je proti staré podobě ČERVENÝ: PSP10 by dostalo „none".
    const spine = deriveCareerSpine(
      base({
        served: [
          { termCode: "PSP9", region: null, partyList: null },
          { termCode: "PSP10", region: null, partyList: null },
          { termCode: "PSP11", region: null, partyList: null },
        ],
        chambers: [...CHAMBERS, { termCode: "PSP11", validFrom: "2029-10-05", validTo: null }],
        windows: [],
        currentTermCode: "PSP11",
        asOf: "2030-01-01",
        termCoverage: { PSP10: "full", PSP9: "partial" },
      }),
    );
    expect(spine.terms.map((t) => [t.termCode, t.coverage])).toEqual([
      ["PSP9", "partial"],
      ["PSP10", "full"],
      ["PSP11", "full"],
    ]);
  });

  it("období, které mapa pokrytí nezná, je přiznaná mezera", () => {
    const spine = deriveCareerSpine(base({ termCoverage: {} }));
    expect(spine.terms.map((t) => [t.termCode, t.coverage])).toEqual([
      ["PSP8", "none"],
      ["PSP9", "none"],
      ["PSP10", "full"],
    ]);
  });

  it("served období bez membership okna přizná windowUnknown, žádné datum si nevymyslí", () => {
    const spine = deriveCareerSpine(
      base({
        served: [{ termCode: "PSP6", region: null, partyList: null }, { termCode: "PSP10", region: null, partyList: null }],
        windows: [{ termCode: "PSP10", fromAt: "2025-10-04T00:00:00.000Z", toAt: null }],
      }),
    );
    const psp6 = spine.terms.find((t) => t.termCode === "PSP6")!;
    expect(psp6.windowUnknown).toBe(true);
    expect(psp6.mandateFrom).toBeNull();
    expect(psp6.mandateTo).toBeNull();
    // Okno celé sněmovny z registru organů zůstává — to registr nese.
    expect(psp6.chamberFrom).toBe("2010-05-29");
  });

  it("nesouvislá služba vyrobí přestávku s vynechanými obdobími", () => {
    const spine = deriveCareerSpine(
      base({
        served: [
          { termCode: "PSP6", region: null, partyList: null },
          { termCode: "PSP9", region: null, partyList: null },
          { termCode: "PSP10", region: null, partyList: null },
        ],
        windows: [],
      }),
    );
    expect(spine.breaks).toEqual([{ afterTermCode: "PSP6", missedTermCodes: ["PSP7", "PSP8"] }]);
  });

  it("souvislá služba nemá žádné přestávky", () => {
    expect(deriveCareerSpine(base()).breaks).toEqual([]);
  });

  it("datum mimo <PSP_ERA_FROM, asOf> (korpus nese i rok 2925) se potlačí a přizná", () => {
    const spine = deriveCareerSpine(
      base({
        served: [{ termCode: "PSP10", region: null, partyList: null }],
        windows: [{ termCode: "PSP10", fromAt: "2025-10-04T00:00:00.000Z", toAt: "2925-01-01T00:00:00.000Z" }],
      }),
    );
    const t = spine.terms[0];
    expect(t.dateUnreadable).toBe(true);
    expect(t.mandateTo).toBeNull();
    expect(t.openEnded).toBe(false); // uzavřené okno s nečitelným koncem mandát „neběží"
  });

  it("datum před sněmovní érou se potlačí (PSP_ERA_FROM je 1992, ne 1993)", () => {
    expect(PSP_ERA_FROM).toBe("1992-06-01");
    const spine = deriveCareerSpine(
      base({
        served: [{ termCode: "PSP10", region: null, partyList: null }],
        windows: [{ termCode: "PSP10", fromAt: "0002-01-01T00:00:00.000Z", toAt: null }],
      }),
    );
    expect(spine.terms[0].mandateFrom).toBeNull();
    expect(spine.terms[0].dateUnreadable).toBe(true);
  });

});

describe("deriveCareerSpine — úseky služby", () => {
  it("stintCount počítá RŮZNÁ okna, ne řádky registru", () => {
    // Korpus psp.cz nese duplicitní řádky členství (proto dedupe v getProfileData).
    // Dva identické řádky jsou jeden úsek služby; „2 úseky" by čtenáři tvrdily
    // odchod a návrat, který se nikdy nestal.
    const spine = deriveCareerSpine(
      base({
        served: [{ termCode: "PSP10", region: null, partyList: null }],
        windows: [
          { termCode: "PSP10", fromAt: "2025-10-04T00:00:00.000Z", toAt: null },
          { termCode: "PSP10", fromAt: "2025-10-04T00:00:00.000Z", toAt: null },
        ],
      }),
    );
    expect(spine.terms[0].stintCount).toBe(1);
  });

  it("skutečný odchod a návrat zůstávají dva úseky", () => {
    const spine = deriveCareerSpine(
      base({
        served: [{ termCode: "PSP10", region: null, partyList: null }],
        windows: [
          { termCode: "PSP10", fromAt: "2025-10-04T00:00:00.000Z", toAt: "2025-12-01T00:00:00.000Z" },
          { termCode: "PSP10", fromAt: "2026-02-01T00:00:00.000Z", toAt: null },
          // třetí, duplicitní řádek prvního úseku
          { termCode: "PSP10", fromAt: "2025-10-04T00:00:00.000Z", toAt: "2025-12-01T00:00:00.000Z" },
        ],
      }),
    );
    expect(spine.terms[0].stintCount).toBe(2);
  });
});

describe("deriveCareerSpine — běžící období není totéž co stále slouží", () => {
  const oneTerm = (windows: CareerSpineOptions["windows"]) =>
    deriveCareerSpine(base({ served: [{ termCode: "PSP10", region: null, partyList: null }], windows }))
      .terms[0];

  it("otevřené okno v běžícím období = slouží", () => {
    const t = oneTerm([{ termCode: "PSP10", fromAt: "2025-10-04T00:00:00.000Z", toAt: null }]);
    expect(t.current).toBe(true);
    expect(t.serving).toBe(true);
  });

  it("uzavřené okno v běžícím období = NESLOUŽÍ, i když období běží dál", () => {
    // Přesně ten případ, který se na spisu kreslil jako aktivní.
    const t = oneTerm([{ termCode: "PSP10", fromAt: "2025-10-04T00:00:00.000Z", toAt: "2026-03-01T00:00:00.000Z" }]);
    expect(t.current).toBe(true);
    expect(t.openEnded).toBe(false);
    expect(t.serving).toBe(false);
  });

  it("bez osobního okna se služba netvrdí ani jedním směrem", () => {
    const t = oneTerm([]);
    expect(t.windowUnknown).toBe(true);
    expect(t.serving).toBeNull();
  });

  it("nečitelný konec není důkaz odchodu", () => {
    const t = oneTerm([{ termCode: "PSP10", fromAt: "2025-10-04T00:00:00.000Z", toAt: "2925-01-01T00:00:00.000Z" }]);
    expect(t.dateUnreadable).toBe(true);
    expect(t.serving).toBeNull();
  });

  it("minulé období nikdy neslouží", () => {
    const spine = deriveCareerSpine(base());
    expect(spine.terms.filter((t) => !t.current).every((t) => t.serving === false)).toBe(true);
  });
});
