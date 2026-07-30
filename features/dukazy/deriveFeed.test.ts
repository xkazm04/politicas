// Deník důkazů — pins the pure feed derivation (batch 2C): chronological
// ordering with a deterministic tiebreak, `z-<id>` anchors, gated copy (the
// reviewer's raw note must NEVER surface), registry links, and the
// forensic-sign-off filter (pending_review is working material, not a record).

import { describe, expect, it } from "vitest";
import {
  DECISION_CS,
  deriveEvidenceFeed,
  icoFromDst,
  pspIdFromSrc,
  type AuditRowLike,
  type EvidenceFeedInput,
  type ForensicSignoffLike,
} from "./deriveFeed";

const row = (over: Partial<AuditRowLike>): AuditRowLike => ({
  id: "a1",
  src: "psp:person:6543",
  dst: "kg:company:04544152",
  decision: "confirm",
  reviewer: "recenzent",
  note: "TAJNÁ pracovní poznámka — nesmí ven",
  decidedAt: "2026-07-20T10:00:00.000Z",
  priorState: "pending_review",
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

describe("id helpers", () => {
  it("parses pspId and IČO from the graph urns, rejecting foreign shapes", () => {
    expect(pspIdFromSrc("psp:person:6543")).toBe(6543);
    expect(pspIdFromSrc("kg:company:123")).toBeNull();
    expect(icoFromDst("kg:company:04544152")).toBe("04544152");
    expect(icoFromDst("kg:organ:senat")).toBeNull();
  });
});
