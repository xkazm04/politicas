// /dukazy — přístupnost věstníku, připnutá GREPEM PŘES ZDROJ (vzor
// features/shell/a11y.test.ts; bez jsdom se ověřuje zapojení ve zdroji).
//
// CO TU BYLO ŽIVÉ do 2026-09-05: každý záznam je <article id="z-<id>"> bez
// přístupného jména — odečítačka ohlásí „článek", „článek", „článek" a čtenář
// se v seznamu rozhodnutí nemá čeho chytit, zatímco /denik svým dnům
// `aria-labelledby` dává. Záznam teď nese `aria-labelledby` na výrok a subjekt,
// které už vykresluje (žádný nový katalogový klíč) — jméno článku je věta,
// kterou vidí zrakový čtenář: „vazba ověřena Jméno ↔ Firma".

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAGE = readFileSync("features/dukazy/DukazyPage.tsx", "utf8");

function stripComments(src: string): string {
  return src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const SRC = stripComments(PAGE);

describe("každý záznam věstníku má přístupné jméno", () => {
  it("<article id={e.anchor}> nese aria-labelledby a obě jmenované části existují jako id ve zdroji", () => {
    const article = SRC.slice(SRC.indexOf("<article"), SRC.indexOf(">", SRC.indexOf("<article")) + 1);
    expect(article).toMatch(/id=\{e\.anchor\}/);
    const m = /aria-labelledby=\{`([^`]+)`\}/.exec(article);
    expect(m, "article carries aria-labelledby").not.toBeNull();
    // Each referenced id (`${e.anchor}-…`) must be assigned to an element in the same file.
    const refs = m![1].split(/\s+/).map((r) => r.replace("${e.anchor}", ""));
    expect(refs.length).toBeGreaterThanOrEqual(2);
    for (const suffix of refs) {
      expect(SRC).toMatch(new RegExp(`id=\\{\`\\$\\{e\\.anchor\\}${suffix.replace(/[-]/g, "\\-")}\`\\}`));
    }
  });
});
