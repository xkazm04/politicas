import { describe, expect, it } from "vitest";

import { parseUnl } from "../unl";
import { extractAmendedLaws, parseLawBills } from "./psp-legislation";

const PSP10 = 174;
const rows = (s: string) => parseUnl(s);

describe("extractAmendedLaws", () => {
  it("pulls one or many Sb. citations from a bill title", () => {
    expect(extractAmendedLaws("…kterým se mění zákon č. 37/2021 Sb., o evidenci")).toEqual(["37/2021"]);
    expect(extractAmendedLaws("…mění zákon č. 90/1995 Sb. a zákon č. 250/2016 Sb.")).toEqual(["90/1995", "250/2016"]);
    expect(extractAmendedLaws("Návrh zákona o něčem novém")).toEqual([]); // a new law, cites nothing
    expect(extractAmendedLaws(null)).toEqual([]);
  });
});

describe("parseLawBills", () => {
  // tisky.unl (0-indexed): 0 id_tisk | 1 druh | 3 cislo | 5 typ_zakon | 7 id_org_obd | 8 osoba | 9 text | 15 title
  const tisky = rows(
    [
      "43382|1|x|260|x|1|x|174||ministr spravedlnosti|x|x|x|x|x|Vládní návrh zákona, kterým se mění zákon č. 37/2021 Sb., o evidenci|",
      "43111|2|x|100|x|3|x|174||poslanci|x|x|x|x|x|Návrh poslanců, kterým se mění zákon č. 90/1995 Sb. a zákon č. 250/2016 Sb.|",
      "50000|3|x|1|x|1|x|174||vláda|x|x|x|x|x|Státní rozpočet na rok 2026|", // druh=3 budget → excluded
      "43112|2|x|101|x|2|x|173||poslanec|x|x|x|x|x|Novela z. č. 1/2000 Sb.|", // other term → excluded
      "43113|0|x|0|x|0|x|174||x|x|x|x|x|x|shell|", // druh=0 shell → excluded
    ].join("\n"),
  );
  // predkladatel.unl: id_tisk | id_osoba | poradi | typ
  const predkladatel = rows(["43111|6473|1|0|", "43111|6433|2|0|"].join("\n"));

  const bills = parseLawBills(tisky, predkladatel, PSP10);

  it("keeps only law bills (druh 1/2) in the term", () => {
    expect(bills.map((b) => b.tiskId).sort()).toEqual([43111, 43382]);
  });

  it("classifies origin and government vs MP sponsorship", () => {
    const gov = bills.find((b) => b.tiskId === 43382)!;
    expect(gov.origin).toBe("government");
    expect(gov.sponsorOsobaIds).toEqual([]); // government bill → no MP predkladatel rows
    expect(gov.submitterText).toBe("ministr spravedlnosti");
    expect(gov.amendedLaws).toEqual(["37/2021"]);

    const mp = bills.find((b) => b.tiskId === 43111)!;
    expect(mp.origin).toBe("mp_group");
    expect(mp.sponsorOsobaIds).toEqual([6473, 6433]);
    expect(mp.amendedLaws).toEqual(["90/1995", "250/2016"]);
    expect(mp.cislo).toBe(100);
  });
});
