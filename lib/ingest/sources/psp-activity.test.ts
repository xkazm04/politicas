import { describe, expect, it } from "vitest";

import { parseUnl } from "../unl";
import {
  billsAndWrittenInterp,
  oralInterp,
  parseAmendments,
  parseBillSpeeches,
  speechTurns,
  splitBillAuthorship,
} from "./psp-activity";

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

describe("splitBillAuthorship (Q-effort-2)", () => {
  // tisky.unl: 0 id_tisk | 1 id_druh | 5 id_navrh | 7 id_org_obd — same universe as billsAndWrittenInterp
  const tisky = parseUnl(
    [
      "43111|2|x|100|x|3|x|174|||||||||", // MP-group bill in term
      "43112|2|x|101|x|2|x|174|||||||||", // single-MP bill in term
      "43113|1|x|102|x|1|x|174|||||||||", // government bill → not MP-authored
      "43114|2|x|103|x|3|x|173|||||||||", // other term → excluded
    ].join("\n"),
  );
  const predkladatel = parseUnl(
    [
      "43111|6473|1|0|", // first signatory
      "43111|6433|2|0|", // co-signer
      "43111|6500|3|1|",
      "43112|6433|1|0|", // 6433 fronts their own bill here
      "43113|9999|1|0|", // government bill row → excluded from the universe
      "43114|6473|1|0|", // other term → excluded
    ].join("\n"),
  );

  it("splits by poradi and the split sums to billsAuthored per person", () => {
    const { firstByPerson, coByPerson } = splitBillAuthorship(tisky, predkladatel, 174);
    expect(firstByPerson.get(6473)).toBe(1);
    expect(coByPerson.get(6473)).toBeUndefined();
    expect(firstByPerson.get(6433)).toBe(1);
    expect(coByPerson.get(6433)).toBe(1);
    expect(coByPerson.get(6500)).toBe(1);

    const { billsByPerson } = billsAndWrittenInterp(tisky, predkladatel, 174);
    for (const [id, total] of billsByPerson) {
      expect((firstByPerson.get(id) ?? 0) + (coByPerson.get(id) ?? 0)).toBe(total);
    }
  });
});

describe("parseBillSpeeches (pass 35)", () => {
  // schuze.unl: 0 id_schuze | 1 id_org
  const schuze = parseUnl(["844|174|1|||||", "500|170|1|||||"].join("\n"));
  // bod_schuze.unl: 0 id_bod | 1 id_schuze | 2 id_tisk (internal)
  const bodSchuze = parseUnl(
    [
      "57931|844|43124|1|1|Vládní návrh…|/sněmovní tisk 17/||0||||||",
      "57975|844|43132|1|2|Vládní návrh…|/sněmovní tisk 25/||0||||||",
      "57999|844||1|3|Slib poslanců|Není sn.tisk||0||||||", // no tisk → item ignored
      "40000|500|30000|1|1|starý tisk|…||0||||||", // other term → ignored
    ].join("\n"),
  );
  // rec.unl: 0 id_steno | 1 id_osoba | 2 aname | 3 id_bod | 4 druh
  const rec = parseUnl(
    [
      "8|6473|1|57931|3|", // substantive on tisk 43124
      "8|6473|2|57931|5|", // second turn, same person, same bill
      "8|6555|3|57931|2|", // chair turn → excluded
      "9|6473|1|57975|3|", // substantive on tisk 43132
      "9|6789|1|40000|3|", // other term's item → excluded
      "9|6789|1|57999|3|", // non-tisk item → excluded
    ].join("\n"),
  );

  it("joins rec → bod_schuze → tisk and keeps the substantive-speaker filter", () => {
    const speeches = parseBillSpeeches(schuze, bodSchuze, rec, 174);
    expect([...speeches.keys()].sort()).toEqual([43124, 43132]);
    expect(speeches.get(43124)!.get(6473)).toBe(2);
    expect(speeches.get(43124)!.has(6555)).toBe(false); // chair excluded
    expect(speeches.get(43132)!.get(6473)).toBe(1);
  });
});

describe("parseAmendments (pass 35)", () => {
  // sd_dokument.unl: 0 id | 1 id_obdobi | 2 cislo | 3 typ | 6 ct | 7 id_x
  const sd = parseUnl(
    [
      "250|174|3|13|||72|6473|2026-01-01 10:00:00|",
      "251|174|4|13|||72|6473|2026-01-02 10:00:00|", // second amendment, same pair
      "252|174|5|13|||94|6789|2026-01-03 10:00:00|",
      "253|170|6|13|||449|5944|2011-12-01 11:15:06|", // other term → excluded
      "254|174|7|12|||72|6473|2026-01-04 10:00:00|", // typ 12 (podklad) → excluded
    ].join("\n"),
  );

  it("keeps term-scoped typ-13 rows attributed via id_x", () => {
    expect(parseAmendments(sd, 174)).toEqual([
      { tiskCislo: 72, idOsoba: 6473, sdCislo: 3 },
      { tiskCislo: 72, idOsoba: 6473, sdCislo: 4 },
      { tiskCislo: 94, idOsoba: 6789, sdCislo: 5 },
    ]);
  });
});
