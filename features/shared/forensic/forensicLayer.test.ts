/*
 * Strážce forenzní vrstvy v app/globals.css (batch 7D).
 *
 * Vrstva je CSS, ne modul — přesto má smlouvu, kterou jde testovat:
 *  1. ÚPLNOST: přemapovává VŠECHNY jádrové tokeny palety. Poloviční
 *     inverze (třeba zapomenutý --color-ochre) by nechala tmavou barvu
 *     na tmavém papíru — neviditelný text není druhý objektiv.
 *  2. KONTRAST: forenzní text musí na forenzním papíru projít WCAG
 *     (stejná disciplína jako audit /impeccable pro plakátovou paletu).
 *  3. KLID: vrstva nesmí zavádět animace ani transition — reduced-motion
 *     zůstává zachované tím, že se nemá co tlumit.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

const START = "FORENZNÍ VRSTVA";
const END = "konec forenzní vrstvy";

function layerBlock(): string {
  const s = css.indexOf(START);
  const e = css.indexOf(END);
  expect(s).toBeGreaterThan(-1);
  expect(e).toBeGreaterThan(s);
  return css.slice(s, e);
}

function tokenValue(block: string, name: string): string {
  const m = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  expect(m, `token ${name} chybí ve forenzní vrstvě`).not.toBeNull();
  return m![1];
}

// WCAG 2.x relativní luminance + kontrastní poměr — přepočet, ne převzetí.
function luminance(hex: string): number {
  const c = [0, 2, 4]
    .map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const CORE_TOKENS = [
  "--color-ink",
  "--color-paper",
  "--color-paper-strong",
  "--color-signal",
  "--color-signal-deep",
  "--color-cobalt",
  "--color-ochre",
  "--color-steel",
  "--color-steel-aa",
  "--color-hairline",
];

describe("forenzní vrstva — úplnost inverze", () => {
  it("přemapovává všechny jádrové tokeny palety (žádná poloviční inverze)", () => {
    const block = layerBlock();
    for (const token of CORE_TOKENS) tokenValue(block, token);
  });

  it("selektor je element-scoped [data-rezim], aby ho uměla číst sonda plátna", () => {
    expect(layerBlock()).toContain('[data-rezim="forenzni"]');
  });
});

describe("forenzní vrstva — kontrast na obráceném papíru", () => {
  const block = layerBlock();
  const paper = tokenValue(block, "--color-paper");
  const panel = tokenValue(block, "--color-paper-strong");

  it.each([
    ["--color-ink", 4.5],
    ["--color-steel", 4.5],
    ["--color-steel-aa", 4.5],
    ["--color-signal", 4.5],
    ["--color-signal-deep", 4.5],
    ["--color-cobalt", 4.5],
    ["--color-ochre", 4.5],
  ])("%s má na paper i paper-strong aspoň %s:1", (token, floor) => {
    const value = tokenValue(block, token as string);
    expect(contrast(value, paper)).toBeGreaterThanOrEqual(floor as number);
    expect(contrast(value, panel)).toBeGreaterThanOrEqual(floor as number);
  });

  it("plochy signal-deep unesou papírový text (obousměrná podmínka tokenu)", () => {
    const deep = tokenValue(block, "--color-signal-deep");
    expect(contrast(paper, deep)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("forenzní vrstva — klid (reduced-motion zachováno konstrukcí)", () => {
  it("nezavádí animation ani transition", () => {
    // Deklarace (`vlastnost:`), ne pouhá slova — komentář vrstvy o klidu
    // mluví a nesmí test shodit.
    const block = layerBlock();
    expect(block).not.toMatch(/\banimation[a-z-]*\s*:/i);
    expect(block).not.toMatch(/\btransition[a-z-]*\s*:/i);
    expect(block).not.toMatch(/@keyframes/i);
  });
});
