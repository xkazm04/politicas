// Deník důkazů — pins the pure feed derivation (batch 2C): chronological
// ordering with a deterministic tiebreak, `z-<id>` anchors, gated copy (the
// reviewer's raw note must NEVER surface), registry links, and the
// forensic-sign-off filter (pending_review is working material, not a record).

import { describe, expect, it } from "vitest";
import {
  DECISION_CS,
  deriveEvidenceFeed,
  evidenceAnchor,
  evidenceHref,
  icoFromDst,
  isPublishedForensic,
  pspIdFromSrc,
  receiptHrefFor,
  withheldForensic,
  type AuditRowLike,
  type EvidenceFeedInput,
  type ForensicSignoffLike,
} from "./deriveFeed";
import { decodeClaimRef } from "@/features/shared/provenance/claimRef";

const row = (over: Partial<AuditRowLike>): AuditRowLike => ({
  id: "a1",
  src: "psp:person:6543",
  rel: "linked_to",
  dst: "kg:company:04544152",
  decision: "confirm",
  reviewer: "recenzent",
  note: "TAJNÁ pracovní poznámka — nesmí ven",
  decidedAt: "2026-07-20T10:00:00.000Z",
  priorState: "pending_review",
  chainPos: 7,
  rowHash: "b1946ac92492d2347c6235b4d2611184",
  ...over,
});

const input = (over: Partial<EvidenceFeedInput>): EvidenceFeedInput => ({
  audit: [],
  nodeLabels: new Map(),
  tieSources: new Map(),
  forensic: [],
  ...over,
});

describe("deriveEvidenceFeed — ordering", () => {
  it("sorts newest first, id ascending on equal timestamps, regardless of input order", () => {
    const a = row({ id: "b", decidedAt: "2026-07-20T10:00:00.000Z" });
    const b = row({ id: "a", decidedAt: "2026-07-20T10:00:00.000Z" });
    const c = row({ id: "c", decidedAt: "2026-07-21T09:00:00.000Z" });
    const one = deriveEvidenceFeed(input({ audit: [a, b, c] }));
    const two = deriveEvidenceFeed(input({ audit: [c, b, a] }));
    expect(one.map((e) => e.id)).toEqual(["c", "a", "b"]);
    expect(two).toEqual(one); // deterministic: input order is irrelevant
  });
});

describe("deriveEvidenceFeed — anchors & ids", () => {
  it("derives the public anchor as z-<id> (batch anchor convention #z-<id>)", () => {
    const [e] = deriveEvidenceFeed(input({ audit: [row({ id: "5f3a" })] }));
    expect(e.id).toBe("5f3a");
    expect(e.anchor).toBe("z-5f3a");
  });

  it("gives a signed forensic verdict a tisk-scoped stable id", () => {
    const f: ForensicSignoffLike = {
      tiskId: 812,
      cislo: 812,
      title: "Novela zákona X",
      severity: "high",
      reviewState: "verified",
      signedAt: "2026-07-19T08:00:00.000Z",
    };
    const [e] = deriveEvidenceFeed(input({ forensic: [f] }));
    expect(e.id).toBe("tisk-812");
    expect(e.anchor).toBe("z-tisk-812");
    expect(e.internalHref).toBe("/zakony/812");
  });
});

describe("deriveEvidenceFeed — gated copy", () => {
  it("names both endpoints from node labels and speaks only the gated decision copy", () => {
    const labels = new Map([
      ["psp:person:6543", "Jan Novák"],
      ["kg:company:04544152", "Alfa s.r.o."],
    ]);
    const [e] = deriveEvidenceFeed(input({ audit: [row({})], nodeLabels: labels }));
    expect(e.subjectCs).toBe("Jan Novák ↔ Alfa s.r.o.");
    expect(e.decisionCs).toBe(DECISION_CS.confirm);
  });

  it("NEVER leaks the reviewer's raw note into any published field", () => {
    const [e] = deriveEvidenceFeed(input({ audit: [row({})] }));
    const published = JSON.stringify(e);
    expect(published).not.toContain("TAJNÁ");
    expect(published).not.toContain("poznámka");
  });

  it("degrades to node ids when a label is missing — honest, never invented", () => {
    const [e] = deriveEvidenceFeed(input({ audit: [row({})] }));
    expect(e.subjectCs).toBe("psp:person:6543 ↔ kg:company:04544152");
  });

  it("covers all three audit decisions with distinct Czech copy", () => {
    const feed = deriveEvidenceFeed(
      input({
        audit: [
          row({ id: "a", decision: "confirm" }),
          row({ id: "b", decision: "reject" }),
          row({ id: "c", decision: "needs-more" }),
        ],
      }),
    );
    const copies = new Set(feed.map((e) => e.decisionCs));
    expect(copies.size).toBe(3);
  });
});

