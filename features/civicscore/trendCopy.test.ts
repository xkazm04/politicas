// Copy panelu vývoje byla do 2026-08-04 jediná čtenářská česká věta v /poslanec, která
// nepatřila žádnému enginu a nebyla přibitá k bráně. Tady je obojí napraveno.

import { describe, expect, it } from "vitest";

import { looksEnglish } from "@/lib/analysis/language-gate";
import {
  TREND_COUNT_LABELS,
  TREND_PARTIAL_LABEL,
  trendHeading,
  trendPendingNote,
  trendSourceNote,
} from "./trendCopy";

describe("trendPendingNote", () => {
  it("mlčí, když nechybí žádná složka — panel pak netiskne žádnou výhradu", () => {
    expect(
      trendPendingNote({ priorTerm: "PSP9", pendingLabels: [], comparableLabels: ["Docházka"] }),
    ).toBeNull();
  });

  it("JMENUJE složky, které opravdu chybí, i ty srovnatelné", () => {
    const note = trendPendingNote({
      priorTerm: "PSP9",
      pendingLabels: ["Účast při hlasování", "Docházka"],
      comparableLabels: ["Práce ve výborech", "Legislativní výstup", "Vystoupení v sále"],
    })!;
    expect(note).toContain("Účast při hlasování a docházka");
    expect(note).toContain("Práce ve výborech".toLocaleLowerCase("cs"));
    expect(note).toContain("legislativní výstup a vystoupení v sále");
  });

  it("cituje dump jen pro období, kterého se týká — jinak si žádný nevymyslí", () => {
    const psp9 = trendPendingNote({ priorTerm: "PSP9", pendingLabels: ["Docházka"], comparableLabels: ["Docházka"] })!;
    expect(psp9).toContain("hl-2021ps.zip");
    const psp8 = trendPendingNote({ priorTerm: "PSP8", pendingLabels: ["Docházka"], comparableLabels: ["Docházka"] })!;
    expect(psp8).not.toContain(".zip");
    expect(psp8).toContain("PSP8");
  });

  it("přizná i případ, kdy není srovnatelná ani jedna složka", () => {
    const note = trendPendingNote({ priorTerm: "PSP9", pendingLabels: ["Docházka"], comparableLabels: [] })!;
    expect(note).toContain("žádná složka");
  });
});

describe("trendSourceNote", () => {
  it("uvede průchod grafu, když ho data nesou", () => {
    expect(trendSourceNote("PSP9", 42)).toContain("průchod grafu 42");
  });

  it("o průchodu MLČÍ, když ho data nenesou — číslo se nevymýšlí", () => {
    for (const p of [null, undefined, Number.NaN]) {
      expect(trendSourceNote("PSP9", p as number | null)).not.toMatch(/průchod grafu/);
    }
  });

  it("vždy cituje zdroj (brand rule: každé číslo nese svůj zdroj)", () => {
    expect(trendSourceNote("PSP9", 42)).toContain("psp.cz");
  });
});

describe("copy panelu vývoje — česká jazyková brána", () => {
  const ALL = [
    trendHeading("PSP9"),
    TREND_PARTIAL_LABEL,
    ...Object.values(TREND_COUNT_LABELS),
    trendSourceNote("PSP9", 42),
    trendPendingNote({
      priorTerm: "PSP9",
      pendingLabels: ["Účast při hlasování", "Docházka"],
      comparableLabels: ["Práce ve výborech"],
    })!,
    trendPendingNote({ priorTerm: "PSP9", pendingLabels: ["Docházka"], comparableLabels: [] })!,
  ];

  it("žádná věta neprojde jako anglická", () => {
    for (const s of ALL) {
      expect(s.length).toBeGreaterThan(0);
      expect(looksEnglish(s), s).toBe(false);
    }
  });
});
