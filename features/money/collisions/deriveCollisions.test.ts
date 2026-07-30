// Testy čisté derivace Vote-Collision Engine — pravidla joinu na fixture
// datech: determinismus, hraniční dny období role × den hlasování, filtr
// „jen ověřené vazby", poctivý nulový stav, extrakce čísla tisku, jen poziční
// hlasy a vyhlášená tabulka relevance.

import { describe, expect, it } from "vitest";
import type {
  CollisionBallotIn,
  CollisionBillIn,
  CollisionTieIn,
  CollisionVoteIn,
} from "./collisionTypes";
import { collisionAnchorId, parseCollisionAnchor } from "./collisionTypes";
import { deriveCollisions, collisionCandidateId } from "./deriveCollisions";
import { buildAgendaTiskMap } from "./voteAgenda";
import {
  COLLISION_RULE_VERSION,
  relevantStatutesFor,
  tiskRefOf,
  voteInRolePeriod,
} from "./statuteRelevance";

/* ── fixtures ──────────────────────────────────────────────────────────────── */

const tie = (over: Partial<CollisionTieIn> = {}): CollisionTieIn => ({
  personPspId: 100,
  personName: "Jan Novák",
  club: "TEST",
  edgeSrc: "psp:person:100",
  edgeDst: "company:ico:11111111",
  companyId: "company:ico:11111111",
  company: "Testovka s.r.o.",
  ico: "11111111",
  role: "jednatel",
  tieClass: "owner-operator",
  reviewState: "verified",
  corroboration: "registry-confirmed",
  roleValidFrom: "2026-03-10",
  roleValidTo: "2026-06-20",
  contractCount: 3,
  subsidiesCount: 0,
  donatedToPartyCzk: null,
  ...over,
});

const vote = (pspId: number, votedOn: string | null, over: Partial<CollisionVoteIn> = {}): CollisionVoteIn => ({
  pspId,
  votedOn,
  voided: false,
  title: `Novela zákona /sněmovní tisk 254/ — hlasování ${pspId}`,
  outcome: "passed",
  sourceUrl: `https://example.test/${pspId}`,
  termPspId: null,
  sessionNo: null,
  agendaItem: null,
  ...over,
});

const bill254: CollisionBillIn = {
  nodeId: "bill:tisk:900254",
  cislo: 254,
  title: "Novela zákona o zadávání veřejných zakázek",
  amendedRefs: [{ ref: "134/2016", label: "zákon o zadávání veřejných zakázek" }],
};

const ballot = (votePspId: number, choice = "yes", mandatePspId = 500): CollisionBallotIn => ({
  votePspId,
  mandatePspId,
  choice,
});

const personByMandate = new Map([[500, 100]]);

const derive = (over: {
  ties?: CollisionTieIn[];
  votes?: CollisionVoteIn[];
  bills?: CollisionBillIn[];
  ballots?: CollisionBallotIn[];
}) =>
  deriveCollisions({
    ties: over.ties ?? [tie()],
    votes: over.votes ?? [vote(1, "2026-04-01")],
    bills: over.bills ?? [bill254],
    ballots: over.ballots ?? [ballot(1)],
    personByMandate,
  });

/* ── determinismus joinu ───────────────────────────────────────────────────── */

