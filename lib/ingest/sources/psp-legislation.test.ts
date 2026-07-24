import { describe, expect, it } from "vitest";

import { parseUnl } from "../unl";
import { extractAmendedLaws, parseCommitteeAssignments, parseLawBills } from "./psp-legislation";

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

describe("parseCommitteeAssignments (F15)", () => {
  // hist_vybory.unl (0-idx): 0 id_tisku | 1 id_organ | 2 typ | 3 id_hist | 4 id_posl | 5 poradi | 6 garancni
  const histVybory = rows(
    [
      // tisk 43179: garanční ÚPV (1762) formally assigned (typ 2), plus two further committees
      "43179|1756|2|210811|1977|3|||", // dalsi (garancni empty)
      "43179|1762|2|210811|2088|1|1||", // garanční (typ 2 přikázáno)
      "43179|1759|2|210811|2058|2|||", // dalsi
      // tisk 43132: ÚPV proposed as garanční (typ 1 navrženo), same committee later assigned (typ 2)
      "43132|1762|1|210417||1|1||", // navrženo garanční
      "43132|1762|2|210999||1|1||", // přikázáno garanční — collapses with the row above; přikázáno wins
      // tisk 43185: garanční VVVMS (1765), only proposed (typ 1) — the young-term common case
      "43185|1765|1|210736||1|1||",
      // a short/garbage row is ignored
      "||1|x||||",
    ].join("\n"),
  );
  // hist.unl (0-idx): 0 id_hist | 1 id_tisk | 2 datum
  const hist = rows(
    [
      "210811|43179|2026-02-13 10:30||||||||||||",
      "210417|43132|2025-11-20 00:00||||||||||||",
      "210999|43132|2026-03-24 14:05||||||||||||",
      "210736|43185|2026-01-28 00:00||||||||||||",
    ].join("\n"),
  );

  const a = parseCommitteeAssignments(histVybory, hist);
  const at = (tisk: number, organ: number) => a.find((x) => x.tiskId === tisk && x.organId === organ)!;

  it("emits one assignment per (tisk, committee) pair", () => {
    expect(a).toHaveLength(5); // 43179×3 + 43132×1 (collapsed) + 43185×1
    expect(a.filter((x) => x.tiskId === 43132)).toHaveLength(1);
  });

  it("marks the garanční committee and the further committees apart", () => {
    expect(at(43179, 1762).role).toBe("garancni");
    expect(at(43179, 1756).role).toBe("dalsi");
    expect(at(43179, 1759).role).toBe("dalsi");
  });

  it("collapses to the strongest status and dates from the linked hist step", () => {
    // 43132: navrženo (Nov) + přikázáno (Mar) on the same committee → přikázáno wins, with its date
    expect(at(43132, 1762).status).toBe("prikazano");
    expect(at(43132, 1762).assignedOn).toBe("2026-03-24");
    expect(at(43179, 1762).status).toBe("prikazano");
    expect(at(43179, 1762).assignedOn).toBe("2026-02-13");
    // 43185: only a proposal so far — honestly recorded as navrženo
    expect(at(43185, 1765).status).toBe("navrzeno");
    expect(at(43185, 1765).assignedOn).toBe("2026-01-28");
  });
});
