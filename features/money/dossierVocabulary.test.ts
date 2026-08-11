// Slovník strojových výrazů ručního spisu (/penize/kauzy), zapíchnutý.
//
// Kontrakt je týž jako u features/money/tieFlags.ts a features/overeni/
// gateVocabulary.ts: klasifikace tady, copy v katalogu, a NEZNÁMÝ TOKEN SE
// NESKRÝVÁ. Do 2026-08-11 propadalo „medium" / „primary" / „media" na
// nejcitlivější veřejnou plochu doslova, anglicky, jako by to byl text pro
// čtenáře — nebyl, jsou to identifikátory z payloadu.

import { describe, expect, it } from "vitest";
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import {
  DOSSIER_BOOL_KEYS,
  DOSSIER_COPY_KEYS,
  DOSSIER_EMPTY_TOKEN_KEY,
  DOSSIER_MACHINE_STRUCTURE_KEY,
  LEAD_DOSSIER_GATE_TOKEN,
  confidenceInfo,
  sourceKindInfo,
} from "./dossierVocabulary";
import { gateStatusInfo } from "@/features/overeni/gateVocabulary";

function lookup(catalog: unknown, dotted: string): unknown {
  return dotted
    .split(".")
    .reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), (catalog as Record<string, unknown>).money);
}

describe("spolehlivost spisu", () => {
  it("živý token korpusu („medium“) je klasifikovaný, ne propuštěný doslova", () => {
    const info = confidenceInfo("medium");
    expect(info.known).toBe(true);
    expect(info.kind).toBe("medium");
    expect(info.labelKey).toBe("kauzy.vocab.confidenceMedium");
  });

  it("case a mezery nerozhodují o tom, jestli slovník token zná", () => {
    expect(confidenceInfo("  HIGH ").kind).toBe("high");
    expect(confidenceInfo("Low").kind).toBe("low");
  });

  it("neznámý token se vypíše doslova a označí, nikdy neskryje ani neuhodne", () => {
    const info = confidenceInfo("velmi-vysoka");
    expect(info.known).toBe(false);
    expect(info.kind).toBe("unmapped");
    expect(info.token).toBe("velmi-vysoka");
    expect(info.labelKey).toBe("kauzy.vocab.unmappedTerm");
  });

  it("prázdná hodnota je stav s vlastním jménem, ne prázdno", () => {
    expect(confidenceInfo("").known).toBe(false);
    expect(confidenceInfo("").token).toBe("");
    // plocha za prázdný token dosadí DOSSIER_EMPTY_TOKEN_KEY
    expect(DOSSIER_EMPTY_TOKEN_KEY).toBe("kauzy.vocab.emptyToken");
  });
});

describe("druh zdroje tvrzení", () => {
  it("oba živé tokeny korpusu jsou klasifikované", () => {
    expect(sourceKindInfo("primary")).toMatchObject({ known: true, kind: "primary" });
    expect(sourceKindInfo("media")).toMatchObject({ known: true, kind: "media" });
  });

  it("neznámý druh se přizná, místo aby se zařadil k médiím", () => {
    const info = sourceKindInfo("court-filing");
    expect(info.known).toBe(false);
    expect(info.kind).toBe("unmapped");
    expect(info.token).toBe("court-filing");
  });
});

describe("stav brány ručního spisu", () => {
  it("je čekání na člověka a mluví TÝMŽ slovníkem jako /overeni", () => {
    const gate = gateStatusInfo(LEAD_DOSSIER_GATE_TOKEN);
    expect(gate.known).toBe(true);
    expect(gate.status).toBe("pending_review");
    // nikdy ne „ověřeno" — ruční podnět branou neprošel
    expect(gate.status).not.toBe("verified");
  });
});

describe("katalog zná každý klíč, který slovník umí vrátit", () => {
  it("cs i en nesou všechny klíče a žádný není prázdný", () => {
    expect(DOSSIER_COPY_KEYS).toContain(DOSSIER_MACHINE_STRUCTURE_KEY);
    expect(DOSSIER_COPY_KEYS).toContain(DOSSIER_BOOL_KEYS.true);
    for (const key of DOSSIER_COPY_KEYS) {
      for (const [name, catalog] of [
        ["cs", csCatalog],
        ["en", enCatalog],
      ] as const) {
        const value = lookup(catalog, key);
        expect(typeof value, `${name}: ${key}`).toBe("string");
        expect((value as string).length, `${name}: ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("klíč pro neznámý výraz nese {token} v obou jazycích — jinak by se token ztratil", () => {
    for (const catalog of [csCatalog, enCatalog]) {
      expect(lookup(catalog, "kauzy.vocab.unmappedTerm")).toContain("{token}");
    }
  });
});
