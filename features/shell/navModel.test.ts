/*
 * Test úplnosti navigace (moonshot 7A): každá veřejná routa aplikace je buď
 * DOSAŽITELNÁ z railu (přímo, nebo jako potomek vypsané plochy), nebo je
 * VĚDOMĚ nevypsaná v UNLISTED_ROUTES s vypsaným důvodem. Nic třetího.
 *
 * Routy se neopisují ručně — skenuje se skutečný strom stránek pod app/
 * (každý page.tsx), takže nová stránka bez rozhodnutí o navigaci tenhle test
 * SHODÍ. To je záměr:
 * plocha, kterou nikdo nenajde, je neúspěšná plocha (kontrakt dávky 1, bod 7).
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { entryFor, isBareRoute, NAV, sectionsFor, UNLISTED_ROUTES } from "./navModel";

const APP_DIR = fileURLToPath(new URL("../../app", import.meta.url));

/** Všechny routy se stránkou: každý page.tsx pod app/ → "/segment/…" ("/" pro kořen). */
function scanRoutes(dir: string, prefix = ""): string[] {
  const routes: string[] = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) {
      routes.push(...scanRoutes(join(dir, item.name), `${prefix}/${item.name}`));
    } else if (item.name === "page.tsx") {
      routes.push(prefix === "" ? "/" : prefix);
    }
  }
  return routes.sort();
}

const listedHrefs = (): string[] => NAV.flatMap((e) => [e.href, ...e.children.map((c) => c.href)]);

const reachableFromRail = (route: string): boolean =>
  listedHrefs().some((href) => route === href || route.startsWith(`${href}/`));

/** Routy, které vypisujeme, ač je staví PARALELNÍ builder téže dávky (7B) —
 *  v okamžiku běhu v izolovaném stromu 7A ještě nemusí existovat. */
const PENDING_THIS_BATCH = new Set(["/referendum"]);

describe("úplnost navigace — každá routa je rozhodnutá", () => {
  const routes = scanRoutes(APP_DIR);

  it("sken vidí skutečný strom (kotevní kontrola, ať test nemlčí na prázdnu)", () => {
    expect(routes).toContain("/");
    expect(routes).toContain("/denik");
    expect(routes).toContain("/schranka");
    expect(routes.length).toBeGreaterThan(20);
  });

  it("každá routa je dosažitelná z railu, nebo vědomě nevypsaná", () => {
    const unlisted = new Set(UNLISTED_ROUTES.map((u) => u.route));
    const undecided = routes.filter((r) => !reachableFromRail(r) && !unlisted.has(r));
    // Nová stránka? Buď ji vypiš v NAV (navModel.ts), nebo ji VĚDOMĚ přidej
    // do UNLISTED_ROUTES s důvodem. Nerozhodnutá routa je vada navigace.
    expect(undecided).toEqual([]);
  });

  it("UNLISTED_ROUTES nese jen existující routy (žádné zvětralé výjimky)", () => {
    const known = new Set(routes);
    const stale = UNLISTED_ROUTES.filter((u) => !known.has(u.route));
    expect(stale).toEqual([]);
  });

  it("nic není vypsané a „nevypsané“ zároveň a každý důvod je vypsaný", () => {
    for (const u of UNLISTED_ROUTES) {
      expect(reachableFromRail(u.route), `${u.route} je dosažitelná z railu — výjimka je zbytečná`).toBe(false);
      expect(u.reason.length).toBeGreaterThan(10);
    }
  });

  it("každý vypsaný href má skutečnou stránku (mimo rout paralelní dávky)", () => {
    const known = new Set(routes);
    const dead = listedHrefs().filter((href) => !known.has(href) && !PENDING_THIS_BATCH.has(href));
    expect(dead).toEqual([]);
  });

  it("rail nevede na plochy bez chromu (mimo /graf — vědomé okno do plátna)", () => {
    // /graf je bare route (plátno přes celé okno), ale vypsat se MUSÍ —
    // zpět vede drobeček v jeho hlavičce (rozhodnutí kola 4, 2026-07-26).
    const bareListed = listedHrefs().filter((href) => href !== "/graf" && isBareRoute(href));
    expect(bareListed).toEqual([]);
  });
});

describe("entryFor — podstránky patří pod svůj vypsaný řádek", () => {
  it("children s cizím prefixem se hlásí ke svému rodiči", () => {
    expect(entryFor("/kompas")?.key).toBe("vote-track");
    expect(entryFor("/kraj")?.key).toBe("civic-score");
    expect(entryFor("/kraj/praha")?.key).toBe("civic-score");
    expect(entryFor("/dukazy")?.key).toBe("zaznam");
    expect(entryFor("/atlas")?.key).toBe("zaznam");
  });

  it("prefixové routy drží dosavadní chování", () => {
    expect(entryFor("/denik")?.key).toBe("zaznam");
    expect(entryFor("/schranka")?.key).toBe("schranka");
    expect(entryFor("/zakony/kolize")?.key).toBe("law-watch");
    expect(entryFor("/zakony/predpis/89-2012")?.key).toBe("law-watch");
    expect(entryFor("/penize/strety")?.key).toBe("follow-the-money");
    expect(entryFor("/poslanec/123")?.key).toBe("civic-score");
    expect(entryFor("/rozpocty/00241717")?.key).toBe("budget-mirror");
  });

  it("nevypsané deep-link plochy nemají rodiče (a kotvy jen kdo je deklaruje)", () => {
    expect(entryFor("/svedectvi")).toBeUndefined();
    expect(entryFor("/zdroj/xyz")).toBeUndefined();
    expect(sectionsFor("/schranka")).toEqual([]);
    expect(sectionsFor("/poslanec/123").length).toBeGreaterThan(0);
  });
});
