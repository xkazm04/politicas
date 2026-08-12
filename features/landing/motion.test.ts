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

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LANDING = "features/landing";
const SHARED = "features/shared/components";

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

/**
 * SDÍLENÉ komponenty, které si fasáda IMPORTUJE — a které se tím na titulní
 * straně vykreslí. Seznam se ODVOZUJE z importů, ne vypisuje: nově importovaná
 * pohyblivá komponenta z katalogu se tak dostane pod pravidlo sama.
 *
 * Proč to sem vůbec patří: `SectionRule` (65 montáží na 20 stranách) preferenci
 * „méně pohybu" ignoroval půl roku právě proto, že tenhle test končil na hranici
 * `features/landing/**`. Pravidlo se ale netýká složky, ale toho, co se čtenáři
 * hýbe před očima.
 */
function sharedMotionSourcesUsedByLanding(): string[] {
  const names = new Set<string>();
  for (const p of landingSources()) {
    for (const [, name] of readFileSync(p, "utf8").matchAll(
      /from "@\/features\/shared\/components\/([A-Za-z0-9_]+)"/g,
    )) {
      names.add(name);
    }
  }
  return [...names]
    .map((n) => join(SHARED, `${n}.tsx`).replace(/\\/g, "/"))
    .filter((p) => existsSync(p) && readFileSync(p, "utf8").includes("framer-motion"))
    .sort();
}

const SHARED_MOTION_SOURCES = sharedMotionSourcesUsedByLanding();

/** Prodlevy a délky zapsané v JSX propu `transition={{ … }}`. Užší záběr než
 *  u fasády záměrně: `AnimatedScore` hlídá preferenci IMPERATIVNĚ (`if
 *  (reduceMotion) return` před `animate()`), což grep přes celý soubor vidět
 *  nemůže — a zeslabit kvůli tomu pravidlo na textovou shodu by z něj udělalo
 *  ozdobu. Deklarativní přechod, který se dojíždí i při vypnutém pohybu, je
 *  přitom přesně ta chyba, kvůli které blok vznikl. */
function jsxTransitionTimings(src: string): string[] {
  const out: string[] = [];
  for (const [, body] of src.matchAll(/transition=\{\{([^}]*)\}\}/g)) {
    for (const [, key, value] of body.matchAll(/\b(delay|duration):\s*([^,}\n]+)/g)) {
      out.push(`${key}: ${value}`);
    }
  }
  return out;
}

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

describe("sdílené komponenty vykreslené fasádou respektují tutéž preferenci", () => {
  it("nějaká pohyblivá sdílená komponenta se na fasádě vykresluje", () => {
    expect(SHARED_MOTION_SOURCES.length).toBeGreaterThan(0);
  });

  it.each(SHARED_MOTION_SOURCES)("%s si preferenci vyžádá (useReducedMotion)", (path) => {
    const src = readFileSync(path, "utf8");
    expect(src).toMatch(/import \{[^}]*useReducedMotion[^}]*\} from "framer-motion"/);
    expect(src).toMatch(/const reduceMotion = useReducedMotion\(\)/);
  });

  // Platí i pro `whileInView`: bez podmíněného `initial` je to týž náběh, jen
  // spuštěný scrollem — a právě tak vypadalo pravítko sekce.
  it.each(SHARED_MOTION_SOURCES)("%s nemá žádný nepodmíněný počáteční stav", (path) => {
    const ungated = [...readFileSync(path, "utf8").matchAll(/initial=\{\{/g)];
    expect(ungated, `${path}: initial={{ … }} se přehraje i při prefers-reduced-motion`).toEqual([]);
  });

  it.each(SHARED_MOTION_SOURCES)("%s nuluje prodlevu i délku deklarativního přechodu", (path) => {
    for (const timing of jsxTransitionTimings(readFileSync(path, "utf8"))) {
      expect(timing, `${path}: ${timing}`).toMatch(/reduceMotion/);
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
