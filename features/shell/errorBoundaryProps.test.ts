// Poruchové plochy vs. kontrakt App Routeru — připnuto GREPEM PŘES ZDROJ.
//
// CO TU BYLO ŽIVÉ do 2026-09-05: obě hranice (app/error.tsx, app/global-error.tsx)
// destrukturovaly prop `unstable_retry`. Next 16.2 ho tak posílal; 16.3.0 ho
// STABILIZOVAL jako `retry` a `unstable_retry` už neposílá vůbec
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md,
// tabulka „Version History"; runtime v client/components/error-boundary.js předává
// `reset: this.reset, retry: this.retry`). Tlačítko „Zkusit znovu" tedy volalo
// `undefined()` — TypeError uvnitř plochy, která má čtenáře z chyby VYVÉST.
// Typecheck to nechytil: Next pro error.tsx žádný typ propů nevyváží, takže
// komponenta smí deklarovat cokoli.
//
// Tenhle test čte NÁZEV PROPU Z RUNTIMU, ne z opsaného řetězce: až Next prop
// přejmenuje znovu, shodí se tady, ne u čtenáře. Stejná poctivá mezera jako
// a11y.test.ts — bez jsdom se ověřuje zdroj, ne klik.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const BOUNDARIES = ["app/error.tsx", "app/global-error.tsx"] as const;

const RUNTIME = readFileSync("node_modules/next/dist/client/components/error-boundary.js", "utf8");

/** Zdroj bez komentářů — hlavičky souborů popisují, CO se opravovalo, a nesmí
 *  samy žádné tvrzení tohohle testu splnit ani vyvrátit. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Klíče, které runtime hranice předává fallback komponentě (`retry: this.retry`). */
function runtimeRetryProps(): string[] {
  return [...RUNTIME.matchAll(/\b(\w*retry)\s*:\s*this\.\w+/gi)].map((m) => m[1]);
}

describe("error boundaries read the prop the installed Next actually passes", () => {
  const passed = runtimeRetryProps();

  it("runtime passes exactly one retry-shaped prop, and it is the stable `retry`", () => {
    expect(passed).toEqual(["retry"]);
  });

  for (const file of BOUNDARIES) {
    const src = stripComments(readFileSync(file, "utf8"));

    it(`${file} destructures \`retry\` and wires it to the retry button`, () => {
      expect(src).toMatch(/\bretry\s*,/);
      expect(src).toMatch(/\bretry\s*:\s*\(\)\s*=>\s*void/);
      expect(src).toMatch(/onClick=\{\(\)\s*=>\s*retry\(\)\}/);
    });

    it(`${file} no longer mentions the 16.2-only \`unstable_retry\``, () => {
      expect(src).not.toMatch(/unstable_retry/);
    });
  }
});
