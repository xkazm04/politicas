// Paměť zákona — přibíjí čistou derivaci dosjaru předpisu (moonshot 5A):
// skládání §-stopy (seskupení podle §, řazení, vícenásobná novelizace),
// kroniku tisků (řazení + provenience title/census/both), vyhlášené pravidlo
// kandidátů okna (hranice intervalu), statistiku pokrytí a rejstřík.

import { describe, expect, it } from "vitest";
import type { LawBillView, LawData, ParagraphDiff } from "./getLawData";
import { deriveStatuteDossier, listStatuteRegistry, paragraphKeyOrder } from "./deriveStatuteDossier";

/* ── fixtury ─────────────────────────────────────────────────────────── */

const diff = (over: Partial<ParagraphDiff> & { hunks?: ParagraphDiff["hunks"] }): ParagraphDiff => ({
  law: "586/1992",
  source: "e-Sbírka SPARQL endpoint — test fixture",
  fetchedAt: "2026-07-24T00:00:00.000Z",
  from: { date: "2021-01-01", effectiveFrom: "2021-01-01", effectiveTo: null, eli: "https://e/from" },
  to: { date: "2024-01-01", effectiveFrom: "2024-01-01", effectiveTo: null, eli: "https://e/to" },
  parScope: "§ 35ba",
  hunks: [
    { fragment: "§ 35ba odst. 1 písm. a)", op: "modified", before: "27 840", after: "30 840" },
  ],
  ...over,
});

const amendedLaw = (ref: string) => ({
  urn: `law:sb:${ref.replace("/", "-")}`,
  ref,
  label: `zákon č. ${ref} Sb.`,
  title: ref === "586/1992" ? "zákon o daních z příjmů" : null,
});

const bill = (over: Partial<LawBillView>): LawBillView => ({
  tiskId: 1000,
  cislo: 100,
  title: "Novela zákona o daních z příjmů",
  summary: null,
  summarySource: null,
  origin: "government",
  submitter: null,
  sponsors: [],
  rapporteurs: [],
  speakers: [],
  amendmentAuthors: [],
  stav: "v projednávání",
  fateSb: null,
  fatePublishedOn: null,
  sponsorMinContribution: null,
  amendedLaws: [amendedLaw("586/1992")],
  committees: [],
  flaggedConflict: false,
  sponsorContractCzk: 0,
  sponsorMoneyCompanies: 0,
  forensic: null,
  paragraphDiffs: [],
  amendedLawsFull: [],
  amendsUndercount: 0,
  sectorAttributionFlags: [],
  ...over,
});

const data = (bills: LawBillView[]): LawData => ({
  bills,
  topLaws: [],
  originCounts: {},
  totalBills: bills.length,
  totalLaws: 0,
  totalAmends: 0,
  flaggedCount: 0,
  forensicCount: 0,
  summaryCount: 0,
  forensicWithheldCount: 0,
  paragraphDiffCount: 0,
  committeeRoutedBills: 0,
  censusBillCount: 0,
  censusUndercountTotal: 0,
  sectorAttributionBillCount: 0,
  sectorAttributionFlagCount: 0,
  pass: null,
});

/* ── kronika ─────────────────────────────────────────────────────────── */

