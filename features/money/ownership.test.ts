/*
 * VLASTNICKÁ STRUKTURA — pravidla projekce, držená na fixtures postavených podle
 * ŽIVÉHO grafu (33 hran `owns_stake`, 47 uzlů, průchod 28; anotace zaniklých IČO
 * z průchodu 39).
 *
 * Co se tu hlídá, je pořád totéž: že blok neexistuje, dokud není co ukázat; že
 * ukončený zápis se nedá přečíst jako dnešní vlastnictví; že zaniklé IČO nikdy
 * neprojde jako doložený subjekt; a že žádná ztráta neodejde potichu.
 */

import { describe, expect, it } from "vitest";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";
import { projectOwnership, sourceFileLabel, successorIcoFrom } from "./ownership";

const SUBJECT = "company:ico:26185610";

function node(id: string, label: string, props: Record<string, unknown> = {}): KgNodeRow {
  return { id, kind: "company", label, props, firstSeenPass: 1, provenance: {} } as unknown as KgNodeRow;
}

function edge(src: string, dst: string, props: Record<string, unknown>, pass = 28): KgEdgeRow {
  return {
    src,
    rel: "owns_stake",
    dst,
    weight: null,
    props,
    provenance: {
      ref: "case-money/batch-006 · dataor indirect-ownership slice (O-money-3)",
      pass,
      track: "money",
      method: "verdict",
      computedAt: "2026-07-25",
    },
  } as unknown as KgEdgeRow;
}

/** Živá hrana: Město Plzeň → Plzeňské městské dopravní podniky, otevřený zápis. */
const PLZEN_EDGE = edge("company:ico:00075370", "company:ico:25220683", {
  role: "jediný akcionář",
  share: 100,
  from: "2013-09-04",
  to: null,
  source: "https://dataor.justice.cz/api/file/as-full-plzen-2026.csv.gz",
  periods: [{}, {}],
  multi_period_merged: true,
});

/** Živá anotace zaniklého předchůdce AGROFERTu (průchod 39). */
const EXTINCT_ANCESTOR = node("company:ico:25130072", "AGROFERT HOLDING, a.s.", {
  ico: "25130072",
  ico_unresolvable_in_ares: true,
  ico_check_result: "NENALEZENO on both ARES endpoints (2026-07-27) — reproduced independently",
  ico_checked_endpoints: [
    "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/25130072",
    "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/25130072",
  ],
  extinction_reason: "fúze",
  merged_into: "company:ico:26185610 (AGROFERT, a.s.)",
  merged_on: "2004-08-31",
  successor_candidate: "company:ico:26185610 (AGROFERT, a.s. — existuje, ověřeno v ARES 2026-07-27)",
  not_an_anomaly: true,
  analyst_note_cs:
    "IČO 25130072 (AGROFERT HOLDING, a.s.) zaniklo fúzí do společnosti AGROFERT, a.s. … POZOR na záměnu.",
  ico_check_provenance: { pass: 39, computedAt: "2026-07-27T11:28:27.128Z" },
});

const AGROFERT_NODES = new Map<string, KgNodeRow>([
  [EXTINCT_ANCESTOR.id, EXTINCT_ANCESTOR],
  ["company:ico:60197773", node("company:ico:60197773", "AGROFERT a.s.", { ico_unresolvable_in_ares: true })],
  ["company:ico:60108916", node("company:ico:60108916", "Synthesia, a.s.")],
  ["company:ico:26124459", node("company:ico:26124459", "IMOBA, a.s.")],
]);

/** Živý tvar okolí AGROFERTu: dva zaniklí předchůdci nahoře, dvě dcery dole. */
const AGROFERT_EDGES: KgEdgeRow[] = [
  edge("company:ico:25130072", SUBJECT, {
    role: "jediný akcionář",
    share: 100,
    from: "2002-06-20",
    to: "2004-08-31",
    source: "https://dataor.justice.cz/api/file/as-full-praha-2026.csv.gz",
    periods: [{}],
    multi_period_merged: false,
  }),
  edge("company:ico:60197773", SUBJECT, {
    role: "jediný akcionář",
    share: 100,
    from: "2004-08-31",
    to: "2005-06-30",
    source: "https://dataor.justice.cz/api/file/as-full-praha-2026.csv.gz",
    periods: [{}],
    multi_period_merged: false,
  }),
  edge(SUBJECT, "company:ico:60108916", {
    role: "jediný akcionář",
    share: 100,
    from: "2013-10-17",
    to: "2024-02-01",
    source: "https://dataor.justice.cz/api/file/as-full-praha-2026.csv.gz",
    periods: [{}, {}],
    multi_period_merged: true,
  }),
  edge(SUBJECT, "company:ico:26124459", {
    role: "jediný akcionář",
    share: 100,
    from: "2008-08-14",
    to: "2014-01-30",
    source: "https://dataor.justice.cz/api/file/as-full-praha-2026.csv.gz",
    periods: [{}],
    multi_period_merged: false,
  }),
];

