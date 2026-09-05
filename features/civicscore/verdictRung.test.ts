// Každý štítek o pojmenované osobě říká, na kterém stupni stojí — NA KAŽDÉ ploše.
// Připnuto GREPEM PŘES ZDROJ (vzor a11y.test.ts; repozitář nemá jsdom).
//
// CO TU BYLO ŽIVÉ do 2026-09-05: 9853059 (G2, deck #12) dal `rung` / `decidedBy` /
// `decidedAtLabel` štítkům v ŽEBŘÍČKU a ve SPISU — ale souboj (HeadToHead) a
// tištěná kandidátka kraje (KrajPage) sázely tytéž tři štítky bez nich. Důsledek
// není jen chybějící stupeň: ZAMÍTNUTÝ verdikt (rung „rejected“) se na žebříčku
// zamlčí viditelně, kdežto v souboji a na papíře dál svítil jako kladný štítek —
// dvě plochy jedné platformy tvrdily o jednom člověku opak.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SURFACES = [
  "features/civicscore/components/LeaderboardTable.tsx",
  "features/civicscore/components/HeadToHead.tsx",
  "features/civicscore/KrajPage.tsx",
] as const;

const BADGES = ["WorkhorseBadge", "RapporteurBadge", "LowScoreReasonChip"] as const;

/** Every opening tag of a verdict badge, with its full attribute list. */
function badgeSites(src: string): { badge: string; attrs: string }[] {
  const out: { badge: string; attrs: string }[] = [];
  for (const badge of BADGES) {
    const re = new RegExp(`<${badge}\\b([^>]*?)(/?)>`, "gs");
    for (const m of src.matchAll(re)) out.push({ badge, attrs: m[1] });
  }
  return out;
}

describe("verdict badges carry their rung on every surface that renders them", () => {
  for (const file of SURFACES) {
    const src = readFileSync(file, "utf8");
    const sites = badgeSites(src);

    it(`${file} renders the three badges (the surface is in scope)`, () => {
      expect(sites.length).toBeGreaterThanOrEqual(3);
    });

    it(`${file}: every badge site passes rung, decidedBy and decidedAtLabel`, () => {
      for (const s of sites) {
        expect(s.attrs, `${file} <${s.badge}> lacks rung=`).toMatch(/\brung=\{/);
        expect(s.attrs, `${file} <${s.badge}> lacks decidedBy=`).toMatch(/\bdecidedBy=\{/);
        expect(s.attrs, `${file} <${s.badge}> lacks decidedAtLabel=`).toMatch(/\bdecidedAtLabel=\{/);
      }
    });
  }
});