describe("trail — ordering + provenance", () => {
  it("enacted bills first (chronological by publication), then pending by cislo; census provenance honest", () => {
    const d = data([
      bill({ tiskId: 3, cislo: 300 }), // pending
      bill({ tiskId: 1, cislo: 254, fateSb: "349/2023", fatePublishedOn: "2023-12-12" }),
      bill({ tiskId: 2, cislo: 101, fateSb: "128/2022", fatePublishedOn: "2022-05-01" }),
      // census-only: no amends edge to 586/1992, only the full-text census
      bill({ tiskId: 4, cislo: 50, amendedLaws: [amendedLaw("40/2009")], amendedLawsFull: ["586/1992"] }),
      // both provenances
      bill({ tiskId: 5, cislo: 200, amendedLawsFull: ["586/1992", "40/2009"] }),
    ]);
    const dossier = deriveStatuteDossier(d, "586/1992");
    expect(dossier).not.toBeNull();
    expect(dossier!.trail.map((t) => t.tiskId)).toEqual([2, 1, 4, 5, 3]);
    expect(dossier!.trail.map((t) => t.provenance)).toEqual(["title", "title", "census", "both", "title"]);
    expect(dossier!.coverage).toMatchObject({
      trailBills: 5,
      enactedBills: 2,
      censusOnlyBills: 1,
      paragraphs: 0,
      changes: 0,
      windows: 0,
    });
    expect(dossier!.slug).toBe("586-1992");
    expect(dossier!.title).toBe("zákon o daních z příjmů");
    expect(dossier!.inRegistry).toBe(true);
  });

  it("returns null for a statute nobody amends, and for a non-canonical ref", () => {
    const d = data([bill({})]);
    expect(deriveStatuteDossier(d, "999/2020")).toBeNull();
    expect(deriveStatuteDossier(d, "not-a-ref")).toBeNull();
  });

  it("a census-only statute still gets a dossier (inRegistry=false, fallback label)", () => {
    const d = data([bill({ amendedLaws: [amendedLaw("40/2009")], amendedLawsFull: ["117/1995"] })]);
    const dossier = deriveStatuteDossier(d, "117/1995");
    expect(dossier).not.toBeNull();
    expect(dossier!.inRegistry).toBe(false);
    expect(dossier!.label).toBe("zákon č. 117/1995 Sb.");
    expect(dossier!.trail[0].provenance).toBe("census");
  });
});

/* ── §-stopa ─────────────────────────────────────────────────────────── */

describe("paragraph trail — grouping, ordering, multi-amendment §§", () => {
  it("groups hunks by top-level §, orders §§ naturally, changes chronologically within a §", () => {
    const early = diff({
      from: { date: "2019-01-01", effectiveFrom: "2019-01-01", effectiveTo: null, eli: "https://e/2019" },
      to: { date: "2021-01-01", effectiveFrom: "2021-01-01", effectiveTo: null, eli: "https://e/2021" },
      hunks: [{ fragment: "§ 35ba odst. 1 písm. a)", op: "modified", before: "24 840", after: "27 840" }],
    });
    const late = diff({
      hunks: [
        { fragment: "§ 35ba odst. 1 písm. b)", op: "removed", before: "sleva na manžela", after: null },
        { fragment: "§ 35ba odst. 1 písm. a)", op: "modified", before: "27 840", after: "30 840" },
        { fragment: "§ 9 odst. 1", op: "modified", before: "x", after: "y" },
      ],
    });
    const d = data([bill({ paragraphDiffs: [late, early] })]);
    const dossier = deriveStatuteDossier(d, "586/1992")!;

    // § řazení přirozeně: 9 < 35ba; kotvy ve jmenném prostoru #p-<§>
    expect(dossier.paragraphs.map((p) => p.key)).toEqual(["9", "35ba"]);
    expect(dossier.paragraphs.map((p) => p.anchor)).toEqual(["p-9", "p-35ba"]);

    // vícenásobná novelizace § 35ba: 2 okna, změny chronologicky, uvnitř okna po fragmentu
    const p35 = dossier.paragraphs[1];
    expect(p35.windows).toBe(2);
    expect(p35.changes.map((c) => [c.windowFrom, c.fragment])).toEqual([
      ["2019-01-01", "§ 35ba odst. 1 písm. a)"],
      ["2021-01-01", "§ 35ba odst. 1 písm. a)"],
      ["2021-01-01", "§ 35ba odst. 1 písm. b)"],
    ]);
  });

  it("dedupes identical diff windows carried by multiple bills amending the same statute", () => {
    const shared = diff({});
    const d = data([
      bill({ tiskId: 1, cislo: 10, paragraphDiffs: [shared] }),
      bill({ tiskId: 2, cislo: 20, paragraphDiffs: [shared] }),
    ]);
    const dossier = deriveStatuteDossier(d, "586/1992")!;
    expect(dossier.coverage.windows).toBe(1);
    expect(dossier.coverage.changes).toBe(1);
  });

  it("ignores diffs of other statutes and routes non-§ fragments to the residual group, last", () => {
    const d = data([
      bill({
        paragraphDiffs: [
          diff({ parScope: "Příloha", hunks: [{ fragment: "Příloha č. 1", op: "added", before: null, after: "text" }] }),
          diff({ law: "40/2009", parScope: "§ 88", hunks: [{ fragment: "§ 88", op: "modified", before: "a", after: "b" }] }),
          diff({ parScope: "§ 35c", hunks: [{ fragment: "§ 35c odst. 1", op: "modified", before: "a", after: "b" }] }),
        ],
      }),
    ]);
    const dossier = deriveStatuteDossier(d, "586/1992")!;
    expect(dossier.paragraphs.map((p) => p.key)).toEqual(["35c", "ostatni"]);
    expect(dossier.paragraphs[1].label).toBe("mimo §");
  });

  it("paragraphKeyOrder: numeric-first natural order, residual last", () => {
    expect(["ostatni", "88", "9", "35ba", "35c"].sort(paragraphKeyOrder)).toEqual([
      "9",
      "35ba",
      "35c",
      "88",
      "ostatni",
    ]);
  });
});

