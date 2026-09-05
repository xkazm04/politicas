// Plocha /data — co její zdroják NESMÍ a MUSÍ obsahovat, připnuto grepem přes
// zdroj (v repozitáři není jsdom; vzor features/civicscore/formattedNumbers.test.ts).
// Každý describe nese datum a lens, který ho našel (scan-sweep).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

function stripComments(src: string): string {
  return src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const PAGE = stripComments(readFileSync("features/data-releases/DataReleasesPage.tsx", "utf8"));

type Nested = Record<string, unknown>;
const at = (catalog: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Nested)[k] : undefined), catalog);
const inBoth = (path: string) => [at(csCatalog, path), at(enCatalog, path)];

describe("certifikace bez čitelných počtů se nesází jako „0 z 0“ (2026-09-05, copy-auditor)", () => {
  it("null u checksHeld / checksTotal nepropadá přes `?? 0` do věty o invariantách", () => {
    // `checksHeld: number | null` — null znamená „report se nedal přečíst“, ne nula
    // platných; „platilo 0 z 0“ by o auditu tvrdilo výsledek, který nemá.
    expect(PAGE).not.toMatch(/checksHeld \?\? 0/);
    expect(PAGE).not.toMatch(/checksTotal \?\? 0/);
    expect(PAGE).toMatch(/current\.certificationNoCounts\./);
  });

  it("věta bez počtů existuje pro každý verdikt sentinela v obou katalozích", () => {
    for (const verdict of ["ok", "violation", "unevaluable"]) {
      for (const text of inBoth(`dataReleases.current.certificationNoCounts.${verdict}`)) {
        expect(typeof text, verdict).toBe("string");
        expect(text as string).toContain("{date}");
        expect(text as string).not.toMatch(/\{platnych\}|\{vsech\}/);
      }
    }
  });
});
