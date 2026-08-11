import { describe, expect, it } from "vitest";

import { lensAddress } from "./useLensWeights";
import { LENS_PARAM, PUBLISHED_WEIGHTS, type WeightVector } from "./lens";

/*
 * Skládání adresy s čočkou je od 2026-08-11 ČISTÁ funkce, a to ze dvou důvodů,
 * které se testují níž:
 *
 *  1. Zápis do historie se přesunul z kroku posuvníku na KONEC gesta (WebKit
 *     shodí replaceState nad ~100 voláními za 30 s — jeden tah jich dělal
 *     35–100). Adresu tedy skládá víc volajících v různých okamžicích a musí
 *     jim vyjít táž.
 *  2. „Sdílet moji čočku" si adresu počítá SÁM (řádek prohlížeče může být
 *     uprostřed tahu o krok pozadu), takže absolutní i relativní tvar musí
 *     pocházet z jednoho výpočtu — jinak čtenář sdílí jinou metodiku, než jakou
 *     má na obrazovce.
 *
 * Hook sám (efekty, ref, události) testovaný není — repo nemá jsdom ani
 * testing-library; testuje se pravidlo, ne divadlo.
 */

const w = (v: Partial<WeightVector>): WeightVector => ({ ...PUBLISHED_WEIGHTS, ...v });
const CUSTOM = w({ participation: 40, attendance: 35, committee: 5, legislative: 10, speech: 5, leadership: 5 });
const VECTOR = "40-5-10-5-35-5";

describe("lensAddress — jedna adresa pro historii i pro schránku", () => {
  it("vlastní čočka se zapíše do parametru v kanonickém pořadí složek", () => {
    const { href, path } = lensAddress("https://politicas.cz/zebricek", CUSTOM);
    expect(href).toBe(`https://politicas.cz/zebricek?${LENS_PARAM}=${VECTOR}`);
    expect(path).toBe(`/zebricek?${LENS_PARAM}=${VECTOR}`);
  });

  it("zveřejněné váhy parametr ODSTRAŇUJÍ — čistá adresa JE oficiální index", () => {
    const { href, path } = lensAddress(
      `https://politicas.cz/zebricek?${LENS_PARAM}=${VECTOR}`,
      { ...PUBLISHED_WEIGHTS },
    );
    expect(href).toBe("https://politicas.cz/zebricek");
    expect(path).toBe("/zebricek");
  });

  it("stará hodnota se PŘEPÍŠE, nikdy nepřibude druhá (jeden tah = jedna čočka)", () => {
    const { path } = lensAddress(`https://politicas.cz/zebricek?${LENS_PARAM}=10-10-10-10-10-10`, CUSTOM);
    expect(path).toBe(`/zebricek?${LENS_PARAM}=${VECTOR}`);
    expect(path.match(new RegExp(`${LENS_PARAM}=`, "g"))).toHaveLength(1);
  });

  it("cizí parametry, cesta i kotva zůstávají — čočka není navigace", () => {
    const { href, path } = lensAddress(
      "https://politicas.cz/kraj/jihomoravsky?utm_source=mail#vsichni",
      CUSTOM,
    );
    expect(path).toBe(`/kraj/jihomoravsky?utm_source=mail&${LENS_PARAM}=${VECTOR}#vsichni`);
    expect(href.endsWith(path)).toBe(true);
  });

  it("zkopírovaný odkaz a řádek prohlížeče se nemohou rozejít — path je konec href", () => {
    for (const start of [
      "https://politicas.cz/zebricek",
      `http://localhost:3000/zebricek?${LENS_PARAM}=1-1-1-1-1-1#vsichni`,
      "https://politicas.cz/kraj/praha#tisk",
    ]) {
      for (const weights of [CUSTOM, { ...PUBLISHED_WEIGHTS }]) {
        const { href, path } = lensAddress(start, weights);
        expect(href.endsWith(path), `${start} → ${href}`).toBe(true);
      }
    }
  });

  it("je deterministická a vstup nemění", () => {
    const before = JSON.parse(JSON.stringify(CUSTOM));
    expect(lensAddress("https://politicas.cz/zebricek", CUSTOM)).toEqual(
      lensAddress("https://politicas.cz/zebricek", CUSTOM),
    );
    expect(CUSTOM).toEqual(before);
  });
});
