import { describe, expect, it } from "vitest";

import { parseUnl } from "../unl";
import {
  extractAmendedLaws,
  parseBillFates,
  parseCommitteeAssignments,
  parseLawBills,
  parseRapporteurs,
  parseSponsorRoles,
} from "./psp-legislation";

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

/* ── RIDER 1: the date was decided by dump row order (fixed 2026-08-13) ───────
 *
 * `if (rank >= prev.rank) … if (date) prev.assignedOn = date` let the LAST row at the
 * strongest status win, so the order psp.cz happened to write the file decided a date
 * the product prints. 180 (tisk, committee) pairs have >1 row at their strongest
 * status, 175 resolve to different hist dates; live in PSP10 today: tisk 43204 →
 * organ 1772, 2026-02-03 vs 2026-02-12 — the day /denik prints for that bill. */
describe("parseCommitteeAssignments — the date is the EARLIEST step at the strongest status", () => {
  // The live pair, both orders. hist_vybory: 0 id_tisku | 1 id_organ | 2 typ | 3 id_hist
  const HIST = rows(
    ["300003|43204|2026-02-03 09:00||||||||||||", "300012|43204|2026-02-12 11:30||||||||||||"].join("\n"),
  );
  const pairIn = (order: string[]) => parseCommitteeAssignments(rows(order.join("\n")), HIST)[0];

  it("is order-independent: the same two rows give the same date either way round", () => {
    const early = ["43204|1772|2|300003|||1||", "43204|1772|2|300012|||1||"];
    const late = [...early].reverse();
    expect(pairIn(early).assignedOn).toBe("2026-02-03");
    expect(pairIn(late).assignedOn).toBe("2026-02-03");
    expect(pairIn(late)).toEqual(pairIn(early));
  });

  it("a strictly stronger step still replaces a weaker step's earlier date", () => {
    // navrženo on the 3rd, přikázáno on the 12th → the assignment is the přikázání.
    const a = pairIn(["43204|1772|1|300003|||1||", "43204|1772|2|300012|||1||"]);
    expect(a.status).toBe("prikazano");
    expect(a.assignedOn).toBe("2026-02-12");
  });

  it("a weaker step's date is NOT borrowed when the strongest status has none", () => {
    // přikázáno with no linked hist step + navrženo on the 3rd. Dating the přikázání
    // by the day it was merely proposed is a false claim; the pair is undated instead.
    const a = pairIn(["43204|1772|1|300003|||1||", "43204|1772|2||||1||"]);
    expect(a.status).toBe("prikazano");
    expect(a.assignedOn).toBeNull();
  });
});

/* ── RIDER 2: an unknown typ was silently downgraded to the weakest REAL status ── */
describe("parseCommitteeAssignments — an unknown typ is unknown, not 'navrzeno'", () => {
  const HIST = rows(["300003|43204|2026-02-03 09:00||||||||||||"].join("\n"));

  it("maps an undocumented code (the live typ = 4) to an explicit unknown", () => {
    const a = parseCommitteeAssignments(rows("43204|1772|4|300003|||1||"), HIST)[0];
    expect(a.status).toBe("unknown");
    expect(a.assignedOn).toBe("2026-02-03"); // the row is kept, only the status is withheld
  });

  it("maps an empty/NULL typ to unknown too", () => {
    expect(parseCommitteeAssignments(rows("43204|1772||300003|||1||"), HIST)[0].status).toBe("unknown");
    expect(parseCommitteeAssignments(rows("43204|1772|null|300003|||1||"), HIST)[0].status).toBe("unknown");
  });

  it("unknown never outranks a documented status on the same pair, in either order", () => {
    const documentedFirst = parseCommitteeAssignments(
      rows(["43204|1772|1|300003|||1||", "43204|1772|4|300003|||1||"].join("\n")),
      HIST,
    )[0];
    const unknownFirst = parseCommitteeAssignments(
      rows(["43204|1772|4|300003|||1||", "43204|1772|1|300003|||1||"].join("\n")),
      HIST,
    )[0];
    expect(documentedFirst.status).toBe("navrzeno");
    expect(unknownFirst.status).toBe("navrzeno");
  });

  it("the token is outside the renderer's key whitelist, so it cannot print as a real status", () => {
    // features/lawwatch/lawwatchLabels.ts COMMITTEE_STATUS_KEYS — retyped here on
    // purpose: this test guards the CONTRACT between the two files, and importing the
    // consumer would make it pass by construction.
    const COMMITTEE_STATUS_KEYS = new Set(["prikazano", "navrzeno", "iniciativne"]);
    const a = parseCommitteeAssignments(rows("43204|1772|4|300003|||1||"), HIST)[0];
    expect(COMMITTEE_STATUS_KEYS.has(a.status)).toBe(false);
  });
});

