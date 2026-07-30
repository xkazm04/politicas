// Testy čisté derivace hlídek grafu (tripwires.ts) na fixture grafech:
// každý vzor střílí/nestřílí na hranicích, deterministické pořadí podle
// úplnosti důkazů, poctivý nulový stav a stabilita otisků kandidátů.

import { describe, expect, it } from "vitest";
import type {
  DeriveTripwiresInput,
  TripwireRapporteurIn,
  TripwireStakeIn,
  TripwireTieIn,
  TripwireVoteIn,
} from "./tripwires";
import {
  TRIPWIRE_PATTERNS,
  TRIPWIRE_RULE_VERSION,
  dayInRolePeriod,
  deriveTripwires,
  evidenceScore,
  tripwireCandidateId,
} from "./tripwires";

/* ── fixtures ──────────────────────────────────────────────────────────────── */

const STATUTE = { ref: "134/2016", label: "zákon o zadávání veřejných zakázek", why: "contracts" };

const tie = (over: Partial<TripwireTieIn> = {}): TripwireTieIn => ({
  edgeSrc: "psp:person:100",
  edgeDst: "company:ico:11111111",
  personPspId: 100,
  personName: "Jan Novák",
  club: "TEST",
  companyId: "company:ico:11111111",
  company: "Testovací s.r.o.",
  ico: "11111111",
  role: "jednatel",
  tieClass: "owner-operator",
  reviewState: "pending_review",
  corroboration: "registry-confirmed",
  roleValidFrom: "2022-01-10",
  roleValidTo: "2024-06-30",
  contractCount: 3,
  contractCzk: 5_000_000,
  subsidiesCzk: 0,
  deMinimis: false,
  channelStatutes: [STATUTE],
  ...over,
});

const vote = (over: Partial<TripwireVoteIn> = {}): TripwireVoteIn => ({
  votePspId: 900,
  votedOn: "2023-05-15",
  voteTitle: "Novela zákona o zadávání veřejných zakázek",
  sourceUrl: "https://psp.cz/sqw/hlasy.sqw?g=900",
  billCislo: 55,
  billTitle: "Tisk 55",
  amendedRefs: [{ ref: "134/2016", label: STATUTE.label }],
  ...over,
});

const rap = (over: Partial<TripwireRapporteurIn> = {}): TripwireRapporteurIn => ({
  personPspId: 100,
  billNodeId: "bill:tisk:5001",
  billCislo: 55,
  billTitle: "Tisk 55",
  amendedRefs: [{ ref: "134/2016", label: STATUTE.label }],
  ...over,
});

const stake = (over: Partial<TripwireStakeIn> = {}): TripwireStakeIn => ({
  srcCompanyId: "company:ico:11111111",
  dstCompanyId: "company:ico:22222222",
  dstCompany: "Držená a.s.",
  dstIco: "22222222",
  stakePct: 40,
  dstContractCount: 7,
  dstContractCzk: 12_000_000,
  ...over,
});

const input = (over: Partial<DeriveTripwiresInput> = {}): DeriveTripwiresInput => ({
  ties: [],
  votes: [],
  rapporteurs: [],
  stakes: [],
  liveCollisions: [],
  votesAvailable: true,
  agendaAvailable: true,
  collisionsAvailable: true,
  ...over,
});

const pattern = (data: ReturnType<typeof deriveTripwires>, id: string) => {
  const p = data.patterns.find((x) => x.pattern === id);
  if (!p) throw new Error(`pattern ${id} missing`);
  return p;
};

/* ── T1: nová vazba v okně peněžního hlasování ─────────────────────────────── */

