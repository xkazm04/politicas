// Invarianty exponátu: DETERMINISMUS otisku (týž výřez ⇒ táž adresa) a
// bezeztrátový kodek adresy (encode ∘ decode = identita; smetí ⇒ null).
//
// Vstup je ruční fixture přes REÁLNÝ builder výřezu (buildStateSlice), ne
// dotaz do grafu — test hlídá pravidlo, ne dnešní obsah databáze
// (stejná zásada jako stateSlice.test.ts).

import { describe, expect, it } from "vitest";
import { buildStateSlice, type SliceInput, type SliceMp, type SliceTie } from "./stateSlice";
import type { DatedFact } from "./datedFacts";
import {
  canonicalJson,
  contentHash,
  decodeExhibitId,
  encodeExhibitId,
  factExhibitId,
  fromBase64Url,
  hashFact,
  hashSlice,
  sliceExhibitId,
  toBase64Url,
} from "./exhibit";

// ── Fixture (zkrácená verze fixture ze stateSlice.test.ts) ──────────────────

const tie = (over: Partial<SliceTie> & { ico: string }): SliceTie => ({
  companyId: `company:ico:${over.ico}`,
  company: `Firma ${over.ico}`,
  role: "jednatel",
  tieClass: "owner-operator",
  reviewState: "pending_review",
  contractCzk: 1_000_000,
  contractCount: 4,
  donatedToPartyCzk: null,
  donationRecipientParty: null,
  ...over,
});

const mp = (pspId: number, name: string, ties: SliceTie[]): SliceMp => ({ pspId, name, ties });

function fixture(): SliceInput {
  return {
    chamberTotal: 207,
    mps: [
      mp(100, "Stovka Stovková", [tie({ ico: "00000100" })]),
      mp(200, "Dvojka Dvojková", [tie({ ico: "00000201", tieClass: "manager", contractCzk: 5_000_000 })]),
      mp(700, "Sedmá Dárkyně", [
        tie({ ico: "00000700", donatedToPartyCzk: 50_000, donationRecipientParty: "KDU-ČSL" }),
      ]),
    ],
    bills: [
      {
        cislo: 50,
        title: "Návrh na změnu zákona o DPH",
        sponsors: [{ pspId: 100, name: "Stovka Stovková" }],
        amendedLaws: [
          { urn: "law:sb:586-1992", ref: "586/1992", label: "z. 586/1992", title: "o daních z příjmů" },
        ],
      },
      {
        cislo: 60,
        title: "Společný návrh",
        sponsors: [{ pspId: 200, name: "Dvojka Dvojková" }],
        amendedLaws: [{ urn: "law:sb:114-1992", ref: "114/1992", label: "z. 114/1992", title: null }],
      },
    ],
  };
}

const build = () => {
  const s = buildStateSlice(fixture());
  if (!s) throw new Error("fixture must produce a slice");
  return s;
};

const fact = (over: Partial<DatedFact> = {}): DatedFact => ({
  id: "role-from:p:100|c:00000100",
  date: "2019-04-01",
  kind: "roleStart",
  refs: ["p:100", "c:00000100"],
  subjectRef: "p:100",
  subject: "Stovka Stovková",
  detail: "jednatel — Firma 00000100",
  pending: true,
  source: "ares — veřejný rejstřík",
  tone: "cobalt",
  ...over,
});

// ── Kanonická serializace a otisk ───────────────────────────────────────────

describe("canonicalJson + contentHash — determinismus", () => {
  it("nezávisí na pořadí klíčů objektu", () => {
    expect(canonicalJson({ a: 1, b: [{ y: 2, x: 3 }] })).toBe(
      canonicalJson({ b: [{ x: 3, y: 2 }], a: 1 }),
    );
  });

  it("chybějící volitelné pole a pole s undefined jsou týž obsah", () => {
    expect(canonicalJson({ a: 1, sub: undefined })).toBe(canonicalJson({ a: 1 }));
  });

  it("otisk je 8 hex znaků a je stabilní pro týž vstup", () => {
    expect(contentHash("politicas")).toMatch(/^[0-9a-f]{8}$/);
    expect(contentHash("politicas")).toBe(contentHash("politicas"));
    expect(contentHash("politicas")).not.toBe(contentHash("politicas!"));
  });
});

