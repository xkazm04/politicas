/*
 * Rozcestník odběrů tvrdí ADRESY. Adresa, která neexistuje, je horší než žádný
 * rozcestník — proto se každá porovnává se skutečným stromem app/ (táž metoda
 * jako navModel.test.ts), a prose prochází českou jazykovou bránou.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { looksEnglish } from "@/lib/analysis/language-gate";
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

  it("parametrizovaný feed schránky to říká sám na sobě", () => {
    const schranka = FEED_FAMILIES.find((f) => f.base === "/schranka/feed");
    expect(schranka?.note).toMatch(/\?e=/);
    expect(schranka?.note).toMatch(/neukládá/);
  });

  it("popisky prochází českou jazykovou bránou", () => {
    for (const f of FEED_FAMILIES) {
      expect(looksEnglish(f.title), f.title).toBe(false);
      expect(looksEnglish(f.carries), f.base).toBe(false);
      if (f.note) expect(looksEnglish(f.note), f.base).toBe(false);
    }
    for (const e of MACHINE_ENDPOINTS) {
      expect(looksEnglish(e.title), e.title).toBe(false);
      expect(looksEnglish(e.carries), e.href).toBe(false);
    }
  });
});