describe("T1 tie-vote-window", () => {
  it("střílí pro čekající registry-confirmed vazbu s hlasováním v období role", () => {
    const d = deriveTripwires(input({ ties: [tie()], votes: [vote()] }));
    const p = pattern(d, "tie-vote-window");
    expect(p.candidates).toHaveLength(1);
    expect(p.candidates[0].votesMatched).toBe(1);
    expect(p.candidates[0].latestVoteOn).toBe("2023-05-15");
    expect(p.candidates[0].statutes.map((s) => s.ref)).toEqual(["134/2016"]);
  });

  it("krajní dny období role se počítají OBA včetně, den mimo ne", () => {
    const at = (day: string) =>
      pattern(
        deriveTripwires(input({ ties: [tie()], votes: [vote({ votedOn: day })] })),
        "tie-vote-window",
      ).candidates.length;
    expect(at("2022-01-10")).toBe(1); // první den role
    expect(at("2022-01-09")).toBe(0); // den před
    expect(at("2024-06-30")).toBe(1); // poslední den role
    expect(at("2024-07-01")).toBe(0); // den po
  });

  it("nestřílí pro ověřenou vazbu (ta patří na /penize/strety), pro nepotvrzenou roli, bez období ani bez kanálu", () => {
    const cases: Partial<TripwireTieIn>[] = [
      { reviewState: "verified" },
      { corroboration: null },
      { corroboration: "registry-unconfirmed" },
      { roleValidFrom: null },
      { channelStatutes: [] },
    ];
    for (const over of cases) {
      const d = deriveTripwires(input({ ties: [tie(over)], votes: [vote()] }));
      expect(pattern(d, "tie-vote-window").candidates).toHaveLength(0);
    }
  });

  it("nestřílí, když hlasování novelizuje zákon mimo kanály firmy", () => {
    const d = deriveTripwires(
      input({
        ties: [tie()],
        votes: [vote({ amendedRefs: [{ ref: "218/2000", label: "rozpočtová pravidla" }] })],
      }),
    );
    expect(pattern(d, "tie-vote-window").candidates).toHaveLength(0);
  });

  it("víc hlasování v okně = jeden kandidát s počtem a posledním dnem", () => {
    const d = deriveTripwires(
      input({
        ties: [tie()],
        votes: [vote(), vote({ votePspId: 901, votedOn: "2023-11-02" }), vote({ votePspId: 902, votedOn: "2021-01-01" })],
      }),
    );
    const p = pattern(d, "tie-vote-window");
    expect(p.candidates).toHaveLength(1);
    expect(p.candidates[0].votesMatched).toBe(2); // 2021 leží před rolí
    expect(p.candidates[0].latestVoteOn).toBe("2023-11-02");
  });
});

/* ── T2: veřejné smlouvy u neověřené vazby ─────────────────────────────────── */

describe("T2 unverified-contracts", () => {
  it("střílí pro čekající vazbu se smlouvami nad hranicí materiality", () => {
    const d = deriveTripwires(input({ ties: [tie()] }));
    const p = pattern(d, "unverified-contracts");
    expect(p.candidates).toHaveLength(1);
    expect(p.candidates[0].contractCount).toBe(3);
    expect(p.candidates[0].reachableCzk).toBe(5_000_000);
  });

  it("nestřílí pro ověřenou/zamítnutou vazbu, bez smluv, ani pod hranicí materiality", () => {
    const cases: Partial<TripwireTieIn>[] = [
      { reviewState: "verified" },
      { reviewState: "rejected" },
      { contractCount: 0, contractCzk: 0 },
      { deMinimis: true },
    ];
    for (const over of cases) {
      const d = deriveTripwires(input({ ties: [tie(over)] }));
      expect(pattern(d, "unverified-contracts").candidates).toHaveLength(0);
    }
  });
});

/* ── T3: zpravodaj tisku dotýkajícího se kanálu vlastní firmy ──────────────── */

describe("T3 rapporteur-channel", () => {
  it("střílí pro nezamítnutou vazbu, jejíž poslanec je zpravodajem tisku novelizujícího zákon kanálu", () => {
    const d = deriveTripwires(input({ ties: [tie()], rapporteurs: [rap()] }));
    const p = pattern(d, "rapporteur-channel");
    expect(p.candidates).toHaveLength(1);
    expect(p.candidates[0].bill).toEqual({ cislo: 55, title: "Tisk 55" });
  });

  it("ověřená vazba střílí také (jiný vzor než strety — zpravodajství, ne hlasování)", () => {
    const d = deriveTripwires(input({ ties: [tie({ reviewState: "verified" })], rapporteurs: [rap()] }));
    expect(pattern(d, "rapporteur-channel").candidates).toHaveLength(1);
  });

  it("nestřílí pro cizího zpravodaje, bez průniku zákonů, ani pro zamítnutou vazbu", () => {
    const noFire: DeriveTripwiresInput[] = [
      input({ ties: [tie()], rapporteurs: [rap({ personPspId: 999 })] }),
      input({ ties: [tie()], rapporteurs: [rap({ amendedRefs: [{ ref: "424/1991", label: "x" }] })] }),
      input({ ties: [tie({ reviewState: "rejected" })], rapporteurs: [rap()] }),
    ];
    for (const i of noFire) {
      expect(pattern(deriveTripwires(i), "rapporteur-channel").candidates).toHaveLength(0);
    }
  });

  it("dva tisky téhož zpravodaje = dva kandidáti (vazba × tisk)", () => {
    const d = deriveTripwires(
      input({ ties: [tie()], rapporteurs: [rap(), rap({ billNodeId: "bill:tisk:5002", billCislo: 77, billTitle: "Tisk 77" })] }),
    );
    expect(pattern(d, "rapporteur-channel").candidates).toHaveLength(2);
  });
});

