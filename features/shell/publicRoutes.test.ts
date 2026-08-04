/*
 * Sitemapa vs. skutečný strom stránek. Stejná metoda jako navModel.test.ts:
 * routy se neopisují, skenuje se app/ — takže nová statická veřejná stránka,
 * která by v sitemapě chyběla, tenhle test SHODÍ.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DISALLOWED_PATHS } from "@/app/robots";
import { isDisallowed, isDynamicRoute, publicStaticRoutes } from "./publicRoutes";

const APP_DIR = fileURLToPath(new URL("../../app", import.meta.url));

function scanRoutes(dir: string, prefix = ""): string[] {
  const routes: string[] = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) routes.push(...scanRoutes(join(dir, item.name), `${prefix}/${item.name}`));
    else if (item.name === "page.tsx") routes.push(prefix === "" ? "/" : prefix);
  }
  return routes.sort();
}

describe("publicStaticRoutes", () => {
  const routes = publicStaticRoutes(DISALLOWED_PATHS);

  it("kotevní kontrola — seznam není prázdný a nese kořen", () => {
    expect(routes).toContain("/");
    expect(routes.length).toBeGreaterThan(10);
  });

  it("nenese nic, co robots.txt zakazuje procházet", () => {
    for (const d of DISALLOWED_PATHS) {
      expect(routes.filter((r) => isDisallowed(r, [d]))).toEqual([]);
    }
    expect(routes).not.toContain("/penize/kontrola");
    expect(routes).not.toContain("/rentgen");
    expect(routes).not.toContain("/admin");
  });

  it("nenese dynamickou cestu (ta by znamenala vyjmenovat lidi a firmy)", () => {
    expect(routes.filter(isDynamicRoute)).toEqual([]);
  });

  it("je deterministický a bez duplicit", () => {
    expect(routes).toEqual([...routes].sort());
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("každá statická stránka pod app/ je buď v sitemapě, nebo zakázaná", () => {
    const missing = scanRoutes(APP_DIR)
      .filter((r) => !isDynamicRoute(r))
      .filter((r) => !isDisallowed(r, DISALLOWED_PATHS))
      .filter((r) => !routes.includes(r));
    // Nová stránka? Rozhodni o ní v navModel.ts (NAV nebo UNLISTED_ROUTES) —
    // sitemapa čte tytéž dvě deklarace.
    expect(missing).toEqual([]);
  });

  it("sitemapa nenabízí stránku, která neexistuje", () => {
    const known = new Set(scanRoutes(APP_DIR));
    // /referendum staví paralelní dávka 7B (viz navModel.test.ts).
    expect(routes.filter((r) => !known.has(r) && r !== "/referendum")).toEqual([]);
  });
});
