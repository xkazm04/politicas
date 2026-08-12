// Přístupnost žebříčku — připnutá GREPEM PŘES ZDROJ, ne renderem.
//
// Repozitář nemá jsdom ani testing-library (viz features/landing/motion.test.ts
// a CLAUDE.md /dashboard, kde se z téhož důvodu klávesnice ověřovala živým
// průchodem v headless Chrome). Grep je levný a trvanlivý: chytí přesně tu
// třídu regrese, která tuhle plochu potkala — `role=` z ní kdysi zmizelo
// docela, `{!compact && …}` z ní vystřihlo klub i kraj, a dvě stě sedm
// tlačítek „vs" nemělo podmět.
//
// POCTIVÁ MEZERA: grep dokazuje, že atribut ve zdroji JE, ne že strom, který
// z něj vznikne, je platná ARIA tabulka. To se ověřovalo čtením struktury
// (jeden `role="table"` → přímí potomci `role="row"` → v každém řádku jen
// `role="cell"`), ne testem.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

const TABLE = read("features/civicscore/components/LeaderboardTable.tsx");
const DUEL = read("features/civicscore/components/HeadToHead.tsx");
const STATUS = read("features/civicscore/components/DuelStatus.tsx");
const PAGE = read("features/civicscore/CivicScorePage.tsx");

describe("žebříček je pro odečítačku tabulka, ne proud divů", () => {
  it("má právě jednu tabulku a ta je pojmenovaná", () => {
    // Jen JSX výskyt — v komentářích nad kódem stojí `role="table"` také,
    // a komentář žádnou tabulku nedělá.
    expect([...TABLE.matchAll(/<div role="table"/g)]).toHaveLength(1);
    expect(TABLE).toMatch(/<div role="table" aria-label=\{t\("tableAria"\)\}/);
  });

  it("má hlavičku sloupců a řádky", () => {
    // Pět hlaviček: pořadí · poslanec+klub · odchylka · skóre · akce.
    expect([...TABLE.matchAll(/role="columnheader"/g)]).toHaveLength(5);
    // Dva řádky ve zdroji: hlavičkový a šablona datového řádku.
    expect([...TABLE.matchAll(/role="row"/g)]).toHaveLength(2);
  });

  it("každá buňka datového řádku je buňka", () => {
    // pořadí · jméno+klub · odchylka · skóre · akce
    expect([...TABLE.matchAll(/role="cell"/g)]).toHaveLength(5);
  });
});

describe("filtr žebříčku dává zpětnou vazbu", () => {
  it("počet vyfiltrovaných řádků je živá oblast", () => {
    expect(TABLE).toMatch(/role="status" aria-live="polite"[\s\S]{0,200}shownOf/);
  });

  it("prázdný výsledek se ohlásí", () => {
    expect(TABLE).toMatch(/role="status"[\s\S]{0,200}emptyResults/);
  });

  it("tlačítko „vs“ jmenuje poslance", () => {
    expect(TABLE).toContain("toggleDuelAddNamed");
    expect(TABLE).toContain("toggleDuelRemoveNamed");
    expect(TABLE).toMatch(/aria-label=\{\s*\n?\s*inDuel \? t\("toggleDuelRemoveNamed"/);
  });
});

describe("kompaktní režim skrývá vizuálně, nemaže z DOM", () => {
  it("klubová a krajová meta se v kompaktu jen odsune do sr-only", () => {
    expect(TABLE).toMatch(/compact \? "sr-only" : ""/);
  });

  // `sr-only` je klip (position/clip-path), takže text ZŮSTÁVÁ vykreslený —
  // hledání v prohlížeči ho najde a odečítačka přečte. Tailwindí `hidden` je
  // `display:none`, tedy přesně ta ztráta, kterou tenhle blok opravoval.
  // Nekontroluje se plošně: `max-sm:hidden` u odchylky od mediánu je legitimní
  // responzivní pravidlo nad ODVOZENÝM číslem, ne nad textem o klubu.
  it("kompaktní režim nesahá po display:none (Tailwind `hidden`)", () => {
    expect(TABLE).not.toMatch(/compact \? "hidden"/);
    expect(TABLE).not.toMatch(/compact && "hidden"/);
    expect(TABLE).not.toMatch(/\{!compact && \([\s\S]{0,400}clubAbbrev/);
  });

  it("klub i kraj se pořád vykreslují v témže bloku (nezmizely za podmínku)", () => {
    const block = TABLE.slice(TABLE.indexOf('compact ? "sr-only"'));
    expect(block).toContain("r.clubAbbrev");
    expect(block).toContain("r.clubName");
    expect(block).toContain("r.region");
  });
});

describe("souboj je pojmenovaná oblast a hlásí změnu dvojice jedním kanálem", () => {
  it("sekce nese přístupné jméno", () => {
    expect(PAGE).toMatch(/<section id="souboj" aria-label=\{t\("duelRegionAria"\)\}/);
  });

  it("stavový řádek je JEDINÁ živá oblast souboje — v panelu žádná není", () => {
    expect(STATUS).toMatch(/role="status" aria-live="polite"/);
    expect(DUEL, "HeadToHead nesmí mít vlastní živou oblast — přemontovává se").not.toMatch(/aria-live/);
    expect(DUEL, "HeadToHead nesmí mít vlastní role=status").not.toMatch(/role="status"/);
  });

  it("stavový řádek stojí mimo animovaný panel", () => {
    const statusAt = PAGE.indexOf("<DuelStatus");
    const panelAt = PAGE.indexOf("<HeadToHead");
    expect(statusAt).toBeGreaterThan(-1);
    expect(panelAt).toBeGreaterThan(statusAt);
  });

  it("hodnoty v zrcadlených mřížkách mají podmět", () => {
    // Dvakrát mřížka složek (a, b) + dvakrát řádek faktů (a, b).
    expect([...DUEL.matchAll(/<span className="sr-only">\{a\.name\}: <\/span>/g)]).toHaveLength(2);
    expect([...DUEL.matchAll(/<span className="sr-only">\{b\.name\}: <\/span>/g)]).toHaveLength(2);
  });
});