/* ── kandidáti okna (vyhlášené pravidlo) ─────────────────────────────── */

describe("window candidates — (from, to] on the publication date, never authorship", () => {
  it("includes enacted trail bills strictly after windowFrom and up to windowTo inclusive", () => {
    const d = data([
      bill({ tiskId: 1, cislo: 10, fateSb: "1/2021", fatePublishedOn: "2021-01-01" }), // == from → OUT
      bill({ tiskId: 2, cislo: 20, fateSb: "2/2022", fatePublishedOn: "2022-06-30" }), // in
      bill({ tiskId: 3, cislo: 30, fateSb: "3/2023", fatePublishedOn: "2024-01-01" }), // == to → IN
      bill({ tiskId: 4, cislo: 40, fateSb: "4/2024", fatePublishedOn: "2024-01-02" }), // after → OUT
      bill({ tiskId: 5, cislo: 50 }), // not enacted → OUT
      bill({ tiskId: 9, cislo: 90, paragraphDiffs: [diff({})] }),
    ]);
    const dossier = deriveStatuteDossier(d, "586/1992")!;
    const change = dossier.paragraphs[0].changes[0];
    expect(change.candidates.map((c) => c.tiskId)).toEqual([2, 3]); // chronologicky
    expect(dossier.coverage.changesWithCandidates).toBe(1);
  });

  it("a window with no enacted bill honestly has zero candidates", () => {
    const d = data([bill({ paragraphDiffs: [diff({})] })]);
    const dossier = deriveStatuteDossier(d, "586/1992")!;
    expect(dossier.paragraphs[0].changes[0].candidates).toEqual([]);
    expect(dossier.coverage.changesWithCandidates).toBe(0);
  });
});

/* ── rejstřík ────────────────────────────────────────────────────────── */

describe("statute registry", () => {
  it("aggregates title+census refs, counts §-changes once per window, sorts by trail size then ref", () => {
    const shared = diff({});
    const d = data([
      bill({ tiskId: 1, cislo: 10, paragraphDiffs: [shared], amendedLawsFull: ["586/1992", "117/1995"] }),
      bill({ tiskId: 2, cislo: 20, paragraphDiffs: [shared] }),
      bill({ tiskId: 3, cislo: 30, amendedLaws: [amendedLaw("40/2009")], fateSb: "5/2023", fatePublishedOn: "2023-01-01" }),
    ]);
    const rows = listStatuteRegistry(d);
    // numerické řazení ref: 40 < 117
    expect(rows.map((r) => r.ref)).toEqual(["586/1992", "40/2009", "117/1995"]);
    const dane = rows[0];
    expect(dane).toMatchObject({ slug: "586-1992", trailBills: 2, enactedBills: 0, changes: 1 });
    expect(rows[1]).toMatchObject({ enactedBills: 1 });
    expect(rows[2]).toMatchObject({ trailBills: 1, changes: 0, label: "zákon č. 117/1995 Sb." });
  });

  it("is deterministic under input reordering", () => {
    const bills = [
      bill({ tiskId: 1, cislo: 10, amendedLawsFull: ["117/1995"] }),
      bill({ tiskId: 2, cislo: 20, amendedLaws: [amendedLaw("40/2009")] }),
      bill({ tiskId: 3, cislo: 30 }),
    ];
    const a = listStatuteRegistry(data(bills));
    const b = listStatuteRegistry(data([...bills].reverse()));
    expect(b).toEqual(a);
  });
});
