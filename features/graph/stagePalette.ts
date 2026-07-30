"use client";

/*
 * PALETA JEVIŠTĚ — jediná cesta, kudy se barvy tokenů dostanou na <canvas>.
 *
 * Plátno kreslí literálními řetězci, CSS třídy tam nevedou. V plakátovém
 * (výchozím) režimu se bere zrcadlo tokenů features/landing/palette.ts;
 * ve forenzním režimu se hodnoty ČTOU ZE SONDY: dočasný prvek s atributem
 * `data-rezim="forenzni"` zdědí přemapované tokeny forenzní vrstvy
 * (app/globals.css) a getComputedStyle je vydá. Barvy tak vznikají pořád
 * jen v globals.css — tenhle modul žádný hex nezná (custom/no-hardcoded-colors).
 *
 * Sonda nese atribut sama, takže čtení NEZÁVISÍ na tom, jestli už
 * ForensicProvider stihl nastavit atribut na <html> (pořadí efektů
 * rodič/dítě není smlouva).
 */

import { COBALT, HAIRLINE, INK, OCHRE, PAPER, SIGNAL, STEEL } from "@/features/landing/palette";
import { FORENSIC_ATTR, FORENSIC_VALUE } from "@/features/shared/forensic/forensicMode";

export interface StagePalette {
  paper: string;
  ink: string;
  steel: string;
  signal: string;
  cobalt: string;
  ochre: string;
  hairline: string;
}

/** Plakátový (Konstrukt) základ — server, testy i režim bez čočky. */
export const KONSTRUKT_STAGE_PALETTE: StagePalette = {
  paper: PAPER,
  ink: INK,
  steel: STEEL,
  signal: SIGNAL,
  cobalt: COBALT,
  ochre: OCHRE,
  hairline: HAIRLINE,
};

const TOKEN: Record<keyof StagePalette, string> = {
  paper: "--color-paper",
  ink: "--color-ink",
  steel: "--color-steel",
  signal: "--color-signal",
  cobalt: "--color-cobalt",
  ochre: "--color-ochre",
  hairline: "--color-hairline",
};

/** Přečti paletu jeviště pro daný režim. Mimo DOM vrací Konstrukt. */
export function readStagePalette(forensic: boolean): StagePalette {
  if (!forensic || typeof document === "undefined") return KONSTRUKT_STAGE_PALETTE;
  const probe = document.createElement("div");
  probe.setAttribute(FORENSIC_ATTR, FORENSIC_VALUE);
  document.body.appendChild(probe);
  try {
    const cs = getComputedStyle(probe);
    const read = (key: keyof StagePalette): string => {
      const v = cs.getPropertyValue(TOKEN[key]).trim();
      return v || KONSTRUKT_STAGE_PALETTE[key];
    };
    return {
      paper: read("paper"),
      ink: read("ink"),
      steel: read("steel"),
      signal: read("signal"),
      cobalt: read("cobalt"),
      ochre: read("ochre"),
      hairline: read("hairline"),
    };
  } finally {
    probe.remove();
  }
}
