// Velín a exponát — co jejich zdroják NESMÍ a MUSÍ obsahovat, připnuto grepem
// přes zdroj (v repozitáři není jsdom; vzor features/civicscore/formattedNumbers.test.ts).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function stripComments(src: string): string {
  return src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const PAGE = stripComments(readFileSync("features/dashboard/DashboardPage.tsx", "utf8"));
const EXHIBIT = stripComments(readFileSync("features/dashboard/ExhibitPage.tsx", "utf8"));

describe("čísla jdou do DOM i do ICU vět už zformátovaná (2026-09-06, copy-auditor)", () => {
  it("počet poslanců vstupuje do tří vět přes f.int, ne jako surové číslo", () => {
    // next-intl by surové číslo protáhl vlastním Intl.NumberFormat mimo lib/format —
    // pravidlo, které tenhle soubor jinde už drží (f.int(p.covered), f.int(m.tiedCount)).
    expect(PAGE).not.toMatch(/count: data\.summary\.count\b/);
    expect(PAGE.match(/count: f\.int\(data\.summary\.count\)/g)?.length).toBe(3);
  });

  it("pořadí v žebříčku velína se sází přes f.int", () => {
    expect(PAGE).not.toMatch(/>\s*\{m\.rank\}\s*</);
    expect(PAGE).toMatch(/\{f\.int\(m\.rank\)\}/);
  });

  it("průchod grafu má v celém velínu jedno formátování — totéž, jaké má exponát (f.int)", () => {
    // ExhibitPage: `t("graphPass", { pass: f.int(pass) })`; velín posílal totéž číslo
    // surové na čtyřech místech. Jedna plocha, dva zápisy téhož čísla.
    expect(PAGE).not.toMatch(/pass: p\.pass \?\? "—"/);
    expect(PAGE).not.toMatch(/pass: data\.money\.pass \}/);
    expect(PAGE).not.toMatch(/pass: data\.laws\.pass \?\? "—"/);
    expect(PAGE).toMatch(/const passLabel = /);
    expect(EXHIBIT).toMatch(/pass: f\.int\(pass\)/);
  });
});

describe("nic na exponátu není jen pro desktop (2026-09-06, mobile-specialist)", () => {
  it("datum znovuodvození v hlavičce nenese `hidden sm:block` — velín to pravidlo přijal 2026-08-12, exponát ne", () => {
    expect(EXHIBIT).not.toMatch(/hidden sm:block/);
    expect(EXHIBIT).toMatch(/flex flex-col gap-2 px-6 py-3\.5 sm:flex-row sm:items-center sm:justify-between/);
  });
});

describe("chybějící strop není nula (2026-09-06, state-coverage)", () => {
  it("věta o stropu smluv se sází jen s reálným stropem — `perCompanyCap ?? 0` by tiskla „strop 0“", () => {
    // `perCompanyCap` je `number | null` nezávisle na `isFloor`; spis poslance
    // (MpCaseFilePage) větu podmiňuje `!== null`, velín ji dopočítával nulou.
    expect(PAGE).not.toMatch(/perCompanyCap \?\? 0/);
    expect(PAGE).toMatch(/data\.money\.isFloor && data\.money\.perCompanyCap !== null && \(/);
  });
});
