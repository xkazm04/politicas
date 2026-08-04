import { describe, expect, it } from "vitest";
import type { IssuedFigure } from "@/lib/claims/registry";
import type { ProvenanceReceipt } from "@/features/shared/provenance/receipt";
import type { DetectedRef } from "./refDetect";
import {
  exponatVerdict,
  figuraVerdict,
  grafVerdict,
  neznamyVerdict,
  verdictGate,
  verdictHeadlineKey,
  verdictLeadKey,
  verdictTone,
  VERDICT_COPY_KEYS,
  zdrojVerdict,
} from "./verdict";

const FIGURE: IssuedFigure = {
  claim: {
    ref: "claim:d:m",
    dataset: "d",
    metric: "m",
    unit: "%",
    retrievedAt: "2026-07-30",
    reviewStatus: "pending",
  },
  kind: "dec",
  value: 78.3,
  issuedAt: "/svedectvi",
};

const figuraDet = (pastedValue: number | null): Extract<DetectedRef, { family: "figura" }> => ({
  family: "figura",
  ref: "claim:d:m",
  parts: { dataset: "d", metric: "m" },
  pasted:
    pastedValue === null
      ? null
      : { value: pastedValue, retrievedAt: "2026-06-01", dataset: "d", metric: "m", unit: "%", status: "pending" },
});

const RECEIPT: ProvenanceReceipt = {
  kind: "edge",
  ref: "h.abc.def.ghi",
  subject: { id: "a", kind: "person", label: "Osoba A", citable: null, links: [] },
  rel: "linked_to",
  relLabel: "má vazbu na",
  object: { id: "b", kind: "company", label: "Firma B", citable: null, links: [] },
  weight: 0.87,
  provenance: { pass: 4, method: "verdict", ref: null, computedAt: "2026-07-01T00:00:00Z" },
  gate: { status: "pending_review", reviewer: null, reviewedAt: null, note: null, audit: [] },
};

describe("verdikt figury", () => {
  it("shodná hodnota → verified s oběma stranami", () => {
    const v = figuraVerdict(figuraDet(78.3), FIGURE);
    expect(v.kind).toBe("verified");
    if (v.family === "figura" && v.kind === "verified") {
      expect(v.citedValue).toBe(78.3);
      expect(v.citedDate).toBe("2026-06-01");
    }
  });

  it("odlišná hodnota → moved s citovanou i dnešní hodnotou a daty", () => {
    const v = figuraVerdict(figuraDet(79.5), FIGURE);
    expect(v.kind).toBe("moved");
    if (v.family === "figura" && v.kind === "moved") {
      expect(v.citedValue).toBe(79.5);
      expect(v.figure.value).toBe(78.3);
      expect(v.citedDate).toBe("2026-06-01");
      expect(v.figure.claim.retrievedAt).toBe("2026-07-30");
    }
  });

  it("holý ref bez hodnoty → verified (vstup nic netvrdil, jen se ptal)", () => {
    const v = figuraVerdict(figuraDet(null), FIGURE);
    expect(v.kind).toBe("verified");
    if (v.family === "figura" && v.kind === "verified") expect(v.citedValue).toBeNull();
  });

  it("figura mimo rejstřík → unknown, nikdy dosazená hodnota", () => {
    const v = figuraVerdict(figuraDet(78.3), null);
    expect(v).toEqual({ family: "figura", kind: "unknown", reason: "mimo-rejstrik", ref: "claim:d:m" });
  });
});

describe("verdikt účtenky (/zdroj)", () => {
  it("záznam v dnešním grafu → verified s účtenkou", () => {
    const v = zdrojVerdict("h.abc.def.ghi", { status: "ok", receipt: RECEIPT });
    expect(v.kind).toBe("verified");
    if (v.family === "zdroj" && v.kind === "verified") {
      expect(v.receipt.kind).toBe("edge");
    }
  });

  it("gone → unknown (záznam-nenalezen); invalid → unknown (nerozluštitelný)", () => {
    expect(zdrojVerdict("h.x.y.z", { status: "gone", ref: "h.x.y.z" })).toEqual({
      family: "zdroj",
      kind: "unknown",
      reason: "zaznam-nenalezen",
      encoded: "h.x.y.z",
    });
    expect(zdrojVerdict("blbost", { status: "invalid" })).toEqual({
      family: "zdroj",
      kind: "unknown",
      reason: "nerozlustitelny",
      encoded: "blbost",
    });
  });
});