describe("deriveCollisions — determinismus", () => {
  const ties = [
    tie(),
    tie({
      personPspId: 101,
      personName: "Alena Bílá",
      edgeSrc: "psp:person:101",
      companyId: "company:ico:22222222",
      edgeDst: "company:ico:22222222",
      ico: "22222222",
      company: "Druhá a.s.",
    }),
  ];
  const votes = [vote(1, "2026-04-01"), vote(2, "2026-05-01")];
  const ballots = [
    ballot(1, "yes", 500),
    ballot(2, "no", 500),
    ballot(1, "yes", 501),
    ballot(2, "yes", 501),
  ];
  const pbm = new Map([
    [500, 100],
    [501, 101],
  ]);

  it("stejný vstup → identický výstup; přeházené pořadí vstupů → identický výstup", () => {
    const input = { ties, votes, bills: [bill254], ballots, personByMandate: pbm };
    const a = deriveCollisions(input);
    const b = deriveCollisions(input);
    const shuffled = deriveCollisions({
      ties: [...ties].reverse(),
      votes: [...votes].reverse(),
      bills: [bill254],
      ballots: [...ballots].reverse(),
      personByMandate: pbm,
    });
    expect(b).toEqual(a);
    expect(shuffled).toEqual(a);
    // úplné řazení: nejnovější hlasování první, pak jméno (cs)
    expect(a.candidates.map((c) => [c.votedOn, c.personName])).toEqual([
      ["2026-05-01", "Alena Bílá"],
      ["2026-05-01", "Jan Novák"],
      ["2026-04-01", "Alena Bílá"],
      ["2026-04-01", "Jan Novák"],
    ]);
    expect(a.ruleVersion).toBe(COLLISION_RULE_VERSION);
  });

  it("id kandidáta je obsahový otisk — stabilní a citlivý na klíč", () => {
    const id = collisionCandidateId({ personPspId: 100, companyId: "company:ico:11111111", votePspId: 1 });
    expect(id).toMatch(/^[0-9a-f]{8}$/);
    expect(collisionCandidateId({ personPspId: 100, companyId: "company:ico:11111111", votePspId: 1 })).toBe(id);
    expect(collisionCandidateId({ personPspId: 100, companyId: "company:ico:11111111", votePspId: 2 })).not.toBe(id);
    const out = derive({});
    expect(out.candidates[0]?.id).toBe(id);
    expect(collisionAnchorId(id)).toBe(`s-${id}`);
    expect(parseCollisionAnchor(`#s-${id}`)).toBe(id);
    expect(parseCollisionAnchor("#h-92793")).toBeNull();
  });
});

/* ── hraniční dny období role ──────────────────────────────────────────────── */

describe("okno období role × den hlasování (oba krajní dny včetně)", () => {
  it("den před začátkem a den po konci nevstupují; oba krajní dny ano", () => {
    const votes = [
      vote(1, "2026-03-09"), // den před zápisem role
      vote(2, "2026-03-10"), // den zápisu — VČETNĚ
      vote(3, "2026-06-20"), // den výmazu — VČETNĚ
      vote(4, "2026-06-21"), // den po výmazu
    ];
    const out = derive({ votes, ballots: votes.map((v) => ballot(v.pspId)) });
    expect(out.candidates.map((c) => c.votePspId)).toEqual([3, 2]);
  });

  it("otevřené období (roleValidTo = null) pouští i pozdější hlasování", () => {
    const out = derive({
      ties: [tie({ roleValidTo: null })],
      votes: [vote(1, "2031-01-01")],
      ballots: [ballot(1)],
    });
    expect(out.candidates).toHaveLength(1);
  });

  it("voteInRolePeriod porovnává jen den (ořez na YYYY-MM-DD)", () => {
    expect(voteInRolePeriod("2026-03-10", "2026-03-10", "2026-06-20")).toBe(true);
    expect(voteInRolePeriod("2026-03-09", "2026-03-10", null)).toBe(false);
    expect(voteInRolePeriod("2026-06-20", "2026-03-10", "2026-06-20T00:00:00Z")).toBe(true);
  });
});

/* ── jen ověřené vazby ─────────────────────────────────────────────────────── */

