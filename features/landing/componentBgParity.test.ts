import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPONENT_FILL } from "@/features/civicscore/componentFill";
import { LENS_COMPONENT_ORDER } from "@/features/civicscore/lens";
import { COBALT, INK, OCHRE, PAPER, SIGNAL, STEEL } from "./palette";

/* ReferendumTeaser kreslí pruhy složek Tailwind třídou (`bg-cobalt/50`), protože
 * scanner Tailwindu potřebuje literál; barva TÉŽE složky v grafech je hex z
 * COMPONENT_FILL. Dvě mapy jednoho pravidla, dosud držené větou „drž v sync".
 * Tohle je brána: hex → jméno tokenu (palette.ts je jediné zrcadlo tokenů) a
 * průhlednost → sufix `/NN`; každá složka čočky musí mít v obou mapách týž tón. */

const TOKEN_BY_HEX: Record<string, string> = {
  [INK]: "ink",
  [PAPER]: "paper",
  [SIGNAL]: "signal",
  [COBALT]: "cobalt",
  [OCHRE]: "ochre",
  [STEEL]: "steel",
};

const src = readFileSync("features/landing/components/ReferendumTeaser.tsx", "utf8");
const block = src.match(/const COMPONENT_BG[^=]*= \{([\s\S]*?)\};/)?.[1] ?? "";
const bgClass: Record<string, string> = {};
for (const m of block.matchAll(/(\w+):\s*"([^"]+)"/g)) bgClass[m[1]] = m[2];

const expectedClass = (fill: { color: string; opacity?: number }): string => {
  const token = TOKEN_BY_HEX[fill.color];
  if (!token) throw new Error(`COMPONENT_FILL color ${fill.color} is not a palette token`);
  return `bg-${token}${fill.opacity != null ? `/${Math.round(fill.opacity * 100)}` : ""}`;
};

describe("COMPONENT_BG (Tailwind) zrcadlí COMPONENT_FILL (hex) složku po složce", () => {
  it("mapa v ReferendumTeaser.tsx byla nalezena a kryje právě složky čočky", () => {
    expect(Object.keys(bgClass).sort()).toEqual([...LENS_COMPONENT_ORDER].sort());
  });

  it.each([...LENS_COMPONENT_ORDER])("%s nese týž token a průhlednost", (key) => {
    expect(bgClass[key]).toBe(expectedClass(COMPONENT_FILL[key]));
  });
});
