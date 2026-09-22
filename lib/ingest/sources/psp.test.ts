import { crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readBirthDate, termCode, voteChoice } from "../normalize";
import { normalizeHlasovani, normalizePoslanci } from "./psp";

/* The primary psp.cz adapter (poslanci.zip → persons/organs/mandates/memberships,
 * hl-<year>ps.zip → roll calls/ballots/excuses) had NO unit test while its three sibling
 * adapters carry 60 — every rule below (term code from the chamber organ, the function →
 * organ resolution, the omluvy term filter, natural-key duplicate counting, the voided
 * flag, the „M else F" gender vocabulary) was pinned only by the live ingest run
 * (2026-09-06, scan-sweep, test-strategist). Fixtures are STORED zips built in memory so
 * the adapter is exercised through the real zip + UNL path, not a mock. */

/** Minimal stored (method 0) ZIP: local headers + central directory + EOCD. */
function storedZip(files: Record<string, Buffer>): Uint8Array {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    chunks.push(local, nameBuf, data);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt32LE(crc32(data), 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(central.length / 2, 8);
  eocd.writeUInt16LE(central.length / 2, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...chunks, centralBuf, eocd]));
}

// The dumps are windows-1250. The fixture uses only letters whose cp1250 byte equals
// their latin1 byte (á é í ó ú ý), so `latin1` encoding yields the publisher's bytes.
const unl = (lines: string[]) => Buffer.from(lines.join("\n") + "\n", "latin1");

const prov = { source: "psp-poslanci", sourceUrl: "https://example.test/poslanci.zip", fetchedAt: "2026-09-06T00:00:00Z", ingestRunId: 7 };
const PSP10 = 174;

const poslanciZip = storedZip({
  // id_typ_organu|typ_id_typ|nazev_typ_org_cz|nazev_typ_org_en|priorita
  "typ_organu.unl": unl(["1|0|Parlament|Parliament|1|", "2|1|výbor|committee|2|"]),
  // id_organ|organ_id_organ|id_typ_organu|zkratka|nazev_organu_cz|nazev_organu_en|od_organ|do_organ|priorita|cl_organ_base
  "organy.unl": unl(["174|0|1|PSP10|Poslanecká komora|Chamber|21.10.2025||1|0|", "1772|174|2|VV|Volební výbor|Electoral|01.11.2025||2|0|"]),
  // id_osoba|pred|prijmeni|jmeno|za|narozeni|pohlavi|zmena|umrti
  "osoby.unl": unl(["6790|Ing.|Novák|Jan||24.01.1966|M|01.01.2026||", "6791||Nováková|Eva|||X|||"]),
  // id_poslanec|id_osoba|id_kraj|id_kandidatka|id_obdobi|web|ulice|obec|psc|email|telefon|fax|psp_telefon|facebook|foto
  "poslanec.unl": unl(["5001|6790|30|500|174|http://x||||a@b.cz|||||1|", "5002|6791|30|500|999|||||||||||0|"]),
  // id_funkce|id_organ|id_typ_funkce|nazev_funkce_cz|priorita
  "funkce.unl": unl(["7001|1772|3|tajemník|1|"]),
  // id_typ_funkce|id_typ_org|typ_funkce_cz|typ_funkce_en|priorita
  "typ_funkce.unl": unl(["3|2|tajemník|secretary|1|"]),
  // id_osoba|id_of|cl_funkce|od_o|do_o|od_f|do_f  — the second row repeats the first
  "zarazeni.unl": unl(["6790|1772|0|2025-11-01 10||||", "6790|1772|0|2025-11-01 10||||", "6790|7001|1|2025-11-05 09||||"]),
});

