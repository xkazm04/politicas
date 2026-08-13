/*
 * NEMOŽNÉ DATUM MÁ JEDNU HRANICI — pokrytí na MÍSTECH VOLÁNÍ.
 *
 * `lib/analysis/plausible-date.test.ts` testuje čisté pravidlo a záměrně žádné
 * místo volání — a přesně proto se tři z nich rozešly: `/penize/[pspId]` četlo
 * `props.signedOn` bez kontroly a tisklo ho doslova, důkazní paket ho zapékal
 * do otiskem orazítkovaného svazku, a `/rozpocty` mělo vlastní mez.
 *
 * Tenhle soubor drží dvě z těch míst (peněžní modul); rozpočtovou mez drží
 * `features/budget/supplierYears.test.ts`.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { edgeClaimRef } from "@/features/shared/provenance/claimRef";
import { PLAUSIBLE_FROM } from "@/lib/analysis/plausible-date";
import { gateContractDates } from "./moneyLoader";
import { foldBasis } from "./amountBasis";
import { compileEvidencePacket } from "./packet";
import { displaySignedOn } from "./moneyTypes";
import type { ContractLine, MoneyMpDetail, MoneyTieDetail } from "./moneyTypes";
import type { ReviewState } from "./reviewTypes";

const TODAY = "2026-08-13";

function line(over: Partial<ContractLine> = {}): ContractLine {
  return {
    id: "contract:1",
    label: "Smlouva",
    amountCzk: 1_000_000,
    signedOn: "2019-05-06",
    // Daňová základna řádku — tady jen výplň, testuje se v `amountBasis.test.ts`.
    amountBasis: "bezDph",
    ...over,
  };
}

const shown = (l: ContractLine) => displaySignedOn(gateContractDates([l], TODAY)[0]);

describe("gateContractDates — spis poslance kreslí tutéž hranici jako spis firmy", () => {
  it("nechá projít datum, které se stát mohlo", () => {
    const [r] = gateContractDates([line({ signedOn: "2019-05-06" })], TODAY);
    expect(r.dateWithheldOn).toBeUndefined();
    expect(displaySignedOn(r)).toBe("2019-05-06");
  });

  it.each(["0002-01-01", "1970-03-01", "2027-01-01", "3062-12-31"])(
    "odmítne nemožný podpis %s — a NIKDY ho neopraví",
    (bad) => {
      const [r] = gateContractDates([line({ signedOn: bad })], TODAY);
      expect(r.dateWithheldOn).toBe(TODAY);
      // Na plochu se nedostane žádnou cestou…
      expect(displaySignedOn(r)).toBeNull();
      // …a hodnota se ani neopraví na jinou (potlačit ≠ vymyslet).
      expect(r.signedOn).toBe(bad);
    },
  );

  it("řádek ani částka se nezahazují — chybný je údaj o datu, ne smlouva", () => {
    const [r] = gateContractDates([line({ id: "contract:9", label: "Rámcová", amountCzk: 4_200, signedOn: "3062-01-01" })], TODAY);
    expect(r.id).toBe("contract:9");
    expect(r.label).toBe("Rámcová");
    expect(r.amountCzk).toBe(4_200);
  });

  it("„datum nebylo“ a „datum bylo nemožné“ zůstávají DVĚ různá tvrzení", () => {
    const [none, bad] = gateContractDates(
      [line({ id: "a", signedOn: null }), line({ id: "b", signedOn: "0002-01-01" })],
      TODAY,
    );
    expect(displaySignedOn(none)).toBeNull();
    expect(none.dateWithheldOn).toBeUndefined(); // nedatovaná smlouva NIC nezamlčuje
    expect(displaySignedOn(bad)).toBeNull();
    expect(bad.dateWithheldOn).toBe(TODAY); // a den, proti kterému se měřilo, se tiskne
  });

  it("hranice je ta sdílená, ne druhá kopie", () => {
    // Den vzniku ČR projde, den před ním ne — kdyby si modul držel vlastní mez,
    // tahle dvojice by se rozešla.
    expect(shown(line({ signedOn: PLAUSIBLE_FROM }))).toBe(PLAUSIBLE_FROM);
    expect(shown(line({ signedOn: "1992-12-31" }))).toBeNull();
    // Horní mez je předaný den, ne hodiny.
    expect(shown(line({ signedOn: TODAY }))).toBe(TODAY);
    expect(shown(line({ signedOn: "2026-08-14" }))).toBeNull();
  });

  it("hrubá hodnota zůstává, protože ji přepočítává spis poslance", () => {
    // `features/profile/profileMoney.ts` (7d1e274) si `dateUnusable` odvozuje
    // z hrubého `signedOn`. Kdyby ho loader vymazal, /poslanec by TIŠE přestal
    // přiznávat vadná data — výpadek přiznání se za dedup neplatí. Pin drží obě
    // strany: hrubá hodnota tam je, a na plochu vede jen `displaySignedOn`.
    const [r] = gateContractDates([line({ signedOn: "0002-01-01" })], TODAY);
    expect(r.signedOn).toBe("0002-01-01");
    const profile = readFileSync("features/profile/profileMoney.ts", "utf8");
    expect(profile).toMatch(/plausibleIsoDateOrNull\(/);
  });

  it("uplatňuje se v řezu poslance, ne ve SDÍLENÉM čtení smluv", () => {
    // Firemní spis si svůj `implausibleDateCount` počítá sám, nad řádky, které
    // vykresluje, a to číslo je publikované. Kdyby hranice spadla do
    // `readCompanySupplies`, napočítal by nulu — proto se hlídá, kde stojí.
    const src = readFileSync("features/money/moneyLoader.ts", "utf8");
    const shared = src.slice(src.indexOf("async function readCompanySupplies"), src.indexOf("const companySupplies = new Map"));
    expect(shared).not.toContain("gateContractDates");
    expect(src).toMatch(/linesByCompany\.set\(id, gateContractDates\(/);
  });

  it("plocha spisu poslance sází datum JEN přes displaySignedOn", () => {
    // Tady stálo `{c.signedOn}` doslova. Pin je na tvar, ne na text věty.
    const page = readFileSync("features/money/MpCaseFilePage.tsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(page).toMatch(/displaySignedOn\(c\)/);
    expect(page).not.toMatch(/\{c\.signedOn\}/);
  });
});

/* ── důkazní paket ─────────────────────────────────────────────────────────── */

