import { describe, expect, it } from "vitest";

import { parseUnl } from "../unl";
import { billsAndWrittenInterp, oralInterp, speechTurns } from "./psp-activity";

const PSP10 = 174;
const rows = (s: string) => parseUnl(s);

describe("billsAndWrittenInterp", () => {
  // tisky.unl: id_tisk|id_druh|_|_|_|id_navrh|_|id_org_obd|id_osoba|…
  const tisky = rows(
    [
      "100|2|a|b|c|2|d|174||", // MP bill (single MP), PSP10
      "101|2|a|b|c|3|d|174||", // MP bill (group of MPs), PSP10
      "102|1|a|b|c|1|d|174||", // GOVERNMENT bill (id_navrh=1) → not MP-authored
      "103|6|a|b|c||d|174|6487|", // written interpellation → attribute via tisky.id_osoba
      "104|2|a|b|c|2|d|256||", // Senate print (other term organ) → skipped
      "105|0|a|b|c|2|d|174||", // id_druh=0 shell → skipped
    ].join("\n"),
  );
  // predkladatel.unl: id_tisk|id_osoba|poradi|typ
  const predkladatel = rows(["100|6473|1|0|", "100|6433|2|0|", "101|6473|1|0|", "102|9999|1|0|"].join("\n"));

  it("credits MP-authored bills via predkladatel, never government bills", () => {
    const { billsByPerson, mpAuthoredBills } = billsAndWrittenInterp(tisky, predkladatel, PSP10);
    expect(mpAuthoredBills).toBe(2); // bills 100 + 101 (102 is government)
    expect(billsByPerson.get(6473)).toBe(2); // Richterová on 100 + 101
    expect(billsByPerson.get(6433)).toBe(1); // Bartoš on 100 (co-author)
    expect(billsByPerson.get(9999)).toBeUndefined(); // government bill's predkladatel ignored
  });

  it("attributes written interpellations (druh=6) via tisky.id_osoba", () => {
    const { writtenInterpByPerson } = billsAndWrittenInterp(tisky, predkladatel, PSP10);
    expect(writtenInterpByPerson.get(6487)).toBe(1);
    expect([...writtenInterpByPerson.keys()]).toHaveLength(1);
  });
});

describe("oralInterp", () => {
  // li.unl: id_los|_|_|_|_|_|_|id_org
  const li = rows(["1|a|b|c|d|e|f|174|", "2|a|b|c|d|e|f|173|"].join("\n"));
  // poradi.unl: id_poradi|id_losovani|id_poslanec(=id_osoba)|…
  const poradi = rows(["10|1|7036|x|", "11|1|7040|x|", "12|2|8000|x|"].join("\n"));

  it("counts interpellations per osoba, scoped to the term's losování", () => {
    const m = oralInterp(li, poradi, PSP10);
    expect(m.get(7036)).toBe(1);
    expect(m.get(7040)).toBe(1);
    expect(m.get(8000)).toBeUndefined(); // losování 2 is another term
  });
});

describe("speechTurns", () => {
  // steno.unl: id_steno|id_org|…
  const steno = rows(["500|174|x|", "501|173|x|"].join("\n"));
  // rec.unl: id_steno|id_osoba|aname|id_bod|druh
  const rec = rows(
    [
      "500|6473|a|b|3|", // substantive speaker
      "500|6473|a|b|5|", // substantive speaker (another turn)
      "500|100|a|b|2|", // chair turn (druh=2) → excluded
      "501|6473|a|b|3|", // other-term steno → excluded
    ].join("\n"),
  );

  it("counts substantive speaking turns per osoba, excluding chair turns and other terms", () => {
    const m = speechTurns(steno, rec, PSP10);
    expect(m.get(6473)).toBe(2);
    expect(m.get(100)).toBeUndefined(); // chair
  });
});
