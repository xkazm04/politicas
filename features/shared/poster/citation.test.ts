import { describe, expect, it } from "vitest";

import { buildPosterCitation, posterDisplayUrl, posterUndatedNote } from "./citation";

describe("posterDisplayUrl — papír nenese protokolový šum", () => {
  it("strips the protocol and the trailing slash", () => {
    expect(posterDisplayUrl("https://politicas.cz/zebricek/")).toBe("politicas.cz/zebricek");
    expect(posterDisplayUrl("http://politicas.cz")).toBe("politicas.cz");
  });

  it("keeps the path and query untouched otherwise", () => {
    expect(posterDisplayUrl("https://psp.cz/sqw/hlasovani.sqw?o=10")).toBe(
      "psp.cz/sqw/hlasovani.sqw?o=10",
    );
  });

  it("leaves a bare host alone and trims whitespace", () => {
    expect(posterDisplayUrl("  politicas.cz/zebricek  ")).toBe("politicas.cz/zebricek");
  });
});

describe("buildPosterCitation — archivní patička je kanonická, ne ruční", () => {
  const input = {
    sourceLabel: "psp.cz — hlasování, tisky, členství ve výborech",
    sourceUrl: "https://politicas.cz/zebricek/",
    retrievedAt: "2026-07-30",
    methodology: "index přispění, šest vážených složek (25/20/20/15/10/10)",
    provenancePass: 42,
  };

  it("builds all four lines in Czech with the ČSN date", () => {
    const c = buildPosterCitation(input);
    expect(c.sourceLine).toBe("zdroj: psp.cz — hlasování, tisky, členství ve výborech");
    expect(c.retrievedLine).toBe(
      "stav dat ke dni 30. 7. 2026 — plakát je datovaný otisk, čísla se v čase mění",
    );
    expect(c.methodologyLine).toBe(
      "metodika: index přispění, šest vážených složek (25/20/20/15/10/10) · výpočetní pas 42",
    );
    expect(c.liveLine).toBe("živá verze: politicas.cz/zebricek");
    expect(c.displayUrl).toBe("politicas.cz/zebricek");
  });

  it("omits the provenance-pass suffix when the pass is unknown — never fabricates one", () => {
    for (const provenancePass of [null, undefined, Number.NaN]) {
      const c = buildPosterCitation({ ...input, provenancePass });
      expect(c.methodologyLine).toBe(
        "metodika: index přispění, šest vážených složek (25/20/20/15/10/10)",
      );
    }
  });

  it("renders a malformed date as the — placeholder, never NaN", () => {
    const c = buildPosterCitation({ ...input, retrievedAt: "brzy" });
    expect(c.retrievedLine).toContain("stav dat ke dni —");
    expect(c.retrievedLine).not.toContain("NaN");
  });

  it("is deterministic — same input, same lines (the poster is reproducible)", () => {
    expect(buildPosterCitation(input)).toEqual(buildPosterCitation(input));
  });
});

// Arch je DATOVANÝ OTISK, a do 2026-08-12 datoval sám sebe: routa /kraj/[kraj]
// posílala do `retrievedAt` `new Date()`, takže každý výtisk inzeroval dnešek nad
// čísly z dávkového přepočtu. Den se teď bere z komorové provenience a když ji
// komora nemá jednotnou, arch to ŘEKNE — mlčení ani „—" nerozliší pokažené datum
// od data, které zdroj poctivě nezná.
describe("buildPosterCitation — arch datuje data, ne okamžik tisku", () => {
  const input = {
    sourceLabel: "psp.cz",
    sourceUrl: "https://politicas.cz/kraj/jihomoravsky",
    retrievedAt: "2026-08-04",
    methodology: "index přispění, šest vážených složek",
    provenancePass: 42,
  };

  it("posterUndatedNote mlčí nad dnem a mluví nad jeho absencí", () => {
    expect(posterUndatedNote("2026-08-04")).toBeNull();
    for (const missing of [null, undefined, ""]) {
      const note = posterUndatedNote(missing);
      expect(note, String(missing)).toBeTruthy();
      expect(note).toContain("nenahradil ho dnem tisku");
    }
  });

  it("bez dne to řekne v obou řádcích a NEVYTISKNE žádné datum", () => {
    const c = buildPosterCitation({ ...input, retrievedAt: null });
    expect(c.retrievedAt).toBe("");
    expect(c.retrievedLine).toContain("záznam neuvádí jednotně");
    expect(c.methodologyLine).toContain("nenahradil ho dnem tisku");
    // Nejtvrdší podmínka: na archu bez doloženého dne nesmí stát ŽÁDNÉ datum —
    // ani dnešní. Kdyby se `new Date()` vrátil kudykoli zpátky, padne to tady.
    const today = new Date();
    for (const line of [c.retrievedLine, c.methodologyLine]) {
      expect(line).not.toMatch(/\d{1,2}\. \d{1,2}\. \d{4}/);
      expect(line).not.toContain(String(today.getFullYear()));
    }
  });

  it("se dnem se chová jako dřív — datum, žádná omluvná věta", () => {
    const c = buildPosterCitation(input);
    expect(c.retrievedAt).toBe("2026-08-04");
    expect(c.retrievedLine).toBe(
      "stav dat ke dni 4. 8. 2026 — plakát je datovaný otisk, čísla se v čase mění",
    );
    expect(c.methodologyLine).not.toContain("nenahradil ho dnem tisku");
  });

  // Nedatovaný arch je jiný stav než arch nejednotné komory — a můžou nastat
  // OBA naráz. Věty se skládají, žádná druhou nepohltí.
  it("nedatovanost a nejednotný původ výpočtu se v řádku metodiky sečtou", () => {
    const c = buildPosterCitation({
      ...input,
      retrievedAt: null,
      provenanceState: "mixed",
      provenanceVariants: 2,
    });
    expect(c.methodologyLine).toContain("čísla nespočítal jeden a týž průchod");
    expect(c.methodologyLine).toContain("nenahradil ho dnem tisku");
    expect(c.pass).toBeNull();
  });
});

// Vytištěný arch je archivní dokument. Když skóre spočítala starší linie formule než
// ta, kterou dnes deklaruje kód (šestidenní rozpor 29. 7. → 4. 8. 2026), musí to patička
// říct — jinak papír tvrdí metodiku, podle které jeho čísla nevznikla.
describe("buildPosterCitation — rozpor linie formule", () => {
  const input = {
    sourceLabel: "psp.cz",
    sourceUrl: "https://politicas.cz/zebricek/",
    retrievedAt: "2026-07-30",
    methodology: "index přispění, šest vážených složek",
    provenancePass: 11,
  };

  it("mlčí, když se data a kód shodují (null i vynecháno)", () => {
    expect(buildPosterCitation(input).methodologyLine).not.toContain("POZOR");
    expect(buildPosterCitation({ ...input, formulaMismatch: null }).methodologyLine).not.toContain("POZOR");
  });

  it("pojmenuje OBĚ linie, když se rozcházejí — uloženou i deklarovanou", () => {
    const c = buildPosterCitation({
      ...input,
      formulaMismatch: { storedRef: "contribution", declaredRef: "contribution-committee-dedupe" },
    });
    expect(c.methodologyLine).toContain("výpočetní pas 11");
    expect(c.methodologyLine).toContain("starší linie metodiky „contribution“");
    expect(c.methodologyLine).toContain("kód dnes deklaruje „contribution-committee-dedupe“");
  });
});
