import { describe, expect, it } from "vitest";
import { claimRefPath, edgeClaimRef, nodeClaimRef } from "@/features/shared/provenance/claimRef";
import {
  czkCompact,
  deriveTerminalGraph,
  deriveTerminalLedger,
  logStamp,
  mergeTailLog,
  type TailChangeLike,
  type TailReviewLike,
  type TerminalTieLike,
} from "./terminalModel";

// ── fixtures ────────────────────────────────────────────────────────────────

function tie(over: Partial<TerminalTieLike>): TerminalTieLike {
  return {
    srcId: "psp:person:100",
    dstId: "company:ico:11111111",
    pspId: 100,
    mpName: "Alena Testová",
    club: "TST",
    ico: "11111111",
    company: "Firma A s.r.o.",
    role: "jednatel",
    reviewState: "verified",
    tieClass: "owner-operator",
    contractCount: 3,
    contractCzk: 4_200_000,
    subsidiesCzk: 0,
    source: "hlidac:osoby/alena-testova · 2016-01-01–ongoing",
    ...over,
  };
}

const VERIFIED_A = tie({});
const VERIFIED_B = tie({
  srcId: "psp:person:200",
  dstId: "company:ico:22222222",
  pspId: 200,
  mpName: "Bohumil Vzorek",
  club: null,
  ico: "22222222",
  company: "Firma B a.s.",
  tieClass: "manager",
  contractCount: 0,
  contractCzk: 0,
  subsidiesCzk: 900_000,
});
const PENDING_BIG = tie({
  srcId: "psp:person:300",
  dstId: "company:ico:33333333",
  pspId: 300,
  mpName: "Cyril Čekající",
  ico: "33333333",
  company: "Firma C s.r.o.",
  reviewState: "pending_review",
  contractCzk: 999_000_000,
});
const REJECTED = tie({
  srcId: "psp:person:400",
  dstId: "company:ico:44444444",
  pspId: 400,
  ico: "44444444",
  company: "Firma D s.r.o.",
  reviewState: "rejected",
});

// ── verified-only disciplína ────────────────────────────────────────────────