describe("projectOwnership", () => {
  it("a company with no owns_stake edge gets NO block — absent, not empty", () => {
    expect(projectOwnership({ companyId: SUBJECT, edges: [], nodeById: new Map() })).toBeNull();
    // …a ani name_history samo o sobě blok neotevře: není co vlastnicky ukázat.
    expect(
      projectOwnership({
        companyId: SUBJECT,
        companyProps: { name_history_cs: "Tatáž právnická osoba nesla postupně názvy…" },
        edges: [],
        nodeById: new Map(),
      }),
    ).toBeNull();
  });

  it("reads both directions off one edge set: inbound = owners, outbound = subsidiaries", () => {
    const s = projectOwnership({ companyId: SUBJECT, edges: AGROFERT_EDGES, nodeById: AGROFERT_NODES })!;
    expect(s.owners.map((r) => r.counterpartId)).toEqual([
      "company:ico:60197773",
      "company:ico:25130072",
    ]);
    expect(s.subsidiaries.map((r) => r.counterpartId)).toEqual([
      "company:ico:60108916",
      "company:ico:26124459",
    ]);
    expect(s.owners.every((r) => r.direction === "owner")).toBe(true);
    expect(s.subsidiaries.every((r) => r.direction === "subsidiary")).toBe(true);
  });

  it("orders each direction by entry start descending, ties broken by counterpart id ascending", () => {
    const a = edge("company:ico:00000001", SUBJECT, { from: "2010-01-01", to: null });
    const b = edge("company:ico:00000002", SUBJECT, { from: "2010-01-01", to: null });
    const c = edge("company:ico:00000003", SUBJECT, { from: "2020-01-01", to: null });
    const d = edge("company:ico:00000004", SUBJECT, { to: null }); // bez `from`
    const nodes = new Map(
      [a, b, c, d].map((e) => [e.src, node(e.src, e.src)] as const),
    );
    const s = projectOwnership({ companyId: SUBJECT, edges: [d, b, a, c], nodeById: nodes })!;
    expect(s.owners.map((r) => r.counterpartId)).toEqual([
      "company:ico:00000003",
      "company:ico:00000001",
      "company:ico:00000002",
      "company:ico:00000004",
    ]);
  });

  it("an open period is open and a closed one is history — the row never guesses a tense", () => {
    const s = projectOwnership({
      companyId: "company:ico:25220683",
      edges: [PLZEN_EDGE],
      nodeById: new Map([["company:ico:00075370", node("company:ico:00075370", "Město Plzeň")]]),
    })!;
    const [row] = s.owners;
    expect(row.open).toBe(true);
    expect(row.to).toBeNull();
    expect(row.from).toBe("2013-09-04");
    expect(row.sharePct).toBe(100);
    expect(row.role).toBe("jediný akcionář");
    // Rejstřík vede u tohohle vztahu dvě období a nahoře je poslední z nich.
    expect(row.periodCount).toBe(2);
    expect(row.multiPeriodMerged).toBe(true);

    const closed = projectOwnership({ companyId: SUBJECT, edges: AGROFERT_EDGES, nodeById: AGROFERT_NODES })!;
    expect(closed.owners.every((r) => r.open === false)).toBe(true);
    expect(closed.subsidiaries.every((r) => r.open === false)).toBe(true);
  });

  it("carries the stored NENALEZENO annotation verbatim, dated and with its pass", () => {
    const s = projectOwnership({ companyId: SUBJECT, edges: AGROFERT_EDGES, nodeById: AGROFERT_NODES })!;
    const ancestor = s.owners.find((r) => r.counterpartId === "company:ico:25130072")!;
    const a = ancestor.annotation!;
    expect(a.unresolvableInAres).toBe(true);
    expect(a.extinctionReason).toBe("fúze");
    expect(a.mergedInto).toBe("company:ico:26185610 (AGROFERT, a.s.)");
    expect(a.mergedIntoIco).toBe("26185610");
    expect(a.mergedOn).toBe("2004-08-31");
    expect(a.notAnomaly).toBe(true);
    expect(a.checkedEndpoints).toHaveLength(2);
    expect(a.pass).toBe(39);
    expect(a.recordedAt).toBe("2026-07-27T11:28:27.128Z");
    // Doslovnost: próza projde nezkrácená a nepřepsaná.
    expect(a.analystNoteCs).toBe(EXTINCT_ANCESTOR.props.analyst_note_cs);
    expect(a.checkResult).toBe(EXTINCT_ANCESTOR.props.ico_check_result);
  });

  it("a counterpart the register DOES carry gets no annotation capsule at all", () => {
    const s = projectOwnership({ companyId: SUBJECT, edges: AGROFERT_EDGES, nodeById: AGROFERT_NODES })!;
    expect(s.subsidiaries.every((r) => r.annotation === null)).toBe(true);
  });

  it("only a canonical company id yields a link target; anything else refuses one", () => {
    const odd = edge("psp:person:6150", SUBJECT, { from: "2020-01-01", to: null });
    const s = projectOwnership({
      companyId: SUBJECT,
      edges: [odd],
      nodeById: new Map([["psp:person:6150", node("psp:person:6150", "Andrej Babiš")]]),
    })!;
    expect(s.owners[0].counterpartIco).toBeNull();
  });

  it("a missing counterpart node drops the row and is COUNTED, never silent", () => {
    const s = projectOwnership({
      companyId: SUBJECT,
      edges: AGROFERT_EDGES,
      nodeById: new Map([["company:ico:60108916", node("company:ico:60108916", "Synthesia, a.s.")]]),
    })!;
    expect(s.owners).toHaveLength(0);
    expect(s.subsidiaries).toHaveLength(1);
    expect(s.droppedUnresolved).toBe(3);
  });

  it("edges of another relation, and edges that do not touch this company, are ignored", () => {
    const foreign = { ...edge("company:ico:00000009", "company:ico:00000008", { from: "2020-01-01" }) };
    const supplies = { ...edge("company:ico:00000007", SUBJECT, { from: "2020-01-01" }), rel: "supplies" };
    expect(
      projectOwnership({
        companyId: SUBJECT,
        edges: [foreign, supplies] as KgEdgeRow[],
        nodeById: new Map([
          ["company:ico:00000009", node("company:ico:00000009", "A")],
          ["company:ico:00000007", node("company:ico:00000007", "B")],
        ]),
      }),
    ).toBeNull();
  });

  it("reports the pass only when every drawn row agrees on it", () => {
    const uniform = projectOwnership({ companyId: SUBJECT, edges: AGROFERT_EDGES, nodeById: AGROFERT_NODES })!;
    expect(uniform.pass).toBe(28);

    const mixed = projectOwnership({
      companyId: SUBJECT,
      edges: [AGROFERT_EDGES[0], edge(SUBJECT, "company:ico:26124459", { from: "2008-08-14" }, 41)],
      nodeById: AGROFERT_NODES,
    })!;
    expect(mixed.pass).toBeNull();
  });

  it("a share that is not a number is ABSENT, never zero", () => {
    const nonNumeric = edge("company:ico:00075370", SUBJECT, {
      role: "člen představenstva",
      share: null,
      from: "2018-01-01",
      to: null,
    });
    const s = projectOwnership({
      companyId: SUBJECT,
      edges: [nonNumeric],
      nodeById: new Map([["company:ico:00075370", node("company:ico:00075370", "Město Plzeň")]]),
    })!;
    expect(s.owners[0].sharePct).toBeNull();
  });

  it("passes the subject's own verbatim name history through when the node carries one", () => {
    const s = projectOwnership({
      companyId: SUBJECT,
      companyProps: { name_history_cs: "AGFTRADING, a.s. → AGROFERT HOLDING, a.s. → AGROFERT, a.s." },
      edges: AGROFERT_EDGES,
      nodeById: AGROFERT_NODES,
    })!;
    expect(s.subjectNameHistoryCs).toBe("AGFTRADING, a.s. → AGROFERT HOLDING, a.s. → AGROFERT, a.s.");
    expect(
      projectOwnership({ companyId: SUBJECT, edges: AGROFERT_EDGES, nodeById: AGROFERT_NODES })!
        .subjectNameHistoryCs,
    ).toBeNull();
  });
});

describe("sourceFileLabel", () => {
  it("labels an http(s) source with its file name", () => {
    expect(sourceFileLabel("https://dataor.justice.cz/api/file/as-full-plzen-2026.csv.gz")).toBe(
      "as-full-plzen-2026.csv.gz",
    );
  });

  it("refuses a label for anything that is not a URL — the surface prints it verbatim instead", () => {
    expect(sourceFileLabel("dataor.justice.cz bulk ISVR export")).toBeNull();
    expect(sourceFileLabel(null)).toBeNull();
  });
});

describe("successorIcoFrom", () => {
  it("reads the node id PREFIX, never a number found in the company name", () => {
    expect(successorIcoFrom("company:ico:26185610 (AGROFERT, a.s.)")).toBe("26185610");
    expect(successorIcoFrom("AGROFERT, a.s. 26185610")).toBeNull();
    expect(successorIcoFrom("psp:person:6150 (Andrej Babiš)")).toBeNull();
    expect(successorIcoFrom(null)).toBeNull();
  });
});