describe("verdikt otiskových rodin (graf, exponát)", () => {
  const fresh = { urlHash: "0a1b2c3d", currentHash: "0a1b2c3d", fresh: true };
  const stale = { urlHash: "0a1b2c3d", currentHash: "ffff0000", fresh: false };

  it("shodný otisk → verified", () => {
    const v = grafVerdict("g.xxx.0a1b2c3d", {
      status: "ok",
      view: fresh,
      title: "Peníze kolem poslanců",
      currentDate: "2026-07-30",
    });
    expect(v.kind).toBe("verified");
    if (v.family === "graf" && v.kind === "verified") {
      expect(v.view.citedHash).toBe(v.view.currentHash);
    }
  });

  it("rozdílný otisk → moved s OBĚMA otisky a datem dnešního odvození", () => {
    const v = exponatVerdict("rez.0a1b2c3d", {
      status: "ok",
      view: stale,
      title: "výřez velína (stav republiky)",
      currentDate: "2026-07-30",
    });
    expect(v.kind).toBe("moved");
    if (v.family === "exponat" && v.kind === "moved") {
      expect(v.view.citedHash).toBe("0a1b2c3d");
      expect(v.view.currentHash).toBe("ffff0000");
      expect(v.view.currentDate).toBe("2026-07-30");
    }
  });

  it("gone/invalid → unknown s rozlišeným důvodem", () => {
    expect(grafVerdict("g.x.00000000", { status: "gone" }).kind).toBe("unknown");
    expect(exponatVerdict("rez.zzz", { status: "invalid" })).toMatchObject({
      kind: "unknown",
      reason: "nerozlustitelny",
    });
  });
});

describe("stav lidské brány je modifikátor verdiktu, ne verdikt", () => {
  const receiptWithGate = (status: "verified" | "pending_review" | "rejected"): ProvenanceReceipt => ({
    ...RECEIPT,
    gate: { status, reviewer: null, reviewedAt: null, note: null, audit: [] },
  });
  const zdroj = (status: "verified" | "pending_review" | "rejected") =>
    zdrojVerdict("h.abc.def.ghi", { status: "ok", receipt: receiptWithGate(status) });

  it("zamítnutá hrana: verdikt zůstává trojslovný, ale titulek NENÍ potvrzení", () => {
    const v = zdroj("rejected");
    // Slovník se nerozšířil — hrana v grafu je, tedy verified.
    expect(v.kind).toBe("verified");
    // Titulek zamítnuté hrany je VLASTNÍ klíč, ne klíč potvrzení. (Že ta věta
    // není potvrzením, hlídá v obou jazycích messages.test.ts.)
    expect(verdictHeadlineKey(v)).toBe("verdict.headlineZdrojRejected");
    expect(verdictHeadlineKey(v)).not.toBe(verdictHeadlineKey(zdroj("verified")));
    expect(verdictTone(v)).toBe("gated-rejected");
    expect(verdictGate(v)).toMatchObject({ kind: "gated", info: { status: "rejected" } });
    expect(verdictLeadKey(v)).toBe("verdict.leadZdrojRejected");
  });

  it("hrana čekající na kontrolu se nečte jako doložené tvrzení", () => {
    const v = zdroj("pending_review");
    expect(verdictHeadlineKey(v)).toBe("verdict.headlineZdrojPending");
    expect(verdictHeadlineKey(v)).not.toBe(verdictHeadlineKey(zdroj("verified")));
    expect(verdictTone(v)).toBe("gated-pending");
    expect(verdictLeadKey(v)).toBe("verdict.leadZdrojPending");
  });

  it("hrana potvrzená člověkem drží nezeslabené „ověřeno“", () => {
    const v = zdroj("verified");
    expect(verdictHeadlineKey(v)).toBe("verdict.headlineZdrojVerified");
    expect(verdictTone(v)).toBe("confirmed");
    expect(verdictGate(v)).toMatchObject({ kind: "gated", info: { status: "verified" } });
  });

  it("negated záznam (bez brány) je ungated, ne „ověřeno člověkem“", () => {
    const v = zdrojVerdict("h.abc.def.ghi", { status: "ok", receipt: { ...RECEIPT, gate: null } });
    expect(verdictGate(v)).toEqual({ kind: "ungated" });
    expect(verdictHeadlineKey(v)).toBe("verdict.headlineZdrojVerified");
    expect(verdictLeadKey(v)).toBe("verdict.leadZdrojUngated");
  });

  it("figura nese stav claimu (chybějící = pending), otiskové rodiny jsou ungated", () => {
    expect(verdictGate(figuraVerdict(figuraDet(78.3), FIGURE))).toMatchObject({
      kind: "gated",
      info: { status: "pending_review", token: "pending" },
    });
    const graf = grafVerdict("g.x.0a1b2c3d", {
      status: "ok",
      view: { urlHash: "0a1b2c3d", currentHash: "0a1b2c3d", fresh: true },
      title: "t",
      currentDate: "2026-07-30",
    });
    expect(verdictGate(graf)).toEqual({ kind: "ungated" });
    expect(verdictGate(neznamyVerdict("nepodporovany"))).toBeNull();
  });
});

