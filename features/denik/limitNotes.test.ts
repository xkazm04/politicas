// Meze čtení deníku — každý strop, který smí ztratit řádek, se musí PŘIZNAT.
//
// Nejde o kosmetiku: /denik i /dukazy tisknou počet rozhodnutí lidské brány
// jako délku pole, které repozitář `listReviewAudit` vrací s tvrdým stropem a
// u kterého sám varuje, že useknuté čtení „publikuje špatné číslo". Do
// 2026-08-12 to obě plochy tvrdily jako počet a ani jedna neuměla říct, že se
// čtení zastavilo. Test hlídá dvě věci: že se useknutí VYSLOVÍ, a že věta,
// kterou plocha vysloví, v katalogu skutečně existuje — v OBOU jazycích.

import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { limitNotes } from "./limitNotes";
import type { DenikLedger } from "./deriveDenik";
import type { DenikLimits } from "./getDenikData";

/** Žádná mez se nedotkla dat — plocha nemá co říct. */
const CLEAN: DenikLimits = {
  contractCompanies: 57,
  companyCap: 500,
  companiesOverCap: 0,
  edgeCap: 5_000,
  companiesEdgeTruncated: 0,
  malformedIco: 0,
  changesFromGate: 0,
  changesUndisplayable: 0,
  auditCap: 10_000,
  auditTruncated: false,
  changeCap: 5_000,
  changesRead: 0,
  changesTruncated: false,
};

const ledger = (over: Partial<DenikLedger> = {}): DenikLedger => ({
  days: [],
  daysTotal: 0,
  totalEntries: 0,
  consideredEntries: 0,
  droppedImplausible: 0,
  mergedContractRows: 0,
  contractAmountConflicts: 0,
  ...over,
});

const keysOf = (limits: DenikLimits, led: DenikLedger | null = null) =>
  limitNotes(limits, led, "cs").map((n) => n.key);

/** Číslice zformátovaného čísla — oddělovač tisíců vlastní lib/format. */
const digits = (s: string) => s.replace(/\D/g, "");

/** Rozbalí `denik.limits.auditTruncated` z katalogu, nebo undefined. */
function catalogValue(catalog: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, catalog);
}

describe("limitNotes — mez, která se nedotkla dat, je pojistka, ne sdělení", () => {
  it("čisté čtení nevypíše žádnou větu", () => {
    expect(limitNotes(CLEAN, ledger(), "cs")).toEqual([]);
  });
});

describe("limitNotes — strop lidské brány", () => {
  it("useknuté čtení brány se vysloví a pojmenuje svůj strop", () => {
    const notes = limitNotes({ ...CLEAN, auditTruncated: true }, null, "cs");
    expect(notes.map((n) => n.key)).toEqual(["limits.auditTruncated"]);
    // Strop je ve větě jako ČÍSLO — bez něj čtenář neví, kde se čtení
    // zastavilo. Porovnává se na číslicích: oddělovač tisíců vlastní
    // lib/format, ne tenhle test.
    expect(digits(notes[0].values.cap)).toBe("10000");
  });

  it("bez useknutí mlčí, i když se přečetl plný korpus", () => {
    expect(keysOf({ ...CLEAN, auditTruncated: false })).not.toContain("limits.auditTruncated");
  });
});

describe("limitNotes — strop proudu „zaznamenáno“", () => {
  it("useknutí přizná strop I počet skutečně přečtených událostí", () => {
    const notes = limitNotes({ ...CLEAN, changesTruncated: true, changesRead: 4_999 }, null, "cs");
    expect(notes.map((n) => n.key)).toEqual(["limits.changesTruncated"]);
    expect(digits(notes[0].values.cap)).toBe("5000");
    expect(digits(notes[0].values.n)).toBe("4999");
  });

  it("nepřiznává se za proud, který se jen nepřečetl celý omylem — jen za dosažený strop", () => {
    expect(keysOf({ ...CLEAN, changesRead: 4_999 })).toEqual([]);
  });
});

describe("limitNotes — všechny meze pohromadě", () => {
  it("každá dotčená mez má právě jednu větu a pořadí je deterministické", () => {
    const keys = keysOf(
      {
        ...CLEAN,
        companiesOverCap: 3,
        companiesEdgeTruncated: 5,
        malformedIco: 2,
        auditTruncated: true,
        changesTruncated: true,
        changesRead: 5_000,
        changesUndisplayable: 1,
        changesFromGate: 4,
      },
      ledger({ mergedContractRows: 5, contractAmountConflicts: 1 }),
    );
    expect(keys).toEqual([
      "limits.companiesOverCap",
      "limits.companiesEdgeTruncated",
      "limits.malformedIco",
      "limits.auditTruncated",
      "limits.changesTruncated",
      "limits.changesUndisplayable",
      "limits.changesFromGate",
      "limits.mergedContractRows",
      "limits.contractAmountConflicts",
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("každý klíč, který plocha může vyslovit, je v OBOU katalozích", () => {
    // Přiznání, které se přeloží na prázdno, je horší než mlčení: čtenář vidí,
    // že se něco stalo, a nedozví se co.
    for (const key of keysOf(
      {
        ...CLEAN,
        companiesOverCap: 3,
        companiesEdgeTruncated: 5,
        malformedIco: 2,
        auditTruncated: true,
        changesTruncated: true,
        changesRead: 5_000,
        changesUndisplayable: 1,
        changesFromGate: 4,
      },
      ledger({ mergedContractRows: 5, contractAmountConflicts: 1 }),
    )) {
      expect(catalogValue(csCatalog, `denik.${key}`), key).toBeTruthy();
      expect(catalogValue(enCatalog, `denik.${key}`), key).toBeTruthy();
    }
  });
});
