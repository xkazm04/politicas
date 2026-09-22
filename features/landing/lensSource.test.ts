import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Přepočet skóre pod čtenářovými vahami má JEDNU definici — lens.reweigh
 * (/zebricek, /referendum, OG karta, widget). Titulní strana si do 2026-09-06
 * nesla vlastní `lensScore` s komentářem „TÝŽ vzorec jako lens.reweigh":
 * druhá implementace jednoho pravidla, kterou drží věta. Tenhle test drží, že
 * fasáda přepočet VOLÁ, ne opisuje. */

const src = readFileSync("features/landing/LandingPage.tsx", "utf8");

describe("titulní strana přepočítává čočkou přes lens.reweigh, ne vlastním vzorcem", () => {
  it("volá reweigh z features/civicscore/lens", () => {
    expect(src).toMatch(/\breweigh\(/);
    expect(src).toMatch(/import \{[^}]*\breweigh\b[^}]*\} from "@\/features\/civicscore\/lens"/);
  });

  it("nenese vlastní opis vzorce (clamp01 / lensScore)", () => {
    expect(src).not.toMatch(/function lensScore\b/);
    expect(src).not.toMatch(/clamp01/);
  });
});
