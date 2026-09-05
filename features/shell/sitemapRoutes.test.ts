// Sitemapa a robots — tvar ADRES, ne množina cest (tu pinuje publicRoutes.test.ts).
//
// Doktrína z docs/routes/app-shell.md: základ adresy se čte z hlaviček requestu,
// NIKDY se nehádá doména. Do 2026-09-05 ale platila jen půlka: bez hlavičky Host
// robots.txt řádek `Sitemap:` poctivě vynechal, zatímco sitemapa vypsala ~390
// RELATIVNÍCH adres („/zebricek"). Protokol sitemap.org relativní adresu
// nezná — každá `<loc>` musí být plně kvalifikovaná — takže to byl soubor, který
// tvrdil něco, co žádný čtenář nemohl použít. Bez hostitele je jediná poctivá
// sitemapa PRÁZDNÁ, přesně jako je bez hostitele vynechaný řádek v robots.
//
// `next/headers` se mockuje — jsdom ani request tu není; test ověřuje čistou
// funkci nad dosazenými hlavičkami.

import { afterEach, describe, expect, it, vi } from "vitest";

let HEADERS: Record<string, string> = {};

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => HEADERS[k.toLowerCase()] ?? null }),
}));

const { default: sitemap } = await import("@/app/sitemap");
const { default: robots } = await import("@/app/robots");

afterEach(() => {
  HEADERS = {};
});

describe("sitemap()", () => {
  it("za proxy s x-forwarded-proto staví absolutní https adresy a kořen s lomítkem", async () => {
    HEADERS = { host: "politicas.example", "x-forwarded-proto": "https" };
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(10);
    expect(entries.map((e) => e.url)).toContain("https://politicas.example/");
    for (const e of entries) expect(e.url).toMatch(/^https:\/\/politicas\.example\/[^/]?/);
  });

  it("bez x-forwarded-proto je základ poctivě http (dev), ne uhodnuté https", async () => {
    HEADERS = { host: "localhost:3000" };
    const entries = await sitemap();
    for (const e of entries) expect(e.url.startsWith("http://localhost:3000/")).toBe(true);
  });

  it("bez hostitele je prázdná — žádná relativní <loc>, žádná uhodnutá doména", async () => {
    HEADERS = {};
    const entries = await sitemap();
    expect(entries).toEqual([]);
  });
});

describe("robots()", () => {
  it("s hostitelem vypíše absolutní Sitemap:, bez hostitele řádek vynechá", async () => {
    HEADERS = { host: "politicas.example", "x-forwarded-proto": "https" };
    expect((await robots()).sitemap).toBe("https://politicas.example/sitemap.xml");
    HEADERS = {};
    expect((await robots()).sitemap).toBeUndefined();
  });
});
