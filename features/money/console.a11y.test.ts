// Ověřovací konzole (/penize/kontrola) — přístupnost a NEZTRÁCENÍ POZNÁMKY,
// připnuté GREPEM PŘES ZDROJ, ne renderem.
//
// POCTIVÁ MEZERA, stejná jako u features/money/a11y.test.ts,
// features/civicscore/a11y.test.ts a features/landing/motion.test.ts: tenhle
// repozitář nemá jsdom ani testing-library, takže grep dokazuje, že zapojení ve
// ZDROJI je — ne že strom, který z něj vznikne, čte odečítačka tak, jak si
// přejeme. Klávesová cesta téhož vzoru (roving tabindex + fokus) se u velína
// ověřovala živým průchodem v headless Chrome; čistá část pravidla fronty má
// vlastní typový podpis a je čitelná odsud (queueStep / queueRovingId).
//
// Přesně tyhle třídy regrese tu byly živé do 2026-08-12:
//   · klávesová zkratka 1/2/3 posílala `note: null`, zatímco myš posílala draft —
//     a poznámka je JEDINÁ věc, která z rozhodnutí přežije do hash-řetězce;
//   · šipky přebarvovaly rámeček a nevolaly `.focus()`, takže odečítačka stála
//     jinde, než kam mířilo rozhodnutí;
//   · 211 karet s pevným `tabIndex={0}` = 211 tabstopů (anti-vzor, který
//     features/money/a11y.test.ts zakazuje grafu peněz);
//   · `features/money/**` neobsahovalo JEDINÝ aria-live / role=status /
//     role=alert / aria-pressed / sr-only — zápis do auditní stopy se
//     nepotvrzoval nijak.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync("features/money/components/VerificationConsole.tsx", "utf8");