describe("deriveTerminalGraph — verified-only disciplína", () => {
  it("do grafu vstupují VÝHRADNĚ ověřené vazby; čekající a zamítnuté se jen počítají", () => {
    const g = deriveTerminalGraph([VERIFIED_A, PENDING_BIG, REJECTED, VERIFIED_B]);
    expect(g.verifiedCount).toBe(2);
    expect(g.pendingCount).toBe(1);
    expect(g.rejectedCount).toBe(1);
    expect(g.shownTies).toBe(2);
    // Čekající vazba s 999M CZK se NIKDE nevykreslí — ani uzel, ani hrana.
    const everything = JSON.stringify(g.nodes) + JSON.stringify(g.edges);
    expect(everything).not.toContain("Firma C");
    expect(everything).not.toContain("33333333");
    expect(everything).not.toContain("Firma D");
    // Součet peněz jde POUZE přes ověřené vazby.
    expect(g.verifiedCzk).toBe(4_200_000 + 900_000);
  });

  it("bez jediné ověřené vazby je graf poctivě prázdný (žádný fallback uvnitř modelu)", () => {
    const g = deriveTerminalGraph([PENDING_BIG, REJECTED]);
    expect(g.nodes).toEqual([]);
    expect(g.edges).toEqual([]);
    expect(g.shownTies).toBe(0);
    expect(g.pendingCount).toBe(1);
    expect(g.rejectedCount).toBe(1);
  });

  it("deterministické: týž vstup v libovolném pořadí → byte-identický výstup", () => {
    const a = deriveTerminalGraph([VERIFIED_A, VERIFIED_B, PENDING_BIG]);
    const b = deriveTerminalGraph([PENDING_BIG, VERIFIED_B, VERIFIED_A]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("deriveTerminalGraph — citační afordance", () => {
  it("hrana vazby nese účtenku /zdroj/<h.…> složenou sdíleným kodekem", () => {
    const g = deriveTerminalGraph([VERIFIED_A]);
    const tieEdge = g.edges.find((e) => e.from === `p:${VERIFIED_A.srcId}`);
    expect(tieEdge?.href).toBe(
      claimRefPath(edgeClaimRef(VERIFIED_A.srcId, "linked_to", VERIFIED_A.dstId)),
    );
    const company = g.nodes.find((n) => n.kind === "company");
    expect(company?.href).toBe(claimRefPath(nodeClaimRef(VERIFIED_A.dstId)));
    const person = g.nodes.find((n) => n.kind === "person");
    expect(person?.href).toBe("/penize/100");
  });

  it("peněžní uzel vzniká jen při contractCzk > 0 a míří do registru smluv", () => {
    const g = deriveTerminalGraph([VERIFIED_A, VERIFIED_B]);
    const moneyNodes = g.nodes.filter((n) => n.kind === "money");
    expect(moneyNodes).toHaveLength(1); // B má 0 CZK smluv → bez peněžního uzlu
    expect(moneyNodes[0].id).toBe(`m:${VERIFIED_A.dstId}`);
    expect(moneyNodes[0].href).toContain("hlidacstatu.cz");
    expect(moneyNodes[0].label).toBe("4,2 mil. Kč");
  });

  it("osoba s vyššími dosažitelnými penězi řadí své řádky výš (menší y)", () => {
    const g = deriveTerminalGraph([VERIFIED_B, VERIFIED_A]);
    const companyA = g.nodes.find((n) => n.id === `c:${VERIFIED_A.dstId}`);
    const companyB = g.nodes.find((n) => n.id === `c:${VERIFIED_B.dstId}`);
    expect(companyA && companyB && companyA.y < companyB.y).toBe(true);
  });
});

describe("deriveTerminalLedger", () => {
  it("verified-only + peníze DESC + účtenka a paket na řádku", () => {
    const rows = deriveTerminalLedger([VERIFIED_B, PENDING_BIG, VERIFIED_A, REJECTED]);
    expect(rows.map((r) => r.ico)).toEqual(["11111111", "22222222"]);
    expect(rows[0].receiptHref).toBe(
      claimRefPath(edgeClaimRef(VERIFIED_A.srcId, "linked_to", VERIFIED_A.dstId)),
    );
    expect(rows[0].paketHref).toBe("/penize/100/paket");
    expect(rows[0].czkCs).toBe("4,2 mil. Kč");
  });

  it("bez čitelného pspId nemá řádek paket (null, ne vymyšlená adresa)", () => {
    const rows = deriveTerminalLedger([tie({ srcId: "kg:person:x", pspId: null })]);
    expect(rows[0].paketHref).toBeNull();
  });
});

// ── tail-log ────────────────────────────────────────────────────────────────

const REVIEWS: TailReviewLike[] = [
  { id: "b-audit", decision: "confirm", decidedAt: "2026-07-28T09:14:05Z", mp: "Alena Testová", company: "Firma A s.r.o." },
  { id: "a-audit", decision: "reject", decidedAt: "2026-07-28T09:14:05Z", mp: "Bohumil Vzorek", company: "Firma B a.s." },
];

function change(over: Partial<TailChangeLike>): TailChangeLike {
  return {
    id: "chev:tie-new:psp:person:100|company:ico:11111111",
    eventType: "tie-new",
    recordedAt: "2026-07-28T10:00:00Z",
    src: "psp:person:100",
    dst: "company:ico:11111111",
    srcLabel: "Alena Testová",
    dstLabel: "Firma A s.r.o.",
    pending: true,
    ...over,
  };
}

describe("mergeTailLog — slévání a řazení", () => {
  it("řadí čas záznamu DESC, id ASC uvnitř téhož okamžiku (deterministický tiebreak)", () => {
    const lines = mergeTailLog({ reviews: REVIEWS, changes: [change({})] });
    expect(lines.map((l) => l.id)).toEqual([
      "chev:tie-new:psp:person:100|company:ico:11111111", // 10:00
      "a-audit", // 09:14:05, id ASC
      "b-audit",
    ]);
  });

  it("review-decision a mandate/role change eventy se NEPŘEBÍRAJÍ (duplikát brány)", () => {
    const lines = mergeTailLog({
      reviews: [],
      changes: [
        change({ id: "chev:review-decision:x", eventType: "review-decision" }),
        change({ id: "chev:mandate-new:y", eventType: "mandate-new" }),
        change({ id: "chev:contract-new:z", eventType: "contract-new" }),
      ],
    });
    expect(lines.map((l) => l.id)).toEqual(["chev:contract-new:z"]);
  });

  it("rozhodnutí brány odkazuje na kotvu /dukazy#z-<id>; vazba na účtenku hrany", () => {
    const lines = mergeTailLog({ reviews: [REVIEWS[0]], changes: [change({})] });
    const review = lines.find((l) => l.id === "b-audit");
    expect(review?.href).toBe("/dukazy#z-b-audit");
    expect(review?.flag).toBe("vazba ověřena");
    expect(review?.tone).toBe("green");
    const tieNew = lines.find((l) => l.id.startsWith("chev:tie-new"));
    expect(tieNew?.href).toBe(
      claimRefPath(edgeClaimRef("psp:person:100", "linked_to", "company:ico:11111111")),
    );
    expect(tieNew?.flag).toBe("čeká na lidskou bránu");
  });

  it("contract-new mluví hlasem registru smluv a odkazuje na supplies účtenku", () => {
    const [line] = mergeTailLog({
      reviews: [],
      changes: [
        change({
          id: "chev:contract-new:c",
          eventType: "contract-new",
          src: "company:ico:11111111",
          dst: "contract:abc",
          srcLabel: "Firma A s.r.o.",
          dstLabel: "Údržba silnic 2025",
        }),
      ],
    });
    expect(line.source).toBe("registr smluv → graf");
    expect(line.text).toBe("smlouva v grafu: Údržba silnic 2025 ← Firma A s.r.o.");
    expect(line.href).toBe(claimRefPath(edgeClaimRef("company:ico:11111111", "supplies", "contract:abc")));
  });

  it("event bez endpointů nemá odkaz (null, ne vymyšlená adresa) a chybějící label degraduje na id", () => {
    const [line] = mergeTailLog({
      reviews: [],
      changes: [change({ src: null, srcLabel: null, dstLabel: null })],
    });
    expect(line.href).toBeNull();
    expect(line.text).toContain("company:ico:11111111");
  });

  it("strop řeže po seřazení (nejnovější řádky přežijí) a nerozluštitelný čas padá nakonec", () => {
    const lines = mergeTailLog(
      {
        reviews: REVIEWS,
        changes: [change({}), change({ id: "chev:broken", recordedAt: "neplatné" })],
      },
      2,
    );
    expect(lines).toHaveLength(2);
    expect(lines[0].id).toBe("chev:tie-new:psp:person:100|company:ico:11111111");
    const all = mergeTailLog({
      reviews: REVIEWS,
      changes: [change({}), change({ id: "chev:broken", recordedAt: "neplatné" })],
    });
    expect(all[all.length - 1].id).toBe("chev:broken");
  });

  it("deterministické: týž vstup v libovolném pořadí → byte-identický výstup", () => {
    const changes = [change({}), change({ id: "chev:contract-new:z", eventType: "contract-new" })];
    const a = mergeTailLog({ reviews: REVIEWS, changes });
    const b = mergeTailLog({ reviews: [...REVIEWS].reverse(), changes: [...changes].reverse() });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ── formátování ─────────────────────────────────────────────────────────────

describe("czkCompact / logStamp", () => {
  it("české kompaktní peníze, deterministicky", () => {
    expect(czkCompact(4_200_000)).toBe("4,2 mil. Kč");
    expect(czkCompact(1_250_000_000)).toBe("1,3 mld. Kč");
    expect(czkCompact(350_000)).toBe("350 tis. Kč");
    expect(czkCompact(900)).toBe("900 Kč");
    expect(czkCompact(Number.NaN)).toBe("—");
  });

  it("logStamp: datum + čas z ISO otisku; bez času jen datum", () => {
    expect(logStamp("2026-07-28T09:14:05Z")).toBe("28. 7. 2026 09:14:05");
    expect(logStamp("2026-07-28")).toBe("28. 7. 2026");
  });
});
