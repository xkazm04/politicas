// /dukazy/feed.* — the two thin route handlers, run over a mocked loader and
// mocked request headers (the same `next/headers` mock as
// features/shell/sitemapRoutes.test.ts).
//
// CO TU BYLO ŽIVÉ do 2026-09-05: sourozenecké routy (/denik/feed.*, /schranka/
// feed.*) dostaly v c210d19 na větev 503 `cache-control: no-store` a jednotný
// `requestOrigin` z `feedRequest.ts`; routy věstníku zůstaly stranou — každá se
// svou vlastní kopií `requestOrigin` a s 503 bez hlaviček, takže „store
// unavailable" mohla sdílená cache držet jako odpověď a XML routa ji posílala
// bez content-type. Jedno pravidlo, čtyři feedy — tady se pinuje, že věstník
// ho drží stejně.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { DukazyData } from "./getDukazyData";

let HEADERS: Record<string, string> = {};
let DATA: DukazyData | null = null;

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => HEADERS[k.toLowerCase()] ?? null }),
}));
vi.mock("./getDukazyData", () => ({ getDukazyData: async () => DATA }));

const { GET: getXml } = await import("@/app/dukazy/feed.xml/route");
const { GET: getJson } = await import("@/app/dukazy/feed.json/route");

const healthy = (): DukazyData => ({
  entries: [],
  auditRows: 0,
  limits: {
    auditTruncated: false,
    auditCap: 10_000,
    withheld: { total: 0, byState: [] },
    forensicRead: true,
    tieSourcesRead: true,
    labelsRead: true,
  },
});

afterEach(() => {
  HEADERS = {};
  DATA = null;
});

describe("store unavailable → 503 that no cache may keep (parity with /denik and /schranka feeds)", () => {
  it("xml: 503, no-store, text/plain", async () => {
    DATA = null;
    const res = await getXml();
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/);
  });

  it("json: 503, no-store, application/json", async () => {
    DATA = null;
    const res = await getJson();
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  });
});

describe("the channel address comes from the request, never a guessed domain", () => {
  it("behind a forwarding proxy the channel link is https on the request host", async () => {
    DATA = healthy();
    HEADERS = { host: "politicas.example", "x-forwarded-proto": "https" };
    const xml = await (await getXml()).text();
    expect(xml).toContain("<link>https://politicas.example/dukazy</link>");
    const json = JSON.parse(await (await getJson()).text()) as { home_page_url: string; feed_url: string };
    expect(json.home_page_url).toBe("https://politicas.example/dukazy");
    expect(json.feed_url).toBe("https://politicas.example/dukazy/feed.json");
  });

  it("without a host the base is empty — the address is not invented", async () => {
    DATA = healthy();
    HEADERS = {};
    const json = JSON.parse(await (await getJson()).text()) as { home_page_url: string };
    expect(json.home_page_url).toBe("/dukazy");
  });
});