/** Zdroj bez blokových a řádkových komentářů — hlavička souboru popisuje, CO se
 *  opravovalo, a nesmí sama žádné tvrzení testu splnit ani vyvrátit. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("poznámka recenzenta přežije KAŽDOU cestu k rozhodnutí", () => {
  it("žádné volání rozhodnutí neposílá literální null místo poznámky", () => {
    // Přesná podoba chyby: `handleDecide(shown[idx], DECISION_KEYS[e.key], null)`.
    expect(CODE, "klávesová cesta zase posílá prázdnou poznámku").not.toMatch(
      /DECISION_KEYS\[[^\]]+\]\s*,\s*null/,
    );
    // …a obecněji: ani myš, ani vrácení rozhodnutí nesmí `null` podstrčit.
    expect(CODE).not.toMatch(/handleDecide\([^)]*,\s*null\s*\)/);
    expect(CODE).not.toMatch(/onDecide\([^)]*,\s*null\s*\)/);
  });

  it("poznámka se čte na JEDNOM místě — v handleDecide, ne v kartě", () => {
    expect(CODE).toMatch(/const note = \(noteDraftsRef\.current\[tie\.id\] \?\? ""\)\.trim\(\) \|\| null;/);
    // Karta drží draft jen jako prop; ŽÁDNÝ vlastní stav v ní být nesmí,
    // protože posluchač klávesnice v rodiči se k němu nedostane.
    const reviewCard = CODE.slice(
      CODE.indexOf("function ReviewCard("),
      CODE.indexOf("function DecidedCard("),
    );
    const decidedCard = CODE.slice(
      CODE.indexOf("function DecidedCard("),
      CODE.indexOf("export function writeStatusInfo("),
    );
    expect(reviewCard.length, "kotvy řezu se rozešly se zdrojem").toBeGreaterThan(500);
    expect(decidedCard.length, "kotvy řezu se rozešly se zdrojem").toBeGreaterThan(500);
    expect(reviewCard, "draft poznámky se vrátil do karty").not.toMatch(/useState/);
    expect(decidedCard, "vlastní důvod vrácení se vrátil do karty").not.toMatch(/useState/);
    expect(CODE).toContain("noteDrafts[tie.id] ?? \"\"");
  });

  it("vrácení rozhodnutí píše do TÉHOŽ draftu, ne do druhého pole", () => {
    expect(CODE).toContain('onRevert={() => handleDecide(tie, "needs-more")}');
    expect(CODE).toMatch(/onRevert: \(\) => void;/);
  });

  it("„doplnit“ bez poznámky se neodešle a konzole to řekne", () => {
    expect(CODE).toMatch(/decision === "needs-more" && note === null/);
    expect(CODE).toMatch(/phase: "note-required"/);
    expect(CODE).toMatch(/case "note-required":/);
    // …a kurzor se vrátí do pole, které chybí.
    expect(CODE).toContain("focusNote(tie.id)");
  });
});

describe("fronta má JEDEN tabstop a chodí se v ní šipkami", () => {
  it("roving tabindex, žádný pevný tabIndex={0} na kartě", () => {
    expect(CODE).toContain("tabIndex={roving ? 0 : -1}");
    expect(CODE, "pevný tabstop na kartě je zpátky").not.toMatch(/\n\s+tabIndex=\{0\}/);
  });

  it("který tabstop to je, rozhoduje čisté pravidlo (kurzor → první karta)", () => {
    expect(CODE).toContain("queueRovingId(focusedId, shownIds)");
    expect(CODE).toMatch(/export function queueRovingId\(/);
  });

  it("šipky hýbou SKUTEČNÝM fokusem, ne jen barvou rámečku", () => {
    expect(CODE).toMatch(/const next = queueStep\(shownIds, focusedId, e\.key\);/);
    expect(CODE).toMatch(/if \(next !== null\) \{\s*\n\s*e\.preventDefault\(\);/);
    expect(CODE).toContain("focusCard(next)");
    expect(CODE).toMatch(/el\.focus\(\);/);
  });

  it("Home/End skáčou na začátek a konec fronty a krok se na kraji nezabaluje", () => {
    expect(CODE).toMatch(/case "Home":/);
    expect(CODE).toMatch(/case "End":/);
    expect(CODE).toContain("ids[Math.min(idx + 1, ids.length - 1)]");
  });

  it("plynulé odrolování respektuje prefers-reduced-motion", () => {
    // Vlastní lint pravidlo kouká jen na framer-motion propy — tohle mu ujde.
    expect(CODE).toContain("useReducedMotion");
    expect(CODE).toMatch(/behavior: reduceMotion \? "auto" : "smooth"/);
    expect(CODE, "natvrdo plynulé rolování je zpátky").not.toMatch(/behavior: "smooth"/);
  });

  it("fokus je po rozhodnutí umístěn, ne zahozen (obě tlačítka zšednou)", () => {
    expect(CODE).toMatch(/focusCard\(tie\.id\);/);
  });

  it("karta má viditelný fokus — outline-none zmizelo", () => {
    expect(CODE, "outline-none na fokusovatelné kartě je zpátky").not.toMatch(
      /border-2 bg-paper outline-none/,
    );
    expect(CODE).toContain("focus-visible:outline-cobalt");
  });
});

describe("zápis do auditní stopy se OHLAŠUJE — jednou za stránku, ne jednou za kartu", () => {
  it("průběh, úspěch i selhání mají po jedné trvalé živé oblasti", () => {
    expect([...CODE.matchAll(/role="status"/g)], "role=status na kartě?").toHaveLength(2);
    expect([...CODE.matchAll(/role="alert"/g)]).toHaveLength(1);
    // Selhání jde do alertu, úspěch do status — rozhoduje jedno pole.
    expect(CODE).toMatch(/announcement && !announcement\.failure \? announceText : ""/);
    expect(CODE).toMatch(/announcement && announcement\.failure \? announceText : ""/);
  });

  it("postup „zapsáno N / M“ je živý", () => {
    expect(CODE).toMatch(/<span role="status" aria-live="polite">\s*\n\s*\{writeConfigured \? "zapsáno"/);
  });

  it("věta hlášení a věta u karty se skládají TÝMŽ pravidlem", () => {
    expect(CODE).toMatch(/export function writeStatusInfo\(/);
    expect(CODE).toMatch(/\? writeStatusInfo\(announced\.decision, writeConfigured,/);
    expect(CODE).toMatch(/const info = writeStatusInfo\(decision, writeConfigured, status\);/);
  });

  it("poznámka u karty NEMÁ vlastní živou oblast (211 karet = 211 ohlášení)", () => {
    const note = CODE.slice(CODE.indexOf("function WriteStatusNote("));
    expect(note).not.toMatch(/aria-live/);
    expect(note).not.toMatch(/role="status"/);
    expect(note).not.toMatch(/role="alert"/);
  });
});

describe("ovládací prvky mají jméno a stav", () => {
  it("obě textová pole nesou přístupné jméno, ne jen placeholder", () => {
    expect([...CODE.matchAll(/<textarea/g)]).toHaveLength(2);
    expect(CODE).toContain("aria-label={`poznámka k rozhodnutí — ${tie.mpName}, ${tie.company}`}");
    expect(CODE).toContain("aria-label={`důvod vrácení ke kontrole — ${tie.mpName}, ${tie.company}`}");
    // Pole, které hlídá POVINNÝ důvod, navíc říká proč.
    expect(CODE).toContain("aria-describedby={`revert-rules-${tie.id}`}");
  });

  it("filtr fronty je pojmenovaná skupina a tlačítka nesou svůj stav", () => {
    expect(CODE).toContain('role="group" aria-label="filtr fronty podle třídy vazby"');
    expect(CODE).toContain("aria-pressed={filter === c}");
  });

  it("legenda kláves je dostupná na KAŽDÉ šířce — sr-only, ne display:none", () => {
    expect(CODE).toContain("sr-only sm:not-sr-only");
    expect(CODE, "legenda je zase `hidden sm:inline`").not.toMatch(/hidden text-steel sm:inline/);
  });
});

describe("čísla a citace jdou přes dům, ne kolem něj", () => {
  it("žádné syrové formátování — Intl by na zápisové ploše rozjelo hydrataci", () => {
    expect(CODE, "raw toLocaleString je zpátky").not.toMatch(/toLocaleString\(/);
    expect(CODE, "raw toFixed je zpátky").not.toMatch(/toFixed\(/);
    expect(CODE).toContain('import { useFormat } from "@/lib/i18n/useFormat";');
  });

  it("ruční „<p>zdroj: …</p>“ nahradil sdílený SourceNote", () => {
    expect([...CODE.matchAll(/<SourceNote/g)].length).toBeGreaterThanOrEqual(7);
    expect(CODE, "citace se zase sází ručně").not.toMatch(/<p[^>]*>\s*\n?\s*zdroj:/);
    expect(CODE, "citace se zase sází ručně").not.toMatch(/<div[^>]*>zdroj:/);
  });
});
