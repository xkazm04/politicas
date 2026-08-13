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

import { readdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
// Ukázkový katalog se sem importuje SCHVÁLNĚ a jen sem: test je jediné místo,
// které smí obě strany porovnat, protože se nikam neodesílá. Kdyby ho zase
// začal importovat chrom, spadne test níž.
import { MODULES } from "@/lib/civic/data";
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

/*
 * A NEVOZÍ ANI VYMYŠLENÉ LIDI (2026-08-13).
 *
 * Vypsané metriky padly výš; ODESÍLANÁ polovina téhož problému přežila o dva
 * dny déle. `sidebarParts.tsx` importovalo `MODULES` z `lib/civic/data.ts`
 * kvůli jedinému výrazu — jménu modulu — a tím vtahovalo celý ukázkový katalog
 * do chunku sdíleného každou routou: měřeno na buildu 2026-08-13 chunk
 * `975-*.js`, 14 615 B, referencovaný 42 ze 42 manifestů stránek, včetně
 * /graf, /admin a /rentgen (lištu nekreslí vůbec) a obou právních dokumentů.
 * Uvnitř vymyšlení čeští lidé, vymyšlené firmy s vymyšlenými IČO a „2,1 mld Kč".
 *
 * Test hlídá OBĚ strany té opravy: že chrom ukázkový katalog nečte, a že se tím
 * nezměnil ani jeden vykreslený popisek.
 */
describe("chrom nevozí ukázkový katalog", () => {
  const shellDir = dirname(fileURLToPath(import.meta.url));
  const shellSources = readdirSync(shellDir).filter(
    (f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.endsWith(".test.ts"),
  );

  it("skenuje neprázdnou množinu souborů — jinak by test nic netvrdil", () => {
    // Bez tohohle by přejmenování složky test umlčelo a nikdo by si nevšiml.
    expect(shellSources.length).toBeGreaterThan(5);
    expect(shellSources).toContain("sidebarParts.tsx");
  });

  it("žádný soubor chromu neimportuje lib/civic", () => {
    for (const file of shellSources) {
      // Komentáře se strhávají: hlavička sidebarParts.tsx o tom importu PÍŠE,
      // a psát o chybě není totéž co ji mít.
      expect(codeOf(`./${file}`), file).not.toContain("lib/civic");
    }
  });

  it("každý řádek railu má odkud vzít jméno — buď klíč, nebo značku", () => {
    // `entry.brandName ?? entry.key` je poslední záchrana; kdyby ji řádek
    // potřeboval, vypsal by se v liště strojový klíč („law-watch").
    for (const entry of NAV) {
      expect(
        Boolean(entry.labelKey) || Boolean(entry.brandName),
        `řádek ${entry.key} nemá ani labelKey, ani brandName`,
      ).toBe(true);
    }
  });

  it("jména modulů se nezměnila ani o bajt", () => {
    // Jediné dovolené čtení `MODULES` v celém chromu — a je tady, ne v běhu.
    const moduleEntries = NAV.filter((e) => e.brandName);
    expect(moduleEntries.length, "žádný modul nenese značku").toBe(5);
    for (const entry of moduleEntries) {
      const sample = MODULES.find((m) => m.key === entry.key);
      expect(sample, `MODULES nezná modul ${entry.key}`).toBeDefined();
      expect(entry.brandName, `jméno modulu ${entry.key} se rozešlo`).toBe(sample?.name);
    }
  });

  it("značka se NEPŘEKLÁDÁ — v katalozích jméno modulu není", () => {
    // Kdyby brandName někdo přesunul do messages/*.json, první překladatel by
    // z „CivicScore" udělal „Občanské skóre" v jednom jazyce a ne v druhém.
    for (const [locale, catalog] of [
      ["cs", csModules],
      ["en", enModules],
    ] as const) {
      for (const entry of NAV) {
        if (!entry.brandName) continue;
        expect(catalog[entry.key]?.name, `${locale}.content.modules.${entry.key}.name`).toBeUndefined();
      }
    }
  });
});
