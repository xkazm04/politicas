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

  it("NAŠE plocha bez citace má vlastní důvod, ne „není politicas odkaz“", () => {
    for (const path of [
      "/penize/firma/46347534",
      "/penize/6881",
      "/poslanec/6881",
      "/zebricek",
      "/zakony/58",
      "https://politicas.cz/penize/firma/46347534",
    ]) {
      expect(detectRef(path), path).toEqual({ family: "neznamy", reason: "politicas-neni-citace" });
    }
  });

  it("cizí origin naší plochou není ani na shodné cestě", () => {
    expect(detectRef("https://example.com/penize/firma/46347534")).toEqual({
      family: "neznamy",
      reason: "nepodporovany",
    });
    expect(detectRef("/neexistujici-routa")).toEqual({ family: "neznamy", reason: "nepodporovany" });
  });

  it("malformovaný token známé rodiny → nerozluštitelný", () => {
    expect(detectRef("claim:jen-dataset")).toEqual({ family: "neznamy", reason: "nerozlustitelny" });
    expect(detectRef("u.%%%")).toEqual({ family: "neznamy", reason: "nerozlustitelny" });
    expect(detectRef("g.!!!.xx")).toEqual({ family: "neznamy", reason: "nerozlustitelny" });
    expect(detectRef("rez.nenihex")).toEqual({ family: "neznamy", reason: "nerozlustitelny" });
  });
});

/* ── brána pozná sama sebe ─────────────────────────────────────────────────── */

describe("adresa brány — /overeni?ref=<citace>", () => {
  // Tohle JE adresa, kterou produkt vydává pod „ověřit tuto citaci"
  // (ReceiptPage, MoneySection, ProfilePage, ExhibitPage, návod na /overeni)
  // a o které stránka tvrdí, že se dá sdílet. Do 2026-08-12 na ni brána
  // odpovídala „naše stránka, ale ne citovatelná adresa".
  const receipt = edgeClaimRef("psp:person:6881", "linked_to", "company:ico:46347534");

  it("vložená zpátky dá TUTÉŽ odpověď jako vložená citace — všechny tvary adresy", () => {
    const direct = detectRef(FIGURE_CLAIM.ref);
    for (const address of [
      `https://politicas.cz/overeni?ref=${encodeURIComponent(FIGURE_CLAIM.ref)}`,
      `/overeni?ref=${encodeURIComponent(FIGURE_CLAIM.ref)}`,
      `http://localhost:3000/overeni?ref=${encodeURIComponent(FIGURE_CLAIM.ref)}`,
      // …i s kotvou, kterou k odkazu přidává návod (OvereniPage), a s cizím
      // parametrem, který se po cestě nabalí
      `/overeni?ref=${encodeURIComponent(FIGURE_CLAIM.ref)}#verdikt`,
      `/overeni?utm_source=x&ref=${encodeURIComponent(FIGURE_CLAIM.ref)}`,
    ]) {
      expect(detectRef(address), address).toEqual(direct);
    }
  });

  it("rozbalí každou rodinu, ne jen figuru", () => {
    const zdroj = detectRef(`/overeni?ref=${encodeURIComponent(`/zdroj/${receipt}`)}`);
    expect(zdroj.family).toBe("zdroj");
    if (zdroj.family === "zdroj") expect(zdroj.encoded).toBe(receipt);
    // holý token rodiny v parametru (bez cesty) taky
    expect(detectRef(`/overeni?ref=${encodeURIComponent(receipt)}`).family).toBe("zdroj");
    const exponat = detectRef(`/overeni?ref=${encodeURIComponent(encodeExhibitId({ kind: "rez", hash: "0a1b2c3d" }))}`);
    expect(exponat.family).toBe("exponat");
  });

  it("dvojitě zakódovaný parametr se rozbalí JEDNOU a nezacyklí se", () => {
    // Rozbalení má hloubku 1: druhá vrstva escapů zůstane doslova a skončí
    // poctivým „nepodporováno", ne dalším kolem dekódování.
    const twice = `/overeni?ref=${encodeURIComponent(encodeURIComponent(`/zdroj/${receipt}`))}`;
    expect(detectRef(twice)).toEqual({ family: "neznamy", reason: "nepodporovany" });
    // …a brána zabalená v bráně je zacyklení, ne citace: vnitřní /overeni už
    // dopadne jako každá jiná naše plocha bez citace.
    const nested = `/overeni?ref=${encodeURIComponent(`/overeni?ref=${encodeURIComponent(FIGURE_CLAIM.ref)}`)}`;
    expect(detectRef(nested)).toEqual({ family: "neznamy", reason: "politicas-neni-citace" });
  });

  it("brána bez použitelné citace zůstává „naše plocha, ne citace“", () => {
    for (const address of [
      "/overeni",
      "/overeni?ref=",
      "/overeni?ref=%20",
      "/overeni?vstup=claim:x:y", // parametr, který routa nečte
      "https://politicas.cz/overeni?jinyparametr=1",
    ]) {
      expect(detectRef(address), address).toEqual({
        family: "neznamy",
        reason: "politicas-neni-citace",
      });
    }
  });

  it("nerozluštitelná citace v parametru je nerozluštitelná, ne „není citace“", () => {
    expect(detectRef("/overeni?ref=claim%3Ajen-dataset")).toEqual({
      family: "neznamy",
      reason: "nerozlustitelny",
    });
  });

  it("cizí origin na téže cestě se chová jako dřív", () => {
    expect(detectRef(`https://example.com/overeni?ref=${encodeURIComponent(FIGURE_CLAIM.ref)}`)).toEqual({
      family: "neznamy",
      reason: "nepodporovany",
    });
  });
});

/* ── znaková třída cest ────────────────────────────────────────────────────── */

describe("PATH_PATTERNS pokrývají celou abecedu kodeků", () => {
  it("base64url („-“ i „_“) přežije cestu i celé URL", () => {
    // claimRef.ts kóduje base64url, jehož abeceda končí „-_“. Kdyby znaková
    // třída v PATH_PATTERNS „_“ nenesla, useklo by se to na prvním podtržítku
    // a adresa by odpověděla o JINÉM tvrzení, než jaké čtenář vložil.
    // Vstup je vybraný tak, aby ZAKÓDOVANÁ podoba nesla obojí: „-“ i „_“ jsou
    // v base64url hodnoty 62 a 63, tj. vzniknou jen z konkrétních bajtů (tady
    // z tildy a české diakritiky). Náhodné id je skoro nikdy neobsahuje, takže
    // díra ve znakové třídě by se bez tohohle vstupu neprojevila.
    const withUnderscore = nodeClaimRef("psp:person:~ďá");
    expect(withUnderscore).toContain("-");
    expect(withUnderscore).toContain("_");
    for (const address of [
      `/zdroj/${withUnderscore}`,
      `https://politicas.cz/zdroj/${withUnderscore}#kotva`,
      `/overeni?ref=${encodeURIComponent(`/zdroj/${withUnderscore}`)}`,
    ]) {
      const det = detectRef(address);
      expect(det.family, address).toBe("zdroj");
      if (det.family === "zdroj") expect(det.encoded).toBe(withUnderscore);
    }
  });
});