/* ── T4: smlouvy v majetkovém řetězci vazby ────────────────────────────────── */

describe("T4 ownership-chain", () => {
  it("střílí pro podíl ve firmě se smlouvami; nese držený řetězec", () => {
    const d = deriveTripwires(input({ ties: [tie()], stakes: [stake()] }));
    const p = pattern(d, "ownership-chain");
    expect(p.candidates).toHaveLength(1);
    expect(p.candidates[0].chain).toEqual({
      company: "Držená a.s.",
      ico: "22222222",
      stakePct: 40,
      contractCount: 7,
      contractCzk: 12_000_000,
    });
  });

  it("nestřílí bez smluv držené firmy, bez podílu z firmy vazby, ani pro zamítnutou vazbu", () => {
    const noFire: DeriveTripwiresInput[] = [
      input({ ties: [tie()], stakes: [stake({ dstContractCount: 0, dstContractCzk: 0 })] }),
      input({ ties: [tie()], stakes: [stake({ srcCompanyId: "company:ico:99999999" })] }),
      input({ ties: [tie({ reviewState: "rejected" })], stakes: [stake()] }),
    ];
    for (const i of noFire) {
      expect(pattern(deriveTripwires(i), "ownership-chain").candidates).toHaveLength(0);
    }
  });
});

/* ── pořadí, skóre, otisky, krytí ──────────────────────────────────────────── */

describe("úplnost důkazů a pořadí", () => {
  it("skóre je vyhlášený součet složek a rozklad se veze celý", () => {
    const e = evidenceScore({
      corroboration: "registry-confirmed", // +3
      roleValidFrom: "2022-01-01", // +2
      roleValidTo: "2024-01-01", // +1
      reviewState: "verified", // +2
      matchedStatuteRefs: ["134/2016", "340/2015"], // +2
      reachableCzk: 15_000_000, // +2 (≥10 mil)
    });
    expect(e.score).toBe(12);
    expect(e.parts.reduce((s, p) => s + p.pts, 0)).toBe(e.score);
  });

  it("shoda zákonů se stropuje na 3 a prahy peněz jsou 1/10/100 mil.", () => {
    const refs = ["1/1", "2/2", "3/3", "4/4", "5/5"];
    const base = { corroboration: null, roleValidFrom: null, roleValidTo: null, reviewState: "pending_review" as const };
    expect(evidenceScore({ ...base, matchedStatuteRefs: refs, reachableCzk: 0 }).score).toBe(3);
    expect(evidenceScore({ ...base, matchedStatuteRefs: [], reachableCzk: 999_999 }).score).toBe(0);
    expect(evidenceScore({ ...base, matchedStatuteRefs: [], reachableCzk: 1_000_000 }).score).toBe(1);
    expect(evidenceScore({ ...base, matchedStatuteRefs: [], reachableCzk: 100_000_000 }).score).toBe(3);
  });

  it("pořadí je deterministické: skóre sestupně, pak jméno (cs), IČO, id — dva běhy = týž výsledek", () => {
    const ties = [
      tie({ edgeSrc: "psp:person:1", personPspId: 1, personName: "Šimon Ctibor", ico: "3", edgeDst: "company:ico:3", companyId: "company:ico:3", corroboration: null, roleValidFrom: null }),
      tie({ edgeSrc: "psp:person:2", personPspId: 2, personName: "Adam Zeman", ico: "2", edgeDst: "company:ico:2", companyId: "company:ico:2", corroboration: null, roleValidFrom: null }),
      tie({ edgeSrc: "psp:person:3", personPspId: 3, personName: "Adam Zeman", ico: "1", edgeDst: "company:ico:1", companyId: "company:ico:1", corroboration: null, roleValidFrom: null }),
      tie({ edgeSrc: "psp:person:4", personPspId: 4, personName: "Böhm Aleš", ico: "4", edgeDst: "company:ico:4", companyId: "company:ico:4" }),
    ];
    const run = () =>
      pattern(deriveTripwires(input({ ties })), "unverified-contracts").candidates.map((c) => `${c.personName}/${c.ico}`);
    const first = run();
    // registry-confirmed + období (vyšší skóre) první; pak stejné skóre podle
    // českého řazení jmen (Adam < Böhm < Šimon), uvnitř jména podle IČO.
    expect(first).toEqual(["Böhm Aleš/4", "Adam Zeman/1", "Adam Zeman/2", "Šimon Ctibor/3"]);
    expect(run()).toEqual(first);
  });

  it("otisk kandidáta je stabilní pro týž klíč a různý pro jiný vzor/klíč", () => {
    const a = tripwireCandidateId({ pattern: "tie-vote-window", edgeSrc: "s", edgeDst: "d" });
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(tripwireCandidateId({ pattern: "tie-vote-window", edgeSrc: "s", edgeDst: "d" })).toBe(a);
    expect(tripwireCandidateId({ pattern: "unverified-contracts", edgeSrc: "s", edgeDst: "d" })).not.toBe(a);
    expect(tripwireCandidateId({ pattern: "tie-vote-window", edgeSrc: "s", edgeDst: "d", extra: "x" })).not.toBe(a);
  });

  it("křížové odkazy na strety se přiváží na TUTÉŽ vazbu a řadí se deterministicky", () => {
    const d = deriveTripwires(
      input({
        ties: [tie()],
        liveCollisions: [
          { id: "ffffffff", edgeSrc: "psp:person:100", edgeDst: "company:ico:11111111" },
          { id: "aaaaaaaa", edgeSrc: "psp:person:100", edgeDst: "company:ico:11111111" },
          { id: "bbbbbbbb", edgeSrc: "psp:person:999", edgeDst: "company:ico:11111111" },
        ],
      }),
    );
    expect(pattern(d, "unverified-contracts").candidates[0].stretyIds).toEqual(["aaaaaaaa", "ffffffff"]);
  });
});