describe("normalizePoslanci — the registry half of the psp adapter (2026-09-06, test-strategist)", () => {
  const b = normalizePoslanci(poslanciZip, prov);

  it("the chamber organ names the term code; other organs carry their type label", () => {
    expect(b.termCodes.get(PSP10)).toBe("PSP10");
    expect(b.organs.map((o) => [o.id, o.organTypeCz, o.nameNorm])).toEqual([
      ["psp:organ:174", "Parlament", "poslanecka komora"],
      ["psp:organ:1772", "výbor", "volebni vybor"],
    ]);
    expect(b.organs[0].validFrom).toBe("2025-10-21");
  });

  it("persons: folded name, calendar birth date, the publisher's M-else-F gender vocabulary", () => {
    const [jan, eva] = b.persons;
    expect(jan).toMatchObject({ id: "psp:osoba:6790", nameFull: "Jan Novák", nameNorm: "jan novak", birthDate: "1966-01-24", gender: "M", changedAt: "2026-01-01" });
    expect(eva).toMatchObject({ nameFull: "Eva Nováková", gender: "F", birthDate: null, birthDateUnknown: true });
    expect(readBirthDate(null)).toEqual({ date: null, unknown: true });
    expect(jan.source).toBe("psp-poslanci");
    expect(jan.ingestRunId).toBe(7);
  });

  it("mandates take the term code from the chamber organ and the shared fallback for an unknown organ", () => {
    expect(b.mandates.map((m) => [m.id, m.termCode, m.hasPhoto])).toEqual([
      ["psp:poslanec:5001", "PSP10", true],
      ["psp:poslanec:5002", termCode(null, 999), false],
    ]);
    expect(b.mandates[1].termCode).toBe("ORGAN999");
  });

  it("a held office resolves to its organ; a plain membership is its own target; duplicates are counted", () => {
    const fn = b.memberships.find((m) => m.kind === "function");
    expect(fn).toMatchObject({ targetPspId: 7001, organPspId: 1772, functionNameCz: "tajemník", functionTypeCz: "tajemník", fromAt: "2025-11-05T09:00:00.000Z" });
    const member = b.memberships.find((m) => m.kind === "member");
    expect(member).toMatchObject({ targetPspId: 1772, organPspId: 1772, functionNameCz: null });
    expect(b.memberships).toHaveLength(3);
    expect(b.duplicates).toEqual({ persons: 0, organs: 0, mandates: 0, memberships: 1 });
  });
});

const hlasovaniZip = storedZip({
  // id_hlasovani|id_organ|schuze|cislo|bod|datum|cas|pro|proti|zdrzel|nehlasoval|prihlaseno|kvorum|druh_hlasovani|vysledek|nazev_dlouhy|nazev_kratky
  "hl2025s.unl": unl([
    "90001|174|3|12|5|10.12.2025|14:05|100|50|10|20|180|91|N|A|Návrh zákona o dani|Zákon o dani|",
    "90002|174|3|13|5|10.12.2025|14:10|90|60|10|20|180|91|N|R|Opakované hlasování|Opak.|",
  ]),
  "zmatecne.unl": unl(["90002|"]),
  // id_poslanec|id_hlasovani|vysledek
  "hl2025h1.unl": unl(["5001|90001|A|", "5001|90002|B|"]),
  // id_organ|id_poslanec|den|od|do — row 2 repeats row 1; row 3 belongs to another term
  "omluvy.unl": unl(["174|5001|10.12.2025|||", "174|5001|10.12.2025|||", "999|5001|10.12.2025|||", "174|5001|11.12.2025|09:00|12:00|"]),
});

describe("normalizeHlasovani — the roll-call half of the psp adapter (2026-09-06, test-strategist)", () => {
  const h = normalizeHlasovani(hlasovaniZip, { ...prov, source: "psp-hlasovani" }, new Map([[PSP10, "PSP10"]]));

  it("roll calls carry the term code, the instant, the tallies and the voided flag", () => {
    expect(h.termPspIds).toEqual([PSP10]);
    expect(h.voteEvents.map((v) => [v.id, v.termCode, v.votedAt, v.yes, v.voided])).toEqual([
      ["psp:hlasovani:90001", "PSP10", "2025-12-10T14:05:00.000Z", 100, false],
      ["psp:hlasovani:90002", "PSP10", "2025-12-10T14:10:00.000Z", 90, true],
    ]);
    expect(h.voteEvents[0].titleNorm).toBe("navrh zakona o dani");
  });

  it("ballots decode the publisher's vote code through the one vocabulary", () => {
    expect(h.ballots.map((x) => [x.id, x.code, x.choice])).toEqual([
      ["psp:hlas:90001:5001", "A", voteChoice("A")],
      ["psp:hlas:90002:5001", "B", voteChoice("B")],
    ]);
  });

  it("excuses: only this dump's terms, the full tuple as key, whole-day detection, duplicates counted", () => {
    expect(h.absences).toHaveLength(3);
    expect(h.absences.map((a) => [a.day, a.wholeDay, a.termPspId])).toEqual([
      ["2025-12-10", true, PSP10],
      ["2025-12-10", true, PSP10],
      ["2025-12-11", false, PSP10],
    ]);
    expect(h.absences[2].id).toBe("psp:omluva:174:5001:2025-12-11:09:00:12:00");
    expect(h.duplicates).toEqual({ voteEvents: 0, ballots: 0, absences: 1 });
  });
});
