import { describe, expect, it } from "vitest";
import { claimDataAttributes, makeClaimRef, type Claim } from "@/lib/claims/claim";
import { edgeClaimRef, nodeClaimRef } from "@/features/shared/provenance/claimRef";
import { encodeGraphRef } from "@/features/graph/permalink";
import { encodeExhibitId } from "@/features/dashboard/exhibit";
import { detectRef, MAX_INPUT_LENGTH } from "./refDetect";

const FIGURE_CLAIM: Claim = {
  ref: makeClaimRef({ dataset: "psp.cz — jmenovitá hlasování", metric: "prumerna-dochazka" }),
  dataset: "psp.cz — jmenovitá hlasování",
  metric: "prumerna-dochazka",
  unit: "%",
  retrievedAt: "2026-07-30",
  reviewStatus: "pending",
};

/** Payload přesně v podobě, v jaké ho sází CitableNumber do DOM. */
function domPayload(claim: Claim, value: number): string {
  const attrs = Object.entries(claimDataAttributes(claim, value))
    .map(([k, v]) => `${k}="${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`)
    .join(" ");
  return `<data value="${value}" ${attrs} class="tabular-nums">78,3</data>`;
}

describe("detekce rodiny — holé adresy", () => {
  it("claim-ref → figura bez opsané hodnoty", () => {
    const det = detectRef(FIGURE_CLAIM.ref);
    expect(det.family).toBe("figura");
    if (det.family === "figura") {
      expect(det.parts.metric).toBe("prumerna-dochazka");
      expect(det.pasted).toBeNull();
    }
  });

  it("účtenka původu (uzel i hrana) → zdroj", () => {
    const node = detectRef(nodeClaimRef("osoba-123"));
    expect(node.family).toBe("zdroj");
    const edge = detectRef(edgeClaimRef("osoba-123", "linked_to", "firma-456"));
    expect(edge.family).toBe("zdroj");
    if (edge.family === "zdroj" && edge.ref.kind === "edge") {
      expect(edge.ref.rel).toBe("linked_to");
    }
  });

  it("citace grafu → graf, exponát → exponat", () => {
    const g = detectRef(encodeGraphRef({ kind: "uzel", variant: "mapa", node: "osoba-1" }, "0a1b2c3d"));
    expect(g.family).toBe("graf");
    const e = detectRef(encodeExhibitId({ kind: "rez", hash: "0a1b2c3d" }));
    expect(e.family).toBe("exponat");
  });
});

describe("detekce rodiny — celé URL a cesty", () => {
  it("plné URL s originem se rozpozná podle cesty", () => {
    const ref = nodeClaimRef("osoba-123");
    const det = detectRef(`https://politicas.cz/zdroj/${ref}?utm_source=x#kotva`);
    expect(det.family).toBe("zdroj");
    if (det.family === "zdroj") expect(det.encoded).toBe(ref);
  });

  it("holá cesta /graf/p/… i /dashboard/exponat/…", () => {
    const gref = encodeGraphRef({ kind: "trasa", variant: "mapa", trail: "penize-poslancu" }, "00000000");
    expect(detectRef(`/graf/p/${gref}`).family).toBe("graf");
    const eref = encodeExhibitId({ kind: "fakt", factId: "fact-1", hash: "00000000" });
    expect(detectRef(`/dashboard/exponat/${eref}`).family).toBe("exponat");
  });

  it("rozluštitelná cesta s nerozluštitelným segmentem → neznámý (nerozlustitelny)", () => {
    const det = detectRef("/zdroj/x.nesmysl");
    expect(det).toEqual({ family: "neznamy", reason: "nerozlustitelny" });
    expect(detectRef("/graf/p/g.%%%.zz")).toEqual({ family: "neznamy", reason: "nerozlustitelny" });
  });
});

describe("detekce rodiny — data-claim payload", () => {
  it("zkopírovaný <data> element nese ref i hodnotu", () => {
    const det = detectRef(domPayload(FIGURE_CLAIM, 78.3));
    expect(det.family).toBe("figura");
    if (det.family === "figura") {
      expect(det.ref).toBe(FIGURE_CLAIM.ref);
      expect(det.pasted?.value).toBe(78.3);
      expect(det.pasted?.retrievedAt).toBe("2026-07-30");
      expect(det.pasted?.status).toBe("pending");
      // HTML entity v datasetu se dekódují zpět
      expect(det.pasted?.dataset).toBe("psp.cz — jmenovitá hlasování");
    }
  });

  it("payload s apostrofy místo uvozovek projde také", () => {
    const det = detectRef(`<data value='200' data-claim-ref='${FIGURE_CLAIM.ref}' data-claim-value='200'>200</data>`);
    expect(det.family).toBe("figura");
    if (det.family === "figura") expect(det.pasted?.value).toBe(200);
  });

  it("payload s nevalidním claim-ref se odmítne", () => {
    expect(detectRef('<span data-claim-ref="nesmysl" data-claim-value="1">1</span>')).toEqual({
      family: "neznamy",
      reason: "nerozlustitelny",
    });
  });
});

describe("hranice produktu — co brána nepřijímá", () => {
  it("prázdný vstup", () => {
    expect(detectRef("")).toEqual({ family: "neznamy", reason: "prazdny" });
    expect(detectRef("   ")).toEqual({ family: "neznamy", reason: "prazdny" });
  });

  it("předlouhý vstup", () => {
    expect(detectRef("a".repeat(MAX_INPUT_LENGTH + 1))).toEqual({
      family: "neznamy",
      reason: "prilis-dlouhy",
    });
  });

  it("volný text NENÍ fact-check — poctivé nepodporováno", () => {
    expect(detectRef("Poslanec X hlasoval proti zákonu Y a lhal o tom.")).toEqual({
      family: "neznamy",
      reason: "nepodporovany",
    });
    expect(detectRef("https://example.com/clanek")).toEqual({
      family: "neznamy",
      reason: "nepodporovany",
    });
  });

  it("malformovaný token známé rodiny → nerozluštitelný", () => {
    expect(detectRef("claim:jen-dataset")).toEqual({ family: "neznamy", reason: "nerozlustitelny" });
    expect(detectRef("u.%%%")).toEqual({ family: "neznamy", reason: "nerozlustitelny" });
    expect(detectRef("g.!!!.xx")).toEqual({ family: "neznamy", reason: "nerozlustitelny" });
    expect(detectRef("rez.nenihex")).toEqual({ family: "neznamy", reason: "nerozlustitelny" });
  });
});