describe("hashSlice / sliceExhibitId — týž výřez ⇒ táž adresa", () => {
  it("dvě sestavení TÉHOŽ vstupu dají týž otisk i id", () => {
    const a = build();
    const b = build();
    expect(hashSlice(a)).toBe(hashSlice(b));
    expect(sliceExhibitId(a)).toBe(sliceExhibitId(b));
    expect(sliceExhibitId(a)).toBe(`rez.${hashSlice(a)}`);
  });

  it("jiný obsah (změněná částka smlouvy) dá jiný otisk", () => {
    const a = build();
    const input = fixture();
    input.mps[1].ties[0].contractCzk = 6_000_000; // peněžní uzel nese czk → jiný graf
    const b = buildStateSlice(input);
    if (!b) throw new Error("mutated fixture must still produce a slice");
    expect(hashSlice(b)).not.toBe(hashSlice(a));
  });

  it("jiné PRAVIDLO je jiný exponát, i kdyby obrázek náhodou vyšel stejně", () => {
    const a = build();
    expect(hashSlice({ graph: a.graph, rule: { ...a.rule, pendingTies: a.rule.pendingTies + 1 } })).not.toBe(
      hashSlice(a),
    );
  });
});

describe("hashFact / factExhibitId", () => {
  it("týž fakt ⇒ táž adresa; jiné datum ⇒ jiný otisk", () => {
    expect(factExhibitId(fact())).toBe(factExhibitId(fact()));
    expect(hashFact(fact({ date: "2019-04-02" }))).not.toBe(hashFact(fact()));
  });
});

// ── Kodek adresy ────────────────────────────────────────────────────────────

describe("base64url — bezeztrátový pro id faktů", () => {
  it("round-trip drží dvojtečky, svislítka i diakritiku", () => {
    for (const s of [
      "contract:kg:contract:abc-123",
      "role-from:p:100|c:00000100",
      "assigned:50:Výbor pro veřejnou správu",
      "š",
      "",
    ]) {
      expect(fromBase64Url(toBase64Url(s))).toBe(s);
    }
  });

  it("smetí odmítne (null), neopravuje", () => {
    expect(fromBase64Url("a")).toBeNull(); // délka % 4 === 1 nemůže vzniknout
    expect(fromBase64Url("$$$")).toBeNull();
    expect(fromBase64Url("ab=")).toBeNull(); // padding se nepoužívá
  });
});

describe("kodek adresy exponátu — round-trip a odmítání smetí", () => {
  it("rez: encode ∘ decode = identita", () => {
    const p = { kind: "rez", hash: "0a1b2c3d" } as const;
    expect(decodeExhibitId(encodeExhibitId(p))).toEqual(p);
  });

  it("fakt: encode ∘ decode = identita včetně nealfanumerických id", () => {
    const p = { kind: "fakt", factId: "role-to:p:100|c:00000100", hash: "deadbeef" } as const;
    expect(decodeExhibitId(encodeExhibitId(p))).toEqual(p);
  });

  it("adresa z reálného builderu se rozluští zpátky na týž otisk", () => {
    const s = build();
    const decoded = decodeExhibitId(sliceExhibitId(s));
    expect(decoded).toEqual({ kind: "rez", hash: hashSlice(s) });
    const f = fact();
    expect(decodeExhibitId(factExhibitId(f))).toEqual({
      kind: "fakt",
      factId: f.id,
      hash: hashFact(f),
    });
  });

  it("nerozluštitelné id není exponát — vrací null, nikdy náhradu", () => {
    for (const bad of [
      "",
      "rez",
      "rez.XYZ",
      "rez.0a1b2c3", // 7 hex
      "rez.0A1B2C3D", // hex je malými písmeny
      "rez.0a1b2c3d.extra",
      "fakt.0a1b2c3d", // chybí id faktu
      "fakt..0a1b2c3d", // prázdné id faktu
      "fakt.$$$.0a1b2c3d", // nevalidní base64url
      "plakat.0a1b2c3d", // cizí druh
    ]) {
      expect(decodeExhibitId(bad)).toBeNull();
    }
  });
});