describe("deriveEvidenceFeed — evidence links", () => {
  it("builds primary-registry links from the tie's IČO and cites the verbatim edge source", () => {
    const sources = new Map([["psp:person:6543→kg:company:04544152", "hlídač-státu:osoba/jan-novak"]]);
    const [e] = deriveEvidenceFeed(input({ audit: [row({})], tieSources: sources }));
    expect(e.links.map((l) => l.label)).toEqual(["ARES VR", "Hlídač státu", "Registr smluv"]);
    expect(e.links.every((l) => l.href.includes("04544152"))).toBe(true);
    expect(e.sourceCs).toContain("hlídač-státu:osoba/jan-novak");
    expect(e.internalHref).toBe("/poslanec/6543");
  });

  it("emits no registry links when the dst carries no IČO", () => {
    const [e] = deriveEvidenceFeed(input({ audit: [row({ dst: "kg:organ:senat" })] }));
    expect(e.links).toEqual([]);
  });
});

describe("deriveEvidenceFeed — forensic gate", () => {
  it("publishes only verdicts a human flipped to verified; pending stays unpublished", () => {
    const pending: ForensicSignoffLike = {
      tiskId: 1,
      cislo: 1,
      title: "Pending",
      severity: "high",
      reviewState: "pending_review",
      signedAt: null,
    };
    const signed: ForensicSignoffLike = { ...pending, tiskId: 2, cislo: 2, title: "Signed", reviewState: "verified" };
    const feed = deriveEvidenceFeed(input({ forensic: [pending, signed] }));
    expect(feed.map((e) => e.id)).toEqual(["tisk-2"]);
  });
});

describe("evidenceAnchor / evidenceHref — JEDEN vlastník tvaru z-<id>", () => {
  // Deník republiky odkazuje rozhodnutí brány sem, pod TÝMŽ id řádku
  // review_audit. Druhá šablona `z-`/`/dukazy#` na jeho straně by byla
  // permalink, který se rozejde potichu — proto kodek žije tady a tam se
  // importuje. Tenhle test drží obě půlky u sebe.
  it("kotva je z-<id> a adresa je /dukazy# nad TOUŽ kotvou", () => {
    expect(evidenceAnchor("5f3a")).toBe("z-5f3a");
    expect(evidenceHref("5f3a")).toBe(`/dukazy#${evidenceAnchor("5f3a")}`);
  });

  it("obojí platí pro OBA druhy záznamu — vazbu i podepsaný posudek", () => {
    const feed = deriveEvidenceFeed(
      input({
        audit: [row({ id: "5f3a" })],
        forensic: [
          {
            tiskId: 812,
            cislo: 812,
            title: "Novela zákona X",
            severity: "high",
            reviewState: "verified",
            signedAt: "2026-07-19T08:00:00.000Z",
          },
        ],
      }),
    );
    for (const e of feed) {
      expect(e.anchor, e.id).toBe(evidenceAnchor(e.id));
      expect(evidenceHref(e.id), e.id).toBe(`/dukazy#${e.anchor}`);
    }
  });
});

describe("mpPspId — klíč, kterým se lze zeptat deníku republiky", () => {
  it("záznam o vazbě nese pspId ze svého src uzlu", () => {
    const [e] = deriveEvidenceFeed(input({ audit: [row({})] }));
    expect(e.mpPspId).toBe(6543);
  });

  it("nečitelný src uzel dá null — id se nerekonstruuje", () => {
    const [e] = deriveEvidenceFeed(input({ audit: [row({ src: "kg:organ:senat" })] }));
    expect(e.mpPspId).toBeNull();
    expect(e.internalHref).toBeNull();
  });

  it("podepsaný posudek nese null — den v deníku republiky nemá", () => {
    // Deník nese smlouvy, role, kroky tisku, bránu a change eventy — podepsaný
    // forenzní posudek žádným z nich není, takže žádný jeho den neexistuje.
    const [e] = deriveEvidenceFeed(
      input({
        forensic: [
          {
            tiskId: 812,
            cislo: 812,
            title: "Novela zákona X",
            severity: "high",
            reviewState: "verified",
            signedAt: "2026-07-19T08:00:00.000Z",
          },
        ],
      }),
    );
    expect(e.mpPspId).toBeNull();
  });
});

describe("id helpers", () => {
  it("parses pspId and IČO from the graph urns, rejecting foreign shapes", () => {
    expect(pspIdFromSrc("psp:person:6543")).toBe(6543);
    expect(pspIdFromSrc("kg:company:123")).toBeNull();
    expect(icoFromDst("kg:company:04544152")).toBe("04544152");
    expect(icoFromDst("kg:organ:senat")).toBeNull();
  });
});

/* ── co filtr zahodil, se počítá ────────────────────────────────────────────── */