let seq = 0;
function mkTie(contracts: ContractLine[]): MoneyTieDetail {
  seq++;
  const id = `company:ico:${10000000 + seq}`;
  return {
    companyId: id,
    receiptRef: edgeClaimRef("psp:person:1", "linked_to", id),
    ico: String(10000000 + seq),
    company: `Firma ${seq} s.r.o.`,
    role: "jednatel",
    reviewState: "verified" as ReviewState,
    source: "hlidac:osoby/test-osoba · 2016-01-01–ongoing",
    contractBasis: foldBasis(contracts.map((c) => c.amountBasis)),
    contractCount: contracts.length,
    contractCzk: 1_000_000,
    subsidiesCount: 0,
    subsidiesCzk: 0,
    donatedToPartyCzk: null,
    donationRecipientParty: null,
    corroboration: "registry-confirmed",
    roleValidFrom: "2016-01-01",
    roleValidTo: null,
    temporalStatus: "current",
    corroborationSource: null,
    corroborationProvenance: { pass: null, method: null, ref: null, computedAt: null },
    tieClass: "owner-operator",
    tieClassOrigin: "stored",
    tieClassHeuristic: "owner-operator",
    triangle: false,
    nearThresholdCount: 0,
    deMinimis: false,
    signalScore: 10,
    reviewTier: 0,
    reviewRank: seq,
    reviewOrderOrigin: "derived",
    reviewNote: null,
    reviewerNote: null,
    lastDecision: "confirm",
    lastReviewer: "recenzent",
    lastReviewedAt: "2026-07-20T10:00:00Z",
    ownerStakePct: null,
    priorTerm: null,
    falseEdgeSuspected: false,
    flags: [],
    contracts,
    contractsMoreCount: 0,
  };
}

function mkDetail(ties: MoneyTieDetail[]): MoneyMpDetail {
  return {
    pspId: 6543,
    name: "Testovací Poslankyně",
    club: "TEST",
    absenteeManagerLead: false,
    ties,
    money: {
      attributable: { companies: 0, contractCount: 0, contractCzk: 0, subsidiesCzk: 0, donatedToPartyCzk: 0 },
      steward: { companies: 0, contractCount: 0, contractCzk: 0, subsidiesCzk: 0, donatedToPartyCzk: 0 },
      totalCzk: 0,
      companies: 0,
      coverage: { perCompanyCap: null, companiesAtCap: 0, isFloor: false },
    },
    source: "test",
    pass: 42,
  };
}