// Copy sama žije v messages/{cs,en}.json — tady se drží MAPOVÁNÍ verdiktu na
// klíč. Že klíč nese správnou větu v obou jazycích, hlídá messages.test.ts.
describe("mapování verdiktu na klíč copy", () => {
  it("tři tituly, nic čtvrtého", () => {
    expect(verdictHeadlineKey(figuraVerdict(figuraDet(78.3), FIGURE))).toBe("verdict.headlineVerified");
    expect(verdictHeadlineKey(figuraVerdict(figuraDet(1), FIGURE))).toBe("verdict.headlineMoved");
    expect(verdictHeadlineKey(neznamyVerdict("nepodporovany"))).toBe("verdict.headlineUnknown");
  });

  it("naše plocha bez citace má VLASTNÍ důvod, ne „není politicas odkaz“", () => {
    expect(neznamyVerdict("politicas-neni-citace").kind).toBe("unknown");
    expect(verdictHeadlineKey(neznamyVerdict("politicas-neni-citace"))).toBe("verdict.headlineAppRoute");
    expect(verdictLeadKey(neznamyVerdict("politicas-neni-citace"))).toBe("verdict.leadAppRoute");
    expect(verdictLeadKey(neznamyVerdict("politicas-neni-citace"))).not.toBe(
      verdictLeadKey(neznamyVerdict("nepodporovany")),
    );
  });

  it("každý důvod „unknown“ má vlastní klíč — žádný se nesdílí", () => {
    const reasons = [
      "prazdny",
      "prilis-dlouhy",
      "nerozlustitelny",
      "politicas-neni-citace",
      "nepodporovany",
    ] as const;
    const keys = reasons.map((r) => verdictLeadKey(neznamyVerdict(r)));
    expect(new Set(keys).size).toBe(reasons.length);
  });

  it("vyjmenované klíče pokrývají každou větev verdiktu", () => {
    const all = [
      figuraVerdict(figuraDet(78.3), FIGURE),
      figuraVerdict(figuraDet(null), FIGURE),
      figuraVerdict(figuraDet(1), FIGURE),
      figuraVerdict(figuraDet(1), null),
      zdrojVerdict("h.a.b.c", { status: "ok", receipt: RECEIPT }),
      zdrojVerdict("h.a.b.c", { status: "gone", ref: "h.a.b.c" }),
      grafVerdict("g.x.0a1b2c3d", {
        status: "ok",
        view: { urlHash: "0a1b2c3d", currentHash: "ffff0000", fresh: false },
        title: "t",
        currentDate: "2026-07-30",
      }),
      grafVerdict("g.x.0a1b2c3d", {
        status: "ok",
        view: { urlHash: "0a1b2c3d", currentHash: "0a1b2c3d", fresh: true },
        title: "t",
        currentDate: "2026-07-30",
      }),
      neznamyVerdict("prazdny"),
      neznamyVerdict("prilis-dlouhy"),
      neznamyVerdict("nerozlustitelny"),
      neznamyVerdict("politicas-neni-citace"),
      neznamyVerdict("nepodporovany"),
    ];
    for (const v of all) {
      expect(VERDICT_COPY_KEYS, verdictHeadlineKey(v)).toContain(verdictHeadlineKey(v));
      expect(VERDICT_COPY_KEYS, verdictLeadKey(v)).toContain(verdictLeadKey(v));
    }
  });
});
