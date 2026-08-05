/*
 * Rozcestník odběrů tvrdí ADRESY. Adresa, která neexistuje, je horší než žádný
 * rozcestník — proto se každá porovnává se skutečným stromem app/ (táž metoda
 * jako navModel.test.ts).
 *
 * Copy se 2026-08-05 přestěhovala do katalogu (messages/{cs,en}.json pod
 * `dataReleases.feeds.*`) — modul vrací KLÍČE, ne české věty (vzor /overeni).
 * Jazykovou bránu drží katalog; tady se drží tvar a jedinečnost klíčů a to,
 * že čísla do vět nese kód (`noteValues`), ne literál v katalogu.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FEED_ENTRIES } from "@/features/denik/deriveDenik";
import { FEED_ADDRESSES, FEED_FAMILIES, FEED_FORMATS, MACHINE_ENDPOINTS, feedAddressCount } from "./feedIndex";

const appPath = (rel: string) => fileURLToPath(new URL(`../../app${rel}`, import.meta.url));

describe("adresář odběrů", () => {
  it("každá feedová adresa má skutečný route handler", () => {
    for (const f of FEED_FAMILIES) {
      for (const fmt of FEED_FORMATS) {
        expect(existsSync(appPath(`${f.base}${fmt.ext}/route.ts`)), `${f.base}${fmt.ext}`).toBe(true);
      }
    }
  });

  it("každá strojová adresa mimo feedy má skutečný route handler", () => {
    for (const e of MACHINE_ENDPOINTS) {
      expect(existsSync(appPath(`${e.href}/route.ts`)), e.href).toBe(true);
    }
  });

  it("každá doprovodná stránka existuje", () => {
    for (const f of FEED_FAMILIES) {
      expect(existsSync(appPath(`${f.page}/page.tsx`)), f.page).toBe(true);
    }
  });

  it("adresy jsou jedinečné a počet se počítá, ne píše", () => {
    const bases = FEED_FAMILIES.map((f) => f.base);
    expect(new Set(bases).size).toBe(bases.length);
    expect(new Set(MACHINE_ENDPOINTS.map((e) => e.href)).size).toBe(MACHINE_ENDPOINTS.length);
    expect(feedAddressCount()).toBe(FEED_ADDRESSES.length);
    expect(FEED_ADDRESSES.length).toBe(FEED_FAMILIES.length * FEED_FORMATS.length + MACHINE_ENDPOINTS.length);
  });

  it("copy jsou KLÍČE katalogu dataReleases.feeds.*, ne věty", () => {
    for (const f of FEED_FAMILIES) {
      expect(f.titleKey, f.base).toMatch(/^feeds\.family\.\w+\.title$/);
      expect(f.carriesKey, f.base).toMatch(/^feeds\.family\.\w+\.carries$/);
      if (f.noteKey !== null) expect(f.noteKey, f.base).toMatch(/^feeds\.family\.\w+\.note$/);
    }
    for (const e of MACHINE_ENDPOINTS) {
      expect(e.titleKey, e.href).toMatch(/^feeds\.endpoint\.\w+\.title$/);
      expect(e.carriesKey, e.href).toMatch(/^feeds\.endpoint\.\w+\.carries$/);
    }
    const keys = [
      ...FEED_FAMILIES.flatMap((f) => [f.titleKey, f.carriesKey, ...(f.noteKey ? [f.noteKey] : [])]),
      ...MACHINE_ENDPOINTS.flatMap((e) => [e.titleKey, e.carriesKey]),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("parametrizovaný feed schránky nese poznámku; strop deníku jde přes noteValues", () => {
    const schranka = FEED_FAMILIES.find((f) => f.base === "/schranka/feed");
    expect(schranka?.noteKey).toBe("feeds.family.schranka.note");

    // Strop záznamů deníku do věty píše KÓD (noteValues), ne literál katalogu —
    // literál by se rozešel s FEED_ENTRIES.
    const denik = FEED_FAMILIES.find((f) => f.base === "/denik/feed");
    expect(denik?.noteKey).toBe("feeds.family.denik.note");
    expect(denik?.noteValues).toEqual({ count: FEED_ENTRIES });
  });
});