describe("withheldForensic — fronta u brány je fakt, ne prázdno", () => {
  const f = (over: Partial<ForensicSignoffLike>): ForensicSignoffLike => ({
    tiskId: 1,
    cislo: 1,
    title: "Novela",
    severity: "high",
    reviewState: "pending_review",
    signedAt: null,
    ...over,
  });

  it("počítá přesně to, co publikační pravidlo nepustilo ven", () => {
    const forensic = [
      f({ tiskId: 1 }),
      f({ tiskId: 2 }),
      f({ tiskId: 3, reviewState: "verified" }),
      f({ tiskId: 4, reviewState: "withheld" }),
    ];
    const published = deriveEvidenceFeed(input({ forensic }));
    const withheld = withheldForensic(forensic);
    // Dvě strany jednoho pravidla se musí sečíst na celek — kdyby se rozešly,
    // věstník by tvrdil, že nezadržuje nic, a přitom zadržoval.
    expect(published).toHaveLength(1);
    expect(withheld.total).toBe(3);
    expect(published.length + withheld.total).toBe(forensic.length);
  });

  it("vypisuje stavy VERBATIM a deterministicky (stav vzestupně)", () => {
    const withheld = withheldForensic([
      f({ tiskId: 1, reviewState: "withheld" }),
      f({ tiskId: 2, reviewState: "pending_review" }),
      f({ tiskId: 3, reviewState: "pending_review" }),
    ]);
    expect(withheld.byState).toEqual([
      { state: "pending_review", count: 2 },
      { state: "withheld", count: 1 },
    ]);
  });

  it("prázdná vrstva zadržuje nula — a nezadržuje ani podepsané posudky", () => {
    expect(withheldForensic([])).toEqual({ total: 0, byState: [] });
    expect(withheldForensic([f({ reviewState: "verified" })]).total).toBe(0);
  });

  it("JEDNO publikační pravidlo pro obě strany", () => {
    expect(isPublishedForensic(f({ reviewState: "verified" }))).toBe(true);
    expect(isPublishedForensic(f({ reviewState: "pending_review" }))).toBe(false);
  });
});

/* ── řetěz brány a trvalá účtenka ───────────────────────────────────────────── */

describe("řetěz a účtenka — čím se rozhodnutí dá nezávisle ověřit", () => {
  it("záznam o vazbě nese pozici v řetězu a otisk vlastního řádku", () => {
    const [e] = deriveEvidenceFeed(input({ audit: [row({ chainPos: 42, rowHash: "deadbeef" })] }));
    expect(e.chainPos).toBe(42);
    expect(e.rowHash).toBe("deadbeef");
  });

  it("nezřetězený řádek pozici NEDOSTANE vymyšlenou", () => {
    const [e] = deriveEvidenceFeed(input({ audit: [row({ chainPos: null, rowHash: null })] }));
    expect(e.chainPos).toBeNull();
    expect(e.rowHash).toBeNull();
  });

  it("účtenka se skládá JEDINOU gramatikou a dekóduje se zpátky na tutéž hranu", () => {
    const [e] = deriveEvidenceFeed(input({ audit: [row({})] }));
    expect(e.receiptHref).toBe(receiptHrefFor("psp:person:6543", "linked_to", "kg:company:04544152"));
    const encoded = e.receiptHref!.replace("/zdroj/", "");
    expect(decodeClaimRef(encoded)).toEqual({
      kind: "edge",
      src: "psp:person:6543",
      rel: "linked_to",
      dst: "kg:company:04544152",
    });
  });

  it("účtenka cituje relaci ŘÁDKU, ne natvrdo linked_to", () => {
    const [e] = deriveEvidenceFeed(input({ audit: [row({ rel: "owns_stake" })] }));
    const back = decodeClaimRef(e.receiptHref!.replace("/zdroj/", ""));
    expect(back).toMatchObject({ rel: "owns_stake" });
  });

  it("konec, který kanonickou adresu neunese, ji NEDOSTANE (odmítnutí tvarem)", () => {
    expect(receiptHrefFor("", "linked_to", "kg:company:1")).toBeNull();
    expect(receiptHrefFor("psp:person:1", "", "kg:company:1")).toBeNull();
    // Adresa delší než strop kodeku se nedá dekódovat zpátky → žádný odkaz.
    expect(receiptHrefFor("psp:person:1", "linked_to", "x".repeat(600))).toBeNull();
  });

  it("firma dostane svůj spis přes kanonické IČO; cizí tvar dst žádný", () => {
    const [e] = deriveEvidenceFeed(input({ audit: [row({ dst: "company:ico:2867681" })] }));
    expect(e.companyHref).toBe("/penize/firma/02867681");
    const [x] = deriveEvidenceFeed(input({ audit: [row({ dst: "kg:organ:senat" })] }));
    expect(x.companyHref).toBeNull();
  });

  it("podepsaný posudek řetěz ani účtenku netvrdí — v review_audit není", () => {
    const [e] = deriveEvidenceFeed(
      input({
        forensic: [
          {
            tiskId: 812,
            cislo: 812,
            title: "Novela zákona X",
            severity: "high",
            reviewState: "verified",
            signedAt: "2026-07-19T08:00:00.000Z",
          },
        ],
      }),
    );
    expect(e.chainPos).toBeNull();
    expect(e.rowHash).toBeNull();
    expect(e.receiptHref).toBeNull();
    expect(e.companyHref).toBeNull();
  });
});
