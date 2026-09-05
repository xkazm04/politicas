// Komponenty velína — co jejich zdroják NESMÍ a MUSÍ obsahovat, připnuto grepem
// přes zdroj (v repozitáři není jsdom; vzor features/civicscore/formattedNumbers.test.ts).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

function stripComments(src: string): string {
  return src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}
const read = (p: string) => stripComments(readFileSync(`features/dashboard/components/${p}`, "utf8"));

type Nested = Record<string, unknown>;
const at = (catalog: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Nested)[k] : undefined), catalog);
const inBoth = (path: string) => [at(csCatalog, path), at(enCatalog, path)];

describe("čísla jdou do DOM i do ICU vět už zformátovaná (2026-09-06, copy-auditor)", () => {
  it("ChamberChart dává počet poslanců do popisky histogramu přes f.int", () => {
    const src = read("ChamberChart.tsx");
    expect(src).not.toMatch(/t\("histogram\.label", \{ count \}\)/);
    expect(src).toMatch(/t\("histogram\.label", \{ count: f\.int\(count\) \}\)/);
  });

  it("MockRankingLedger sází pořadí přes f.int — stejně jako reálný žebříček velína od f160c7e", () => {
    const src = read("MockRankingLedger.tsx");
    expect(src).not.toMatch(/>\s*\{m\.rank\}\s*</);
    expect(src).toMatch(/\{f\.int\(m\.rank\)\}/);
  });
});

describe("odkazy v textové podobě grafu jsou pojmenované, ne sedmnáctkrát „poslanec“ (2026-09-06, accessibility-checker)", () => {
  it("odkaz na spis i na deník entity nese aria-label s jménem uzlu — pravidlo, které FactRow už drží", () => {
    const src = read("GraphNodeList.tsx");
    expect(src).toMatch(/aria-label=\{tg\("list\.caseFileNamed", \{ kind: t\.kind, label: t\.label \}\)\}/);
    expect(src).toMatch(/aria-label=\{tg\("list\.denikNamed", \{ label: t\.label \}\)\}/);
  });

  it("obě věty existují v obou katalozích a nesou {label}", () => {
    for (const key of ["dashboard.graph.list.caseFileNamed", "dashboard.graph.list.denikNamed"]) {
      for (const text of inBoth(key)) {
        expect(typeof text, key).toBe("string");
        expect(text as string).toContain("{label}");
      }
    }
  });
});
