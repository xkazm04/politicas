import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COBALT, HAIRLINE, INK, OCHRE, PAPER, PAPER_STRONG, SIGNAL, STEEL } from "./palette";

/* Parity gate for `token-value-manual-mirror-no-parity-gate` (one-authority-per-
 * vocabulary). palette.ts is a hand-maintained hex mirror of the --color-*
 * custom props in app/globals.css (recharts needs literal strings; CSS classes
 * don't reach chart chrome). The only prior safeguard was a prose comment
 * ("change both places"). This test is the gate: change a token in globals.css
 * and forget palette.ts and it fails, instead of charts silently rendering the
 * old color while the rest of the UI moved on. */

// The light :root block is the authority palette.ts mirrors; the dark override
// redefines the same props later in the file, so take the FIRST definition.
const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
const lightToken = (name: string): string => {
  const m = css.match(new RegExp(`--color-${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`--color-${name} not found in app/globals.css`);
  return m[1].toLowerCase();
};

describe("palette.ts mirrors app/globals.css --color-* tokens", () => {
  it.each([
    ["ink", INK],
    ["paper", PAPER],
    ["paper-strong", PAPER_STRONG],
    ["signal", SIGNAL],
    ["cobalt", COBALT],
    ["ochre", OCHRE],
    ["steel", STEEL],
    ["hairline", HAIRLINE],
  ])("--color-%s equals its palette constant", (token, constant) => {
    expect(constant.toLowerCase()).toBe(lightToken(token));
  });
});
