// Fasáda a preference „méně pohybu" (2026-08-12).
//
// Proč tenhle test existuje: titulní strana byla JEDINÁ plocha aplikace, která
// `prefers-reduced-motion` ignorovala. Sesterské plochy (LeaderboardTable,
// ScoreHistogram, HeadToHead, DashboardPage, BudgetMirrorPage, AnimatedScore)
// se tou preferencí řídí a repozitář si na to dokonce veze vlastní lint pravidlo
// — jenže `custom/enforce-reduced-motion-fallback` hlídá SMYČKY (`repeat`), a
// nábeh při vstupu do viewportu žádná smyčka není. Tahle mezera nechala hero,
// hemicykl i seznam nástrojů hýbat se člověku, který si vyžádal klid.
//
// Testuje se GREPEM přes zdroj, ne renderem: repozitář nemá jsdom ani
// testing-library (viz CLAUDE.md /dashboard — tamní klávesnice se z téhož
// důvodu ověřovala živým průchodem). Levné a trvanlivé; precedens je
// lib/analysis/public-copy.test.ts („source-grep guard, not a runtime check").

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LANDING = "features/landing";

/** Všechny .tsx zdroje fasády (kořen + components/), cestou od kořene repa. */
function landingSources(): string[] {
  const out: string[] = [];
  for (const dir of [LANDING, join(LANDING, "components")]) {
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".tsx")) out.push(join(dir, f).replace(/\\/g, "/"));
    }
  }
  return out;
}

const MOTION_SOURCES = landingSources().filter((p) => readFileSync(p, "utf8").includes("framer-motion"));

describe("fasáda respektuje prefers-reduced-motion", () => {
  it("vůbec nějaký pohyb na fasádě je — jinak tenhle test nic nehlídá", () => {
    expect(MOTION_SOURCES.length).toBeGreaterThan(0);
  });

  it.each(MOTION_SOURCES)("%s si preferenci vyžádá (useReducedMotion)", (path) => {
    const src = readFileSync(path, "utf8");
    expect(src).toMatch(/import \{[^}]*useReducedMotion[^}]*\} from "framer-motion"/);
    expect(src).toMatch(/const reduceMotion = useReducedMotion\(\)/);
  });

  // Holý `initial={{ … }}` = nábeh, který se přehraje VŽDY. Podmíněný zápis
  // `initial={reduceMotion ? false : { … }}` je idiom zbytku aplikace
  // (features/votetrack/components/RealDisciplineBoard.tsx) a `false` znamená
  // „vysaď rovnou na cílové hodnoty".
  it.each(MOTION_SOURCES)("%s nemá žádný nepodmíněný počáteční stav", (path) => {
    const src = readFileSync(path, "utf8");
    const ungated = [...src.matchAll(/initial=\{\{/g)];
    expect(ungated, `${path}: initial={{ … }} se přehraje i při prefers-reduced-motion`).toEqual([]);
  });

  // Prodleva ani délka se nesmí protáhnout, když se pohyb nemá konat: samotné
  // `initial={false}` u `whileInView` nestačí, protože cílový stav by se pořád
  // dojížděl s náběhem.
  it.each(MOTION_SOURCES)("%s nuluje prodlevu i délku přechodu", (path) => {
    const src = readFileSync(path, "utf8");
    for (const [, key, value] of src.matchAll(/\b(delay|duration):\s*([^,}\n]+)/g)) {
      expect(value, `${path}: ${key}: ${value}`).toMatch(/reduceMotion/);
    }
  });
});

// WCAG 2.4.7. Šest posuvníků vah je hlavní interakce titulní strany; `.k-range`
// mělo `outline: none` a v celém souboru neexistovalo jediné `:focus-visible`,
// takže se ovládaly tabulátorem naslepo. Táž třída obsluhuje i WeightPanel na
// /zebricek, proto je oprava v CSS a ne v komponentě.
describe("posuvník vah je vidět i pod klávesnicí", () => {
  const css = readFileSync("app/globals.css", "utf8");

  it("deklaruje prstenec pro :focus-visible", () => {
    expect(css).toMatch(/\.k-range:focus-visible\s*\{[^}]*outline:/);
  });

  it("prstenec je z tokenu, ne z literálního hexu", () => {
    const rule = css.match(/\.k-range:focus-visible\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/var\(--color-[a-z-]+\)/);
    expect(rule).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(rule).not.toMatch(/outline:\s*none/);
  });
});
