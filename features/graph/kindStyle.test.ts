import { describe, expect, it } from "vitest";
import { COBALT, INK, OCHRE, SIGNAL, STEEL } from "@/features/landing/palette";
import { KIND_FILL_CLASS, KIND_FILL_TOKEN, KIND_ORDER, KIND_STYLE, type KindFillToken } from "./kindStyle";

/* Parity gate for `parallel-vocabulary-maps-hand-synced` (one-authority-per-
 * vocabulary). KIND_STYLE.fill (literal hex for <canvas>), KIND_FILL_TOKEN
 * (token name for the palette/probe) and KIND_FILL_CLASS (Tailwind fill-* for
 * DOM SVG) are three hand-maintained copies of the same kind→color vocabulary,
 * reconciled only by a "drž v sync" comment. Recolor a kind in one map and the
 * canvas, forensic probe and legend glyphs disagree. This test is the gate that
 * comment could not be: it fails the moment the three copies drift. */

// The single hex authority per token: features/landing/palette.ts (mirror of the
// --color-* custom props in app/globals.css).
const TOKEN_HEX: Record<KindFillToken, string> = {
  ink: INK,
  steel: STEEL,
  signal: SIGNAL,
  cobalt: COBALT,
  ochre: OCHRE,
};

describe("kind-color vocabulary parity", () => {
  it("every kind has a token, a hex and a class (all three maps cover KIND_ORDER)", () => {
    for (const kind of KIND_ORDER) {
      expect(KIND_STYLE[kind], `KIND_STYLE missing ${kind}`).toBeDefined();
      expect(KIND_FILL_TOKEN[kind], `KIND_FILL_TOKEN missing ${kind}`).toBeDefined();
    }
    expect(Object.keys(KIND_STYLE).sort()).toEqual([...KIND_ORDER].sort());
    expect(Object.keys(KIND_FILL_TOKEN).sort()).toEqual([...KIND_ORDER].sort());
  });

  it("KIND_STYLE.fill equals the palette hex of KIND_FILL_TOKEN for every kind", () => {
    for (const kind of KIND_ORDER) {
      const token = KIND_FILL_TOKEN[kind];
      expect(KIND_STYLE[kind].fill, `${kind}: canvas hex must match token ${token}`).toBe(TOKEN_HEX[token]);
    }
  });

  it("KIND_FILL_CLASS maps each token to its fill-<token> class", () => {
    const usedTokens = new Set(KIND_ORDER.map((k) => KIND_FILL_TOKEN[k]));
    for (const token of usedTokens) {
      expect(KIND_FILL_CLASS[token], `class missing for token ${token}`).toBe(`fill-${token}`);
    }
  });
});