describe("filtr vazeb: verified ∧ registry-confirmed ∧ známé období", () => {
  it("pending a rejected vazby kandidáta netvoří, i s dokonalým překryvem", () => {
    const out = derive({
      ties: [tie({ reviewState: "pending_review" }), tie({ reviewState: "rejected" })],
    });
    expect(out.candidates).toEqual([]);
    expect(out.coverage.tiesEntering).toBe(0);
    // pending s potvrzeným obdobím se poctivě počítá jako „vstoupila by po kontrole"
    expect(out.coverage.tiesPendingWouldEnter).toBe(1);
  });

  it("verified bez rejstříkového potvrzení nebo bez období nevstupuje", () => {
    const out = derive({
      ties: [
        tie({ corroboration: null }),
        tie({ corroboration: "registry-unconfirmed" }),
        tie({ roleValidFrom: null }),
      ],
    });
    expect(out.candidates).toEqual([]);
    expect(out.coverage.tiesVerified).toBe(3);
    expect(out.coverage.tiesEntering).toBe(0);
    expect(out.coverage.tiesVerifiedWithoutPeriod).toBe(1);
  });
});

/* ── poctivý nulový stav ───────────────────────────────────────────────────── */

describe("nulový stav", () => {
  it("prázdné vstupy → prázdní kandidáti a nulové coverage, verze pravidla zůstává", () => {
    const out = deriveCollisions({
      ties: [],
      votes: [],
      bills: [],
      ballots: [],
      personByMandate: new Map(),
    });
    expect(out.candidates).toEqual([]);
    expect(out.coverage).toEqual({
      tiesTotal: 0,
      tiesVerified: 0,
      tiesEntering: 0,
      tiesVerifiedWithoutPeriod: 0,
      tiesPendingWouldEnter: 0,
      events: 0,
      eventsVoided: 0,
      eventsLinked: 0,
      eventsAmbiguousAgenda: 0,
      billsInGraph: 0,
      billsMatchedToVotes: 0,
      candidates: 0,
    });
    expect(out.ruleVersion).toBe(COLLISION_RULE_VERSION);
    expect(out.agendaAvailable).toBe(false);
  });

  it("ověřené vazby, ale žádný překryv → nula kandidátů s plným coverage", () => {
    const out = derive({ votes: [vote(1, "2020-01-01")], ballots: [ballot(1)] });
    expect(out.candidates).toEqual([]);
    expect(out.coverage.tiesEntering).toBe(1);
    expect(out.coverage.eventsLinked).toBe(1);
  });
});

/* ── extrakce čísla tisku a vstup hlasování ────────────────────────────────── */

describe("titulek hlasování → číslo tisku (vyhlášené pravidlo)", () => {
  it("rozpozná běžné tvary a odmítne titulky bez tisku", () => {
    expect(tiskRefOf("Novela z. o veřejných zakázkách /sněmovní tisk 254/ — třetí čtení")).toBe(254);
    expect(tiskRefOf("Vládní návrh (tisku č. 12) — druhé čtení")).toBe(12);
    expect(tiskRefOf("TISK 7")).toBe(7);
    expect(tiskRefOf("Procedurální hlasování o pořadu schůze")).toBeNull();
    expect(tiskRefOf("tisk 0")).toBeNull();
  });

  it("hlasování bez čísla tisku a zmatečná hlasování z joinu vypadnou", () => {
    const out = derive({
      votes: [
        vote(1, "2026-04-01", { title: "Procedurální hlasování" }),
        vote(2, "2026-04-01", { voided: true }),
        vote(3, "2026-04-01"),
      ],
      ballots: [ballot(1), ballot(2), ballot(3)],
    });
    expect(out.candidates.map((c) => c.votePspId)).toEqual([3]);
    expect(out.coverage.eventsVoided).toBe(1);
    // eventsLinked se počítá jen mezi PLATNÝMI hlasováními — zmatečné
    // hlasování s tiskem v titulku se nezapočítá.
    expect(out.coverage.eventsLinked).toBe(1);
    expect(out.coverage.events).toBe(2);
  });
});

/* ── pořad schůze jako primární napojení ───────────────────────────────────── */

