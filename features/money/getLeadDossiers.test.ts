// Kachní typ ručního spisu (/penize/kauzy), zapíchnutý.
//
// Loader čte VŠECHNY *.json z docs/data-analysis/case-money/payloads — dnes 18
// souborů, z nichž 2 jsou spisy a zbytek tabulky review-ranku, korroborační
// dumpy a migrační zápisy. Populace je DISKOVANÁ schválně (třetí spis nemá
// vyžádat deploy), takže jediné, co odděluje spis od dumpu, je `isDossier`.
// Když se ta podmínka utrhne, /penize/kauzy buď ztratí spis, nebo — hůř —
// vykreslí korroborační dump jako kauzu o jmenovaném člověku.
//
// Fixtury jsou MINIMÁLNÍ KOPIE tvarů, které v korpusu opravdu leží (union
// `mediaContext`: objekty × holé věty), NE zkopírované payloady: obsah spisu je
// citovaný cizí text a do testu nepatří.

import { describe, expect, it } from "vitest";
import { isDossier } from "./getLeadDossiers";
import { dossierAnchorId } from "./moneyTypes";

/** Tvar batch-005-lead-okamura: má `company`, `mediaContext` jsou OBJEKTY. */
const dossierWithCompany = {
  leadId: "T-test-1",
  subject: { name: "Testovaná Osoba", role: "poslanec", party: "TEST" },
  company: { name: "Testovka s.r.o.", ico: "27145433", legalForm: "s.r.o." },
  claims: [{ claim: "Claim text.", url: "https://example.test/a", accessedAt: "2026-07-25", sourceKind: "primary" }],
  registryFindings: { endpoint: "ARES VR /…", role_valid_from: "2004-05-20" },
  mediaContext: [{ outlet: "Outlet", url: "https://example.test/m", gist: "Gist." }],
  signalScore: 3,
  signalWhy: "Why.",
  whatSourcesSustain: "Sustained.",
  whatSourcesDoNotSustain: "Not sustained.",
  proposedAnnotation: { type: "annotation_only_proposal", note: "…" },
  confidence: "medium",
};

/** Tvar batch-005-lead-juchelka: BEZ `company`, `mediaContext` jsou VĚTY. */
const dossierWithoutCompany = {
  ...dossierWithCompany,
  leadId: "T-test-2",
  company: undefined,
  mediaContext: ["A bare sentence of media context.", "Another one."],
  signalScore: 4,
};
delete (dossierWithoutCompany as { company?: unknown }).company;

/** Skutečný sousední payload v témže adresáři — nesmí projít. */
const corroborationDump = {
  batch: "batch-001",
  generatedAt: "2026-07-20",
  ties: [{ tie: "6105:27145433", corroboration: "registry-confirmed" }],
};

describe("isDossier — co je spis a co jen soused v adresáři", () => {
  it("přijme oba živé tvary spisu, včetně spisu bez firmy a s holým mediaContextem", () => {
    expect(isDossier(dossierWithCompany)).toBe(true);
    expect(isDossier(dossierWithoutCompany)).toBe(true);
  });

  it("odmítne korroborační dump ze stejného adresáře", () => {
    expect(isDossier(corroborationDump)).toBe(false);
  });

  it("odmítne payload, kterému chybí kterékoli pole, jež plocha vykresluje", () => {
    // Každé z těchhle polí plocha ČTE: chybějící by znamenalo prázdný odstavec,
    // `undefined` v slovníku nebo pád `.map`/`Object.entries` na tvaru, který
    // loader prohlásil za spis.
    for (const key of [
      "leadId",
      "subject",
      "claims",
      "mediaContext",
      "registryFindings",
      "proposedAnnotation",
      "signalScore",
      "signalWhy",
      "confidence",
      "whatSourcesSustain",
      "whatSourcesDoNotSustain",
    ]) {
      const broken: Record<string, unknown> = { ...dossierWithCompany };
      delete broken[key];
      expect(isDossier(broken), `chybí ${key}`).toBe(false);
    }
  });

  it("odmítne špatně typovaná pole, ne jen chybějící", () => {
    expect(isDossier({ ...dossierWithCompany, claims: "one claim" })).toBe(false);
    expect(isDossier({ ...dossierWithCompany, mediaContext: {} })).toBe(false);
    expect(isDossier({ ...dossierWithCompany, registryFindings: null })).toBe(false);
    expect(isDossier({ ...dossierWithCompany, subject: null })).toBe(false);
    expect(isDossier({ ...dossierWithCompany, signalScore: "3" })).toBe(false);
  });

  it("odmítne cokoli, co není objekt", () => {
    expect(isDossier(null)).toBe(false);
    expect(isDossier(undefined)).toBe(false);
    expect(isDossier("Q-money-5")).toBe(false);
    expect(isDossier([dossierWithCompany])).toBe(false);
  });
});

describe("kotva spisu", () => {
  it("je odvozená z leadId, ne z pozice v poli", () => {
    // Seznam se řadí podle signálu — index by třetí kauzou přeadresoval obě
    // stávající a každý dřív zkopírovaný odkaz by ukázal na jiný spis.
    expect(dossierAnchorId("Q-money-5")).toBe("kauza-q-money-5");
    expect(dossierAnchorId("Q-money-6")).toBe("kauza-q-money-6");
    expect(dossierAnchorId(" Q money 7 ")).toBe("kauza-q-money-7");
  });

  it("prázdné leadId kotvu nedostane (raději žádná adresa než „ten první“)", () => {
    expect(dossierAnchorId("")).toBeNull();
    expect(dossierAnchorId("   ")).toBeNull();
    expect(dossierAnchorId("///")).toBeNull();
  });
});