describe("parseSponsorRoles (Q-effort-2)", () => {
  // predkladatel.unl: id_tisk | id_osoba | poradi | typ
  const roles = parseSponsorRoles(
    rows(
      [
        "43111|6473|1|0|", // first signatory
        "43111|6433|2|0|", // co-signer
        "43111|6500|3|1|", // joined the list later
        "43111|6433|5|0|", // duplicate row with a weaker rank — the lower rank wins
        "43112|6473|2|0|", // same MP, different bill, NOT first there
        "|x|1|0|", // garbage row ignored
      ].join("\n"),
    ),
  );

  it("orders the signature list by poradi and keeps the lowest rank on duplicates", () => {
    const list = roles.get(43111)!;
    expect(list.map((s) => s.idOsoba)).toEqual([6473, 6433, 6500]);
    expect(list[0].rank).toBe(1);
    expect(list.find((s) => s.idOsoba === 6433)!.rank).toBe(2);
  });

  it("flags later joiners and keeps first-signatory status per bill, not per person", () => {
    expect(roles.get(43111)!.find((s) => s.idOsoba === 6500)!.joinedLater).toBe(true);
    expect(roles.get(43112)![0].rank).toBe(2); // 6473 is a co-signer on 43112
  });
});

describe("parseRapporteurs", () => {
  // hist.unl (0-idx): 0 id_hist | 1 id_tisk | … | 8 orgv_id_posl | 9 ps_id_posl
  const hist = rows(
    [
      "210001|43110|2026-01-10 00:00||||||null|2136||null|null|null|",
      "210002|43110|2026-02-10 00:00|||||||2136||null|null|null|", // same (tisk, poslanec, scope) → deduped
      "210003|43123|2026-01-11 00:00||||||1977|||null|null|null|", // orgv scope
    ].join("\n"),
  );
  // hist_vybory.unl: 0 id_tisku | 1 id_organ | 2 typ | 3 id_hist | 4 id_posl | 5 poradi | 6 garancni
  const histVybory = rows(["43110|1769|2|210001|2136|1|1||", "43110|1767|2|210001|2090|2|||"].join("\n"));
  // tisky_za.unl: 0 id_tisk | … | 7 id_org | … | 9 id_posl
  const tiskyZa = rows(["43110|14|210001|8|Usnesení|Usnesení výboru|2026-02-01 00:00|1769|14|2033|||||||"].join("\n"));

  const raps = parseRapporteurs(hist, histVybory, tiskyZa);

  it("collects all four scopes, mapping the literal 'null' to nothing", () => {
    expect(raps).toEqual([
      { tiskId: 43110, poslanecId: 2136, scope: "zpravodaj_ps", organId: null },
      { tiskId: 43123, poslanecId: 1977, scope: "zpravodaj_ov", organId: null },
      { tiskId: 43110, poslanecId: 2136, scope: "zpravodaj_vyboru", organId: 1769 },
      { tiskId: 43110, poslanecId: 2090, scope: "zpravodaj_vyboru", organId: 1767 },
      { tiskId: 43110, poslanecId: 2033, scope: "zpravodaj_dokumentu", organId: 1769 },
    ]);
  });
});

describe("parseBillFates", () => {
  // tisky.unl: 0 id_tisk | 1 id_druh | 2 id_stav | …
  const tisky = rows(["43132|1|110|583|||||||||||||", "43185|2|120|59|||||||||||||", "43200|2|130|7|||||||||||||"].join("\n"));
  // stavy.unl: id_stav | id_typ_stavu ; typ_stavu.unl: id | name
  const stavy = rows(["110|6|1||||", "120|11|1||||", "130|1|1||||"].join("\n"));
  const typStavu = rows(["6|KONEC|", "11|Sbírka zákonů|", "1|1. čtení|"].join("\n"));
  // hist.unl: 11 zaver_publik (DD.MM.YYYY or literal "null") | 12 castka | 13 cislo
  const hist = rows(
    [
      "210417|43132|2025-12-23 00:00||57|||||||29.12.2025|583|583|",
      "210500|43200|2026-04-15 00:00||2031|||||||null|null|7|", // NOT a publication (publik is "null")
      "210600|43185|2026-05-06 00:00||151|||||||12.05.2026|59|59|",
    ].join("\n"),
  );

  const RETRIEVED_ON = "2026-08-13"; // the day the dump was read — pinned, never the clock
  const fates = parseBillFates(tisky, stavy, typStavu, hist, RETRIEVED_ON);

  it("resolves the Czech state name per tisk", () => {
    expect(fates.get(43132)!.stav).toBe("KONEC");
    expect(fates.get(43185)!.stav).toBe("Sbírka zákonů");
    expect(fates.get(43200)!.stav).toBe("1. čtení");
  });

  it("records a Sbírka publication only from a real zaver step", () => {
    expect(fates.get(43132)!.sb).toBe("583/2025");
    expect(fates.get(43132)!.publishedOn).toBe("2025-12-29");
    expect(fates.get(43185)!.sb).toBe("59/2026");
    expect(fates.get(43200)!.sb).toBeNull(); // the "null"-publik transition row is not a publication
  });

  it("a row that is not a publication is not counted as a refusal", () => {
    expect(fates.get(43200)!.refusedPublications).toBe(0);
    expect(fates.get(43132)!.refusedPublications).toBe(0);
  });
});

