import { describe, expect, it } from "vitest";
import type { IssuedFigure } from "@/lib/claims/registry";
import type { ProvenanceReceipt } from "@/features/shared/provenance/receipt";
import type { DetectedRef } from "./refDetect";
import {
  exponatVerdict,
  figuraVerdict,
  grafVerdict,
  neznamyVerdict,
  verdictHeadline,
  verdictLead,
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

describe("česká copy verdiktu", () => {
  it("tři titulky, nic čtvrtého", () => {
    expect(verdictHeadline(figuraVerdict(figuraDet(78.3), FIGURE))).toContain("Ověřeno");
    expect(verdictHeadline(figuraVerdict(figuraDet(1), FIGURE))).toContain("pohnula");
    expect(verdictHeadline(neznamyVerdict("nepodporovany"))).toContain("Neznámý");
  });

  it("lead pro volný text říká hranici produktu výslovně", () => {
    expect(verdictLead(neznamyVerdict("nepodporovany"))).toContain("nefactcheckuje");
  });

  it("lead pro moved otiskové rodiny přiznává chybějící datum vydání", () => {
    const v = grafVerdict("g.x.0a1b2c3d", {
      status: "ok",
      view: { urlHash: "0a1b2c3d", currentHash: "ffff0000", fresh: false },
      title: "t",
      currentDate: "2026-07-30",
    });
    expect(verdictLead(v)).toContain("Datum vydání citace adresa nenese");
  });
});
