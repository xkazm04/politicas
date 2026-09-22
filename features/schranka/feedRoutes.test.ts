// /schranka/feed.* + novinky.json — the thin route handlers, run over a mocked
// delta loader and mocked request headers (same mocks as the sibling suites).
//
// CO TU BYLO ŽIVÉ do 2026-09-05: oba feedy schránky odpovídaly 200 BEZ
// `cache-control`, přičemž adresa nese osobní seznam sledovaných (`?e=…`).
// novinky.json — týž odběr, týž loader — už nesl `private, max-age=60`; feedy
// jsou tedy jediný osobní artefakt, který sdílené cache smějí držet podle
// vlastního úsudku. Politika je jedna: osobní odpověď = `private`.
// A `od=` četly tři routy dvěma parsery — novinky.json si držel vlastní kopii
// DAY_RE, feedy `feedSince`; teď je čtou stejnou funkcí.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { SchrankaDeltas } from "./getSchrankaDeltas";

let HEADERS: Record<string, string> = {};
let LAST_SINCE: string | null | undefined;
let DOWN = false;

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => HEADERS[k.toLowerCase()] ?? null }),
}));
vi.mock("./getSchrankaDeltas", () => ({
  getSchrankaDeltas: async (_keys: readonly string[], since: string | null): Promise<SchrankaDeltas | null> => {
    LAST_SINCE = since;
    if (DOWN) return null;
    return {
      deltas: [],
      since: since ?? "2026-08-07",
      coverage: { money: true, law: true, reviews: true, changes: true, dukazy: true, recompute: true },
      limits: {
        contractCompanies: 0,
        companyCap: 500,
        companiesOverCap: 0,
        edgeCap: 5000,
        companiesEdgeTruncated: 0,
        malformedIco: 0,
        changesFromGate: 0,
        changesUndisplayable: 0,
        auditCap: 10_000,
        auditTruncated: false,
        changeCap: 5000,
        changesRead: 0,
        changesTruncated: false,
      },
      builtOn: "2026-09-05",
    };
  },
}));

const { GET: getXml } = await import("@/app/schranka/feed.xml/route");
const { GET: getJson } = await import("@/app/schranka/feed.json/route");
const { GET: getNovinky } = await import("@/app/schranka/novinky.json/route");

const req = (path: string) => new Request(`https://politicas.example${path}`);

afterEach(() => {
  HEADERS = {};
  LAST_SINCE = undefined;
  DOWN = false;
});

describe("a personal feed is never a shared-cache object", () => {
  it("xml 200 carries the same private policy as novinky.json", async () => {
    const res = await getXml(req("/schranka/feed.xml?e=poslanec:6881"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");
  });

  it("json 200 carries the same private policy as novinky.json", async () => {
    const res = await getJson(req("/schranka/feed.json?e=poslanec:6881"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");
  });

  it("novinky.json keeps its policy — the one the feeds now share", async () => {
    const res = await getNovinky(req("/schranka/novinky.json?e=poslanec:6881&od=2026-09-01"));
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");
  });

  it("503 branches stay no-store (c210d19)", async () => {
    DOWN = true;
    for (const res of [await getXml(req("/schranka/feed.xml")), await getJson(req("/schranka/feed.json")), await getNovinky(req("/schranka/novinky.json"))]) {
      expect(res.status).toBe(503);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });
});

describe("`od=` is read by ONE parser across the three routes", () => {
  it("a valid day passes through unchanged everywhere", async () => {
    await getNovinky(req("/schranka/novinky.json?od=2026-09-01"));
    expect(LAST_SINCE).toBe("2026-09-01");
    await getXml(req("/schranka/feed.xml?od=2026-09-01"));
    expect(LAST_SINCE).toBe("2026-09-01");
  });

  it("an invalid day is refused, not repaired: feeds fall to the first-visit window, novinky to 'everything'", async () => {
    await getXml(req("/schranka/feed.xml?od=včera"));
    expect(LAST_SINCE).toBeNull();
    await getNovinky(req("/schranka/novinky.json?od=včera"));
    expect(LAST_SINCE).toBe("0000-01-01");
  });
});