describe("compileEvidencePacket — svazek s otiskem musí říct, co upustil", () => {
  const withheld = gateContractDates([line({ id: "c:bad", signedOn: "3062-01-01" })], TODAY);
  const undated = [line({ id: "c:none", signedOn: null })];
  const good = [line({ id: "c:ok", signedOn: "2019-05-06" })];

  it("rozlišuje nedatovanou smlouvu od smlouvy s potlačeným datem", () => {
    const p = compileEvidencePacket(mkDetail([mkTie([...good, ...undated, ...withheld])]), {
      compiledAt: TODAY,
    });
    expect(p.undatedContracts).toBe(1);
    expect(p.withheldDateContracts).toBe(1);
    // Do časové osy se dostane jen ta datovaná.
    expect(p.timeline.filter((e) => e.kind === "contract").map((e) => e.date)).toEqual(["2019-05-06"]);
    // A do STAŽITELNÉHO svazku se nemožné datum nedostane vůbec — na rozdíl od
    // spisu, kde hrubá hodnota zůstává kvůli přepočtu /poslance, se paket po
    // vydání neopravuje, takže se do něj nezapéká.
    expect(JSON.stringify(p.ties)).not.toContain("3062");
    expect(p.ties[0].contracts.find((c) => c.id === "c:bad")!.signedOn).toBeNull();
    expect(p.ties[0].contracts.find((c) => c.id === "c:bad")!.dateWithheldOn).toBe(TODAY);
  });

  it("přiznává potlačené datum v CITACI — tedy v tom, co se z paketu kopíruje", () => {
    const p = compileEvidencePacket(mkDetail([mkTie([...good, ...withheld])]), { compiledAt: TODAY });
    expect(p.ties[0].citeCs).toMatch(/nemohlo nastat/);
    expect(p.ties[0].citeCs).toMatch(/datum je zamlčené, částka i smlouva zůstávají/);
    expect(p.ties[0].citeCs).toMatch(/13\. 8\. 2026/); // den, proti kterému se měřilo
    // Odmítnuté datum se do citace nikdy nedostane.
    expect(p.ties[0].citeCs).not.toContain("3062");
  });

  it("citace mlčí, když není co přiznat", () => {
    const p = compileEvidencePacket(mkDetail([mkTie(good)]), { compiledAt: TODAY });
    expect(p.ties[0].citeCs).not.toMatch(/nemohlo nastat/);
    expect(p.withheldDateContracts).toBe(0);
  });

  it("otisk se hne JEN tam, kde se změnil obsah", () => {
    // Řádek bez potlačení serializuje beze změny (canonicalJson vynechává
    // `undefined`), takže paket bez vadného data má týž otisk jako dřív…
    seq = 0;
    const a = compileEvidencePacket(mkDetail([mkTie(good)]), { compiledAt: TODAY });
    seq = 0;
    const b = compileEvidencePacket(mkDetail([mkTie(good)]), { compiledAt: "2026-01-01" });
    expect(a.hash).toBe(b.hash); // otisk nezávisí na dni sestavení

    // …zatímco vazba s potlačeným datem má otisk JINÝ než tatáž vazba, kde
    // datum prostě nebylo. To je čekaná změna: dvě různá tvrzení nesmějí mít
    // jeden otisk.
    seq = 0;
    const c = compileEvidencePacket(mkDetail([mkTie(withheld)]), { compiledAt: TODAY });
    seq = 0;
    const d = compileEvidencePacket(mkDetail([mkTie([line({ id: "c:bad", signedOn: null })])]), {
      compiledAt: TODAY,
    });
    expect(c.hash).not.toBe(d.hash);
  });

  it("brána paketu se tím nehnula: nepotvrzená vazba se dovnitř nedostane", () => {
    const p = compileEvidencePacket(
      mkDetail([{ ...mkTie(withheld), reviewState: "pending_review" as ReviewState }]),
      { compiledAt: TODAY },
    );
    expect(p.ties).toHaveLength(0);
    expect(p.exclusions.pending).toBe(1);
    expect(p.withheldDateContracts).toBe(0); // nic se nevykresluje, tedy ani nezamlčuje
  });
});
