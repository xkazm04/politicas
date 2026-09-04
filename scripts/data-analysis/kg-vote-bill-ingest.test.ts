import { describe, expect, it } from "vitest";

import { parseUnl } from "@/lib/ingest/unl";
import { parseAgendaPrints } from "@/lib/ingest/sources/psp-activity";
import type { VoteEventRow } from "@/lib/db/types";

import { formatCoverage, joinVotesToPrints } from "./kg-vote-bill-ingest";

// schuze.unl: 0 id_schuze | 1 id_org | 2 schuze (sitting number)
const schuze = parseUnl(["848|174|5|||", "844|174|3|||"].join("\n"));
// bod_schuze.unl: 0 id_bod | 1 id_schuze | 2 id_tisk | 3 id_typ | 4 bod | … | 9 pozvanka | … | 14 zkratka
const bodRow = (idBod: number, idSchuze: number, tisk: string, bod: string, pozvanka: string, zkratka: string) =>
  [idBod, idSchuze, tisk, "1", bod, "název", "kon", "", "0", pozvanka, "0", "", "0", "", zkratka].join("|");
const bodSchuze = parseUnl(
  [
    bodRow(1, 848, "43117", "1", "", "mediální služby"), // one print
    bodRow(2, 848, "43187", "67", "", "písemná inter."), // two prints on one item
    bodRow(3, 848, "43188", "67", "", "písemná inter."),
    bodRow(4, 848, "99999", "70", "", "mimo graf"), // print the graph does not carry
    bodRow(5, 844, "", "2", "", "slib poslanců"), // item with no print
    bodRow(6, 848, "43999", "1", "1", "pozvánka"), // proposed agenda — must not join
  ].join("\n"),
);
const agenda = parseAgendaPrints(schuze, bodSchuze, 174);

const bills = new Map<number, string>([
  [43117, "bill:tisk:43117"],
  [43187, "bill:tisk:43187"],
  [43188, "bill:tisk:43188"],
]);
const prov = { pass: 51, method: "deterministic", ref: "psp-vote-bill-agenda", computedAt: "2026-09-04T00:00:00.000Z" };

const vote = (pspId: number, sessionNo: number | null, agendaItem: number | null, extra: Partial<VoteEventRow> = {}): VoteEventRow =>
  ({
    id: `psp:hlasovani:${pspId}`, pspId, termPspId: 174, termCode: "PSP10",
    sessionNo, voteNo: 1, agendaItem, votedAt: null, votedOn: "2026-01-15",
    yes: 100, no: 20, abstain: 0, notVoting: 0, present: 120, quorum: 61,
    kind: "normal", outcome: "A", titleLong: "t", titleShort: null, titleNorm: "t",
    voided: false, raw: {}, source: "psp", sourceUrl: null, fetchedAt: null, ingestRunId: null,
    ...extra,
  }) as VoteEventRow;

describe("joinVotesToPrints — the decides edge", () => {
  const votes = [
    vote(1, 5, 1), // → 43117
    vote(2, 5, 67), // → 43187 + 43188 (ambiguous item)
    vote(3, 5, 70), // item resolves, its print is not a graph bill
    vote(4, 3, 2), // item resolves, carries no print
    vote(5, 5, 999), // item not on the agenda as taken
    vote(6, 5, 0), // procedural: bod = 0
    vote(7, 5, 1, { voided: true }), // zmatečné
  ];
  const { edges, coverage } = joinVotesToPrints(votes, agenda, bills, prov);

  it("writes one edge per (roll call, print) and keeps the ambiguity many-to-many", () => {
    expect(edges.filter((e) => e.src === "psp:hlasovani:1").map((e) => e.dst)).toEqual(["bill:tisk:43117"]);
    expect(edges.filter((e) => e.src === "psp:hlasovani:2").map((e) => e.dst).sort()).toEqual([
      "bill:tisk:43187",
      "bill:tisk:43188",
    ]);
    expect(coverage.edges).toBe(3);
  });

  it("puts the ambiguity ON the edge instead of resolving it away", () => {
    const single = edges.find((e) => e.src === "psp:hlasovani:1")!;
    const ambiguous = edges.find((e) => e.src === "psp:hlasovani:2")!;
    expect(single.props.itemPrintCount).toBe(1);
    expect(ambiguous.props.itemPrintCount).toBe(2);
    expect(coverage.votesOnMultiPrintItem).toBe(1);
    expect(coverage.agendaItemsMultiPrint).toBe(1);
  });

  it("never infers a reading stage, and states its join basis", () => {
    for (const e of edges) {
      expect(e.props.readingStage).toBeNull();
      expect(e.props.joinBasis).toBe("schuze+bod");
      expect(e.props.votedOn).toBe("2026-01-15");
      expect(e.props.agendaLabel).toBeTruthy();
      expect(e.provenance).toBe(prov);
    }
  });

  it("refuses the pozvánky's numbering — the print it would have added is absent", () => {
    expect(edges.map((e) => e.dst)).not.toContain("bill:tisk:43999");
  });

  it("counts every unlinked roll call, and the buckets sum to the cap", () => {
    expect(coverage.valid).toBe(6);
    expect(coverage.voided).toBe(1);
    expect(coverage.votesLinked).toBe(2);
    expect(coverage.votesWithoutPrint).toBe(4);
    expect(coverage.votesWithNoAgendaItem).toBe(1); // vote 6
    expect(coverage.votesWithUnresolvedAgendaItem).toBe(1); // vote 5
    expect(coverage.votesOnItemWithoutPrint).toBe(2); // votes 3 and 4
    expect(
      coverage.votesWithNoAgendaItem + coverage.votesWithUnresolvedAgendaItem + coverage.votesOnItemWithoutPrint,
    ).toBe(coverage.votesWithoutPrint);
  });

  it("counts prints outside the graph rather than dropping them silently", () => {
    expect(coverage.printsOutsideGraph).toBe(1); // 99999
    expect(coverage.printsLinked).toBe(3);
  });

  it("prints the cap beside its population — every cap ships its denominator", () => {
    const out = formatCoverage(coverage);
    expect(out).toContain("votesWithoutPrint 4");
    expect(out).toContain("full population of 6");
    expect(out).toContain("agendaItemsMultiPrint 1");
    expect(out).toContain("readingStage: null on all 3");
  });
});
