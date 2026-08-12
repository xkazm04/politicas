/*
 * Katalog schránky, zapíchnutý.
 *
 * Schránka byla do 2026-08-12 jediná dvojjazyčná plocha bez pinu katalogu —
 * a přitom sází věty ze DVOU jmenných prostorů: vlastního `schranka.*` a
 * cizího `denik.*` (doslovné titulky řádků deníku a od téhle chvíle i věty
 * o mezích čtení, které skládá SDÍLENÝ `features/denik/limitNotes.ts`).
 * Přejmenovaný klíč na druhé straně té hranice se na ploše projeví syrovým
 * `denik.limits.kicker` uprostřed rámečku, který má přiznávat ztrátu.
 *
 * ROZSAH JE ZÁMĚRNĚ ÚZKÝ: shoda klíčů cs/en nad celým prostorem + věty, které
 * přidala tahle změna. Shodu ICU zástupných symbolů tenhle soubor NEDRŽÍ —
 * `kinds.*` jsou plurálové zprávy s jinými tvary v češtině (one/few/other) než
 * v angličtině (one/other) a naivní regex, kterým ji měří ostatní featury, na
 * nich hlásí rozdíl, který rozdílem není. Poctivější je to nepředstírat než
 * napsat pin se seznamem výjimek.
 */

import { describe, expect, it } from "vitest";
import { looksEnglish } from "@/lib/analysis/language-gate";
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

type Ns = Record<string, unknown>;

function flatten(ns: Ns, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ns)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Ns, key));
  }
  return out;
}

const cs = flatten(csCatalog.schranka as Ns);
const en = flatten(enCatalog.schranka as Ns);
const csDenik = flatten(csCatalog.denik as Ns);
const enDenik = flatten(enCatalog.denik as Ns);

describe("katalog schránky", () => {
  it("cs a en deklarují přesně tytéž klíče a žádná hodnota není prázdná", () => {
    expect(Object.keys(cs).sort()).toEqual(Object.keys(en).sort());
    for (const [k, v] of Object.entries(cs)) expect(v.trim(), `cs.${k}`).not.toBe("");
    for (const [k, v] of Object.entries(en)) expect(v.trim(), `en.${k}`).not.toBe("");
  });

  it("věta o mezích čtení je v obou katalozích a nic v ní nedosazuje", () => {
    // Rámující věta: čísla nesou až věty deníku pod ní, tahle jen říká, ČEHO se
    // strop týkal. Zástupný symbol by tu znamenal počet, který se nepočítá.
    expect(cs["limits.intro"]).toBeTruthy();
    expect(en["limits.intro"]).toBeTruthy();
    expect(cs["limits.intro"]).not.toMatch(/\{/);
    expect(en["limits.intro"]).not.toMatch(/\{/);
    expect(looksEnglish(cs["limits.intro"]), "cs.limits.intro").toBe(false);
    expect(cs["limits.intro"]).not.toEqual(en["limits.intro"]);
  });

  it("klíč, který plocha sází z cizího prostoru, v cizím prostoru opravdu je", () => {
    // SchrankaPage vykresluje nadpis rámečku přímo (`denik.limits.kicker`);
    // jednotlivé věty pod ním skládá limitNotes a ty drží denik/limitNotes.test.ts.
    expect(csDenik["limits.kicker"]).toBeTruthy();
    expect(enDenik["limits.kicker"]).toBeTruthy();
  });
});
