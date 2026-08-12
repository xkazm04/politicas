// Přístupnost peněžního grafu — připnutá GREPEM PŘES ZDROJ, ne renderem.
//
// POCTIVÁ MEZERA, stejná jako u features/civicscore/a11y.test.ts a
// features/landing/motion.test.ts: tenhle repozitář nemá jsdom ani
// testing-library, takže grep dokazuje, že atribut a volání ve zdroji JSOU —
// ne že strom, který z nich vznikne, čte odečítačka tak, jak si přejeme.
// Klávesová cesta velína (týž vzor, tytéž funkce) se ověřovala živým průchodem
// v headless Chrome; tady se pinuje ZAPOJENÍ a čistá část pravidla má vlastní
// test (graphNav.test.ts + features/dashboard/graphTraversal.test.ts).
//
// Přesně tahle třída regrese tu byla živá do 2026-08-12: `role="img"` (LISTOVÁ
// role) nad jedenácti `<g tabIndex={0} style={{outline:"none"}}>`, tedy uzly,
// které pro asistivní technologie neexistovaly, braly jedenáct tabstopů a
// neměly viditelný fokus.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

const REAL = read("features/money/MoneyGraph.tsx");
const MOCK = read("features/money/components/MockMoneyGraph.tsx");
const BOTH: [string, string][] = [
  ["MoneyGraph", REAL],
  ["MockMoneyGraph", MOCK],
];

describe("graf peněz je skupina, ne obrázek s neviditelnými dětmi", () => {
  it.each(BOTH)("%s: <svg> nese role=group a přístupné jméno", (_name, src) => {
    expect(src).toMatch(/<svg[^>]*role="group"[\s\S]{0,80}aria-label=\{t\("graph\.ariaLabel"\)\}/);
  });

  it.each(BOTH)("%s: žádné <svg role=\"img\" — listová role uzly ruší", (_name, src) => {
    expect(src).not.toMatch(/<svg[^>]*role="img"/);
  });

  it.each(BOTH)("%s: uzel je odkaz jen s adresou, jinak popsaný obrázek", (_name, src) => {
    expect(src).toContain('role={href ? "link" : "img"}');
  });
});

describe("obrázek má JEDEN tabstop a chodí se v něm šipkami", () => {
  it.each(BOTH)("%s: roving tabindex, žádný pevný tabIndex={0}", (_name, src) => {
    expect(src).toContain("tabIndex={rovingId === n.id ? 0 : -1}");
    // Jen JSX výskyt: v hlavičce souboru stojí `<g tabIndex={0}>` jako popis
    // toho, co se opravovalo, a komentář žádný tabstop nedělá.
    expect(src, "pevný tabstop na uzlu je zpátky").not.toMatch(/\n\s+tabIndex=\{0\}/);
  });

  it.each(BOTH)("%s: šipky volají IMPORTOVANÉ pravidlo, ne vlastní kopii", (_name, src) => {
    expect(src).toMatch(/from "@\/features\/dashboard\/graphTraversal"/);
    expect(src).toContain("neighbourStep(n.id, ev.key, navNodes, navEdges)");
    expect(src).toContain("isArrowKey(ev.key)");
    // Krok bez souseda nesmí nic udělat — `preventDefault` je uvnitř podmínky.
    expect(src).toMatch(/if \(next !== null\) \{\s*\n\s*ev\.preventDefault\(\);/);
  });

  it.each(BOTH)("%s: Home/End skáčou na první a poslední uzel v pořadí kreslení", (_name, src) => {
    expect(src).toContain("focusNode(firstNodeId(navNodes))");
    expect(src).toContain("focusNode(lastNodeId(navNodes))");
  });

  it.each(BOTH)("%s: fokus je VIDĚT — kobaltový čárkovaný kroužek, ne outline:none", (_name, src) => {
    expect(src).toMatch(/focusedId === n\.id && \(/);
    expect(src).toMatch(/stroke-cobalt[\s\S]{0,80}strokeDasharray="4 3"/);
    expect(src, "outline:none je zpátky").not.toMatch(/outline:\s*"none"/);
  });

  it.each(BOTH)("%s: obsluha se čtenáři VYPISUJE", (_name, src) => {
    expect(src).toContain('t("graph.keyboardHint")');
  });
});

describe("popisek uzlu unese krok naslepo", () => {
  it.each(BOTH)("%s: nese druh, pozici a stupeň", (_name, src) => {
    expect(src).toMatch(/graph\.kind\./);
    expect(src).toContain('t("graph.nodePosition"');
    expect(src).toContain('t("graph.edgesInRecord"');
    expect(src).toMatch(/aria-label=\{label\}/);
  });

  it("reálný uzel firmy hlásí stav lidské brány u sebe, ne jen v patičce", () => {
    // V popisku pro odečítačku…
    expect(REAL).toMatch(/n\.pending \? tcom\("pendingReview"\) : null/);
    // …a jako vlastní řádek textu, který ořez podtitulu nemůže spolknout.
    expect(REAL).toMatch(/\{n\.pending && \(\s*\n\s*<text[\s\S]{0,220}tcom\("pendingReview"\)/);
  });
});

describe("z obrázku vedou spisy — a jen tam, kde je entita skutečná", () => {
  it("reálný graf odvozuje adresu ze sdíleného resolveru a otevírá ji z klávesnice", () => {
    expect(REAL).toContain('from "./graphNav"');
    expect(REAL).toContain("moneyNodeHref(n.entityId)");
    expect(REAL).toMatch(/ev\.key === "Enter" \|\| ev\.key === " "[\s\S]{0,90}router\.push\(href\)/);
    // …a vedle klávesové cesty stojí SKUTEČNÝ odkaz (nový panel, kopie adresy).
    expect(REAL).toMatch(/<Link\s+href=\{nodeHref\}/);
    expect(REAL).toContain('t("graph.openCaseFile")');
  });

  it("uzly nesou entitu v id-gramatice grafu, ne layoutové id", () => {
    expect(REAL).toContain("entityId: `psp:person:${data.mp.pspId}`");
    expect(REAL).toMatch(/entityId: c\.id/);
  });

  it("vzorek adresu ODMÍTÁ TÝMŽ resolverem, ne zvláštní větví", () => {
    expect(MOCK).toContain("moneyNodeHref(n.id)");
    expect(MOCK, "vzorek nesmí navigovat").not.toContain("router.push");
    expect(MOCK).toContain('t("graph.sampleNoCaseFiles")');
  });
});
