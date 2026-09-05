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

describe("stav ingest běhu v changelogu nenese jen glyf (2026-09-05, accessibility-checker)", () => {
  it("✓ / ✕ / … je aria-hidden a vedle něj stojí text stavu pro čtečku", () => {
    // Glyf + barva byly jediným nositelem stavu; čtečka četla „check mark“ nebo
    // „horizontal ellipsis“ a o selhání se nedozvěděla nic.
    expect(PAGE).toMatch(/<span aria-hidden className=\{r\.status === "failed"/);
    expect(PAGE).toMatch(/className="sr-only">\{t\(`changelog\.status\.\$\{r\.status\}`\)\}/);
  });

  it("každý stav IngestRunRow má větu v obou katalozích", () => {
    // Tři stavy jsou `IngestRunRow["status"]` (lib/db/types.ts) — typ se za běhu
    // neenumeruje, tak se drží výčtem a tsc hlídá, že je úplný.
    const statuses: Array<"running" | "ok" | "failed"> = ["running", "ok", "failed"];
    for (const s of statuses) {
      for (const text of inBoth(`dataReleases.changelog.status.${s}`)) expect(typeof text, s).toBe("string");
    }
  });
});

describe("zapečetěné běhy přiznají, kolik jich stránka NEukazuje (2026-09-05, state-coverage)", () => {
  it("výřez osmi nejnovějších jde přes pojmenovaný strop a věta o zbytku existuje v obou katalozích", () => {
    // `slice(0, 8)` bez věty: trezor vrátí až 50 zapečetěných běhů, stránka jich
    // vysázela osm a o zbytku mlčela — čtenář četl osm jako všechny.
    expect(PAGE).not.toMatch(/sealedRuns\.slice\(0, 8\)/);
    expect(PAGE).toMatch(/sealedRuns\.slice\(0, SEALED_RUNS_SHOWN\)/);
    expect(PAGE).toMatch(/sealed\.shownNewest/);
    for (const text of inBoth("dataReleases.sealed.shownNewest")) {
      expect(typeof text).toBe("string");
      expect(text as string).toContain("{count}");
      expect(text as string).toContain("{rest}");
    }
  });
});

describe("čísla vstupují do ICU vět už zformátovaná (2026-09-05, parity-auditor)", () => {
  it("noteValues rodiny feedu jdou přes f.int, ne surové do next-intl", () => {
    // Pravidlo z features/civicscore/formattedNumbers.test.ts: surové číslo v ICU
    // argumentu zformátuje next-intl vlastním Intl.NumberFormat mimo lib/format.
    expect(PAGE).not.toMatch(/t\(fam\.noteKey, fam\.noteValues\)/);
    expect(PAGE).toMatch(/t\(fam\.noteKey, icuValues\(fam\.noteValues\)\)/);
  });
});

describe("identifikátor běhu není množství (2026-09-05, bounty-hunter)", () => {
  it("„běh {id}“ dostává id jako řetězec, ne přes f.int (tisícová mezera by z běhu 1234 udělala „1 234“)", () => {
    expect(PAGE).not.toMatch(/f\.int\(r\.runId\)/);
    expect(PAGE).toMatch(/id: String\(r\.runId\)/);
  });
});
