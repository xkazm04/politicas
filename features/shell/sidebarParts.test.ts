/*
 * Levá lišta NEVYPISUJE VYMYŠLENÁ ČÍSLA.
 *
 * `useNavLabels().metric()` tahalo `content.modules.<key>.metricValue` — „2,1 mld
 * Kč", „312", „5 214", „6 254", „200" — a Sidebar i MobileNav to sázely vedle
 * jména modulu na KAŽDÉ routě aplikace. Žádné z těch čísel nepochází z grafu,
 * žádné nemělo citaci a doprovodné `metricLabel` („— ilustrativní ukázka"),
 * které jediné to přiznávalo, nerenderoval NIKDO: `metricLabel()` bylo mrtvé.
 * Značkové pravidlo této aplikace zní, že každé vypsané číslo cituje svůj zdroj;
 * plakát tuhle dvojici smazal dřív (features/landing/components/SystemModules.tsx),
 * rail 2026-08-11.
 *
 * Test čte ZDROJ, ne DOM: repozitář nemá jsdom ani testing-library (viz
 * navModel.test.ts, který ze stejného důvodu skenuje strom app/). Pinuje se tedy
 * to, co se dá pinovat bez rendereru — že klíč v katalogu není a že ho žádný díl
 * chromu nečte. To by neuhlídal ani jeden test nad překlady samotnými.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { NAV } from "./navModel";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/** Zdroj bez komentářů. Komentář, který VYSVĚTLUJE, proč se klíč nečte, není
 *  čtení klíče — a bez tohohle by test zakazoval o té chybě psát. */
const codeOf = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/[^\n]*/g, "$1");

type Modules = Record<string, Record<string, unknown>>;
const csModules = (csCatalog as unknown as { content: { modules: Modules } }).content.modules;
const enModules = (enCatalog as unknown as { content: { modules: Modules } }).content.modules;

/**
 * Jediný modul, jehož metrika v katalogu PŘEŽILA — a jen proto, že ji renderuje
 * OZNAČENÁ vzorková dlaždice /penize, když peněžní vrstva grafu není k dispozici
 * (tam je „ilustrativní ukázka" vypsaná u čísla, což je přesně způsob, jakým
 * tenhle repozitář zachází s mockem). Rail ji nerenderuje tak jako tak.
 *
 * Výjimka se sama hlídá: níž se ověřuje, že ten konzument klíč opravdu čte.
 * Až přestane, spadne tenhle test a klíče se mají smazat taky.
 */
const KEEPS_METRIC: Record<string, string> = {
  "follow-the-money": "../money/components/MockStatTiles.tsx",
};

describe("rail nevypisuje vymyšlené číslo", () => {
  it("žádný modul v railu nenese metricValue ani metricLabel (mimo doložených výjimek)", () => {
    for (const entry of NAV) {
      if (entry.key in KEEPS_METRIC) continue;
      for (const [locale, modules] of [
        ["cs", csModules],
        ["en", enModules],
      ] as const) {
        const m = modules[entry.key];
        if (!m) continue; // řádky mimo katalog modulů (schranka, zaznam, overview)
        expect(m.metricValue, `${locale}.content.modules.${entry.key}.metricValue`).toBeUndefined();
        expect(m.metricLabel, `${locale}.content.modules.${entry.key}.metricLabel`).toBeUndefined();
      }
    }
  });

  it("každá výjimka má živého konzumenta — jinak jsou to jen zvětralé klíče", () => {
    for (const [key, consumer] of Object.entries(KEEPS_METRIC)) {
      expect(csModules[key]?.metricValue, `cs.${key}`).toBeTruthy();
      expect(enModules[key]?.metricValue, `en.${key}`).toBeTruthy();
      expect(read(consumer), consumer).toContain("metricValue");
    }
  });

  it("chrome ten klíč nečte — ani společné díly, ani obě varianty lišty", () => {
    for (const file of ["./sidebarParts.tsx", "./Sidebar.tsx", "./MobileNav.tsx"]) {
      const src = codeOf(file);
      expect(src, file).not.toContain("metricValue");
      expect(src, file).not.toContain("metricLabel");
      expect(src, file).not.toContain("labels.metric");
    }
  });

  it("jediné číslo v navigaci je REÁLNÝ odznak schránky", () => {
    // Odznak počítá novinky sledovaných entit (features/schranka) — je to údaj,
    // ne ozdoba, a proto v liště zůstává, když všechno ostatní odešlo.
    for (const file of ["./Sidebar.tsx", "./MobileNav.tsx"]) {
      expect(read(file), file).toContain("<SchrankaBadge />");
    }
    expect(NAV.some((e) => e.key === "schranka")).toBe(true);
  });
});