/* ── RIDER 3: an impossible zaver date was published as a law citation ────────
 *
 * parseBillFates built a Sbírka citation out of anything regex-shaped like a date, so
 * the dump's `zaver_publik = "28.08.0202"` (a publisher typo) published
 * `sb: "88/0202"`, `publishedOn: "0202-08-28"`. lib/analysis/plausible-date.ts is the
 * app's ONE boundary for exactly this and is imported, never forked. */
describe("parseBillFates — an impossible publication date is refused, never repaired", () => {
  const RETRIEVED_ON = "2026-08-13";
  const tisky = rows(["43132|1|110|583|||||||||||||", "43185|2|120|59|||||||||||||"].join("\n"));
  const stavy = rows(["110|6|1||||", "120|11|1||||"].join("\n"));
  const typStavu = rows(["6|KONEC|", "11|Sbírka zákonů|"].join("\n"));
  // hist: 11 zaver_publik | 13 cislo
  const fatesFor = (histRows: string[]) =>
    parseBillFates(tisky, stavy, typStavu, rows(histRows.join("\n")), RETRIEVED_ON);

  it("refuses the year-0202 typo the live dump carries — no sb, no publishedOn, counted", () => {
    const f = fatesFor(["210417|43132|2025-12-23 00:00||57|||||||28.08.0202|88|88|"]).get(43132)!;
    expect(f.sb).toBeNull(); // would have been "88/0202"
    expect(f.publishedOn).toBeNull(); // would have been "0202-08-28"
    expect(f.refusedPublications).toBe(1);
    expect(f.stav).toBe("KONEC"); // the ROW survives — only the citation is withheld
  });

  it("refuses a date after the day the dump was read, and a date before the republic", () => {
    expect(fatesFor(["210417|43132|2025-12-23 00:00||57|||||||01.01.2029|9|9|"]).get(43132)!.sb).toBeNull();
    expect(fatesFor(["210417|43132|2025-12-23 00:00||57|||||||01.01.1970|9|9|"]).get(43132)!.sb).toBeNull();
    expect(fatesFor(["210417|43132|2025-12-23 00:00||57|||||||01.01.2029|9|9|"]).get(43132)!.refusedPublications).toBe(1);
  });

  it("refuses numbers that are regex-shaped but not a calendar date at all", () => {
    // "2025-13-32" passes an ISO-lexicographic range check; it is still not a date.
    const f = fatesFor(["210417|43132|2025-12-23 00:00||57|||||||32.13.2025|9|9|"]).get(43132)!;
    expect(f.sb).toBeNull();
    expect(f.refusedPublications).toBe(1);
    expect(fatesFor(["210417|43132|2025-12-23 00:00||57|||||||31.02.2025|9|9|"]).get(43132)!.sb).toBeNull();
  });

  it("a plausible date is still published, and the boundary day itself passes", () => {
    expect(fatesFor(["210417|43132|2025-12-23 00:00||57|||||||29.12.2025|583|583|"]).get(43132)!.sb).toBe("583/2025");
    // retrievedOn is inclusive: a dump read on the day of publication still cites it.
    const sameDay = fatesFor([`210417|43132|2025-12-23 00:00||57|||||||13.08.2026|9|9|`]).get(43132)!;
    expect(sameDay.sb).toBe("9/2026");
    expect(sameDay.refusedPublications).toBe(0);
  });

  it("a refused step does not evict an already-accepted publication", () => {
    const f = fatesFor([
      "210417|43132|2025-12-23 00:00||57|||||||29.12.2025|583|583|",
      "210999|43132|2026-01-05 00:00||57|||||||28.08.0202|88|88|",
    ]).get(43132)!;
    expect(f.sb).toBe("583/2025");
    expect(f.publishedOn).toBe("2025-12-29");
    expect(f.refusedPublications).toBe(1);
  });
});