describe("poctivý nulový stav a krytí", () => {
  it("prázdný graf: všechny vzory přítomné, nula kandidátů, nula prošlých — nikdy chybějící sekce", () => {
    const d = deriveTripwires(input());
    expect(d.patterns).toHaveLength(TRIPWIRE_PATTERNS.length);
    for (const p of d.patterns) {
      expect(p.candidates).toEqual([]);
      expect(p.examined).toBe(0);
      expect(p.ruleCs.length).toBeGreaterThan(40); // pravidlo se veze vždy, i k nule
    }
    expect(d.coverage.candidatesTotal).toBe(0);
    expect(d.ruleVersion).toBe(TRIPWIRE_RULE_VERSION);
  });

  it("krytí počítá vstupy poctivě (pending/rejected/hlasovatelná hlasování/podíly)", () => {
    const d = deriveTripwires(
      input({
        ties: [tie(), tie({ edgeSrc: "psp:person:2", reviewState: "rejected" }), tie({ edgeSrc: "psp:person:3", reviewState: "verified" })],
        votes: [vote()],
        rapporteurs: [rap()],
        stakes: [stake()],
        votesAvailable: false,
        agendaAvailable: false,
        collisionsAvailable: false,
      }),
    );
    expect(d.coverage.tiesTotal).toBe(3);
    expect(d.coverage.tiesPending).toBe(1);
    expect(d.coverage.tiesRejected).toBe(1);
    expect(d.coverage.votesLinkable).toBe(1);
    expect(d.coverage.rapporteurAssignments).toBe(1);
    expect(d.coverage.stakeEdges).toBe(1);
    expect(d.votesAvailable).toBe(false);
    expect(d.agendaAvailable).toBe(false);
    expect(d.collisionsAvailable).toBe(false);
    // examined: pending vzory 1, nezamítnuté vzory 2
    expect(pattern(d, "tie-vote-window").examined).toBe(1);
    expect(pattern(d, "rapporteur-channel").examined).toBe(2);
  });
});

describe("dayInRolePeriod", () => {
  it("oba krajní dny včetně, otevřený konec = bez horní hranice", () => {
    expect(dayInRolePeriod("2022-01-10", "2022-01-10", "2022-02-01")).toBe(true);
    expect(dayInRolePeriod("2022-02-01", "2022-01-10", "2022-02-01")).toBe(true);
    expect(dayInRolePeriod("2022-01-09", "2022-01-10", "2022-02-01")).toBe(false);
    expect(dayInRolePeriod("2022-02-02", "2022-01-10", "2022-02-01")).toBe(false);
    expect(dayInRolePeriod("2099-12-31", "2022-01-10", null)).toBe(true);
  });
});