describe("pořad schůze (agendaTisk) — primární cesta hlasování → tisk", () => {
  const agendaVote = (pspId: number, agendaItem: number) =>
    vote(pspId, "2026-04-01", {
      title: "Vl.n.z. o evidenci tržeb", // ŽÁDNÉ číslo tisku — jako živá data
      termPspId: 700,
      sessionNo: 25,
      agendaItem,
    });

  it("napojí hlasování bez čísla tisku v titulku přes (schůze, bod) → interní id", () => {
    const agendaTisk = new Map<string, number | "ambiguous">([["700:25:42", 900254]]);
    const out = deriveCollisions({
      ties: [tie()],
      votes: [agendaVote(1, 42)],
      bills: [bill254], // nodeId bill:tisk:900254
      ballots: [ballot(1)],
      personByMandate,
      agendaTisk,
    });
    expect(out.agendaAvailable).toBe(true);
    expect(out.coverage.eventsLinked).toBe(1);
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0].billCislo).toBe(254);
  });

  it("bod s víc tisky (společná rozprava) se konzervativně vynechá — bez titulkové záchrany", () => {
    const agendaTisk = new Map<string, number | "ambiguous">([["700:25:42", "ambiguous"]]);
    const out = deriveCollisions({
      ties: [tie()],
      // titulek TADY číslo tisku nese — nejednoznačný bod ho přesto nesmí použít
      votes: [{ ...agendaVote(1, 42), title: "Novela /sněmovní tisk 254/" }],
      bills: [bill254],
      ballots: [ballot(1)],
      personByMandate,
      agendaTisk,
    });
    expect(out.candidates).toEqual([]);
    expect(out.coverage.eventsAmbiguousAgenda).toBe(1);
    expect(out.coverage.eventsLinked).toBe(0);
  });

  it("hlasování, které pořad nezná, padá na záložní titulkové pravidlo", () => {
    const agendaTisk = new Map<string, number | "ambiguous">();
    const out = deriveCollisions({
      ties: [tie()],
      votes: [vote(1, "2026-04-01", { termPspId: 700, sessionNo: 25, agendaItem: 3 })],
      bills: [bill254],
      ballots: [ballot(1)],
      personByMandate,
      agendaTisk,
    });
    expect(out.candidates).toHaveLength(1); // titulek fixture nese „tisk 254"
  });
});

/* ── parser pořadu schůze ──────────────────────────────────────────────────── */

describe("buildAgendaTiskMap (schuze.unl + bod_schuze.unl)", () => {
  // rozvržení sloupců jako živé dumpy: schuze 0 id|1 org|2 číslo;
  // bod_schuze 0 id_bod|1 id_schuze|2 id_tisk|3 typ|4 číslo bodu
  const schuze = [
    ["50", "700", "25", null, null],
    ["50", "700", "25", null, null], // duplicitní řádek (varianta stavu)
    ["51", "700", "26", null, null],
    ["60", "999", "25", null, null], // cizí období — jiný organ
  ];
  const bodSchuze = [
    ["7219", "50", "900254", null, "42"],
    ["7219", "50", "900254", null, "42"], // duplicitní řádek téhož bodu
    ["7220", "50", "900300", null, "43"],
    ["7221", "50", "900301", null, "43"], // týž bod, JINÝ tisk → ambiguous
    ["7222", "50", null, null, "44"], // netiskový bod — nevkládá se
    ["7223", "60", "900999", null, "42"], // cizí období, jiný klíč
  ];

  it("mapuje (organ, schůze, bod) → id tisku; víc tisků na bodu → ambiguous", () => {
    const map = buildAgendaTiskMap(schuze, bodSchuze);
    expect(map.get("700:25:42")).toBe(900254);
    expect(map.get("700:25:43")).toBe("ambiguous");
    expect(map.has("700:25:44")).toBe(false);
    expect(map.get("999:25:42")).toBe(900999);
  });

  it("je deterministický i při přeházeném pořadí vstupních řádků", () => {
    const a = buildAgendaTiskMap(schuze, bodSchuze);
    const b = buildAgendaTiskMap([...schuze].reverse(), [...bodSchuze].reverse());
    expect(b).toEqual(a);
  });
});

/* ── jen poziční hlasy ─────────────────────────────────────────────────────── */

describe("jen poziční hlas (ano/ne) tvoří kandidáta", () => {
  it("zdržení, nehlasování a nepřítomnost kandidáta netvoří", () => {
    for (const choice of ["abstain", "not_voting", "abstain_or_not_voting", "absent"]) {
      const out = derive({ ballots: [ballot(1, choice)] });
      expect(out.candidates).toEqual([]);
    }
    const yes = derive({ ballots: [ballot(1, "yes")] });
    expect(yes.candidates[0]?.choice).toBe("yes");
    const no = derive({ ballots: [ballot(1, "no")] });
    expect(no.candidates[0]?.choice).toBe("no");
  });

  it("chybějící lístek (poslanec nehlasoval / cizí mandát) kandidáta netvoří", () => {
    expect(derive({ ballots: [] }).candidates).toEqual([]);
    expect(derive({ ballots: [ballot(1, "yes", 999)] }).candidates).toEqual([]);
  });
});

/* ── tabulka relevance ─────────────────────────────────────────────────────── */

describe("vyhlášená tabulka relevance (žádná inference)", () => {
  it("firma jen se zakázkami nezasahuje dotační ani darovací zákony", () => {
    const refs = relevantStatutesFor({ contractCount: 2, subsidiesCount: 0, donatedToPartyCzk: null });
    expect(refs.map((r) => r.ref)).toEqual(["134/2016", "340/2015"]);
    const billSubsidy: CollisionBillIn = {
      nodeId: "bill:tisk:900300",
      cislo: 254,
      title: "Novela rozpočtových pravidel",
      amendedRefs: [{ ref: "218/2000", label: "rozpočtová pravidla" }],
    };
    const out = derive({ bills: [billSubsidy] });
    expect(out.candidates).toEqual([]);
  });

  it("kanály se sčítají do JEDNOHO kandidáta na (vazba × hlasování)", () => {
    const billBoth: CollisionBillIn = {
      nodeId: "bill:tisk:900254",
      cislo: 254,
      title: "Souhrnná novela",
      amendedRefs: [
        { ref: "134/2016", label: "zákon o zadávání veřejných zakázek" },
        { ref: "218/2000", label: "rozpočtová pravidla" },
        { ref: "586/1992", label: "zákon o daních z příjmů" }, // mimo tabulku
      ],
    };
    const out = derive({
      ties: [tie({ subsidiesCount: 1 })],
      bills: [billBoth],
    });
    expect(out.candidates).toHaveLength(1);
    // 340/2015 je pro firmu relevantní, ale tenhle tisk ho nenovelizuje —
    // do kandidáta se zapisují jen zasažené zákony; 586/1992 je mimo tabulku.
    expect(out.candidates[0].statutes.map((s) => [s.ref, s.why])).toEqual([
      ["134/2016", "contracts"],
      ["218/2000", "subsidies"],
    ]);
  });

  it("firma bez kanálu veřejných peněz kandidáta netvoří ani u ověřené vazby", () => {
    const out = derive({
      ties: [tie({ contractCount: 0, subsidiesCount: 0, donatedToPartyCzk: null })],
    });
    expect(out.candidates).toEqual([]);
  });

  it("dar straně zasahuje zákon o politických stranách", () => {
    const billParty: CollisionBillIn = {
      nodeId: "bill:tisk:900400",
      cislo: 254,
      title: "Novela zákona o politických stranách",
      amendedRefs: [{ ref: "424/1991", label: "zákon o sdružování ve stranách" }],
    };
    const out = derive({
      ties: [tie({ contractCount: 0, donatedToPartyCzk: 50_000 })],
      bills: [billParty],
    });
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0].statutes[0].why).toBe("donation");
  });
});
