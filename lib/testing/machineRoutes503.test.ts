// Every machine-readable route answers an outage with a response nobody may
// cache. c210d19 gave the feed routes `cache-control: no-store` on 503 and
// 650a4d9 extended it to the bulletin feeds; the five JSON/JSON-LD endpoints here
// still answered "store unavailable" with a cacheable 503, so a shared cache could
// hold the outage as the answer. One rule, every machine route — pinned here, over
// mocked loaders (the features/dukazy/feedRoutes.test.ts pattern).
//
// Lives in lib/testing because the routes span four contexts (data releases,
// atlas, graph permalink, admin) and the rule is the repo's, not any one of theirs.

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/data-releases/getDataReleasesData", () => ({
  getReleaseManifest: async () => null,
  getSnapshotDownload: async () => null,
}));
vi.mock("@/features/atlas/getAtlasData", () => ({ getAtlasReport: async () => null }));
vi.mock("@/features/graph/getPermalinkData", () => ({
  getPermalinkData: async () => ({ status: "unavailable" }),
}));
vi.mock("@/features/graph/permalink", () => ({ toEvidenceJsonLd: () => ({}) }));
vi.mock("@/features/admin/loops/getLoopState", () => ({ getLoopsDoc: async () => ({}) }));
vi.mock("@/features/admin/loops/loopsJson", () => ({ encodeLoopsDoc: () => "{}" }));

const manifest = await import("@/app/data/manifest.json/route");
const snapshot = await import("@/app/data/snapshot.json/route");
const atlas = await import("@/app/atlas/atlas.json/route");
const bundle = await import("@/app/graf/p/[ref]/bundle/route");
const loops = await import("@/app/admin/loops.json/route");

const savedToken = process.env.ADMIN_TOKEN;
afterEach(() => {
  if (savedToken === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = savedToken;
});

const expectUncacheableOutage = (res: Response, status = 503) => {
  expect(res.status).toBe(status);
  expect(res.headers.get("cache-control") ?? "").toMatch(/no-store/);
};

describe("machine routes answer an outage with an uncacheable 503 (2026-09-06, parity-auditor)", () => {
  it("/data/manifest.json", async () => {
    const res = await manifest.GET();
    expectUncacheableOutage(res);
    expect(res.headers.get("content-type") ?? "").toMatch(/application\/json/);
  });

  it("/data/snapshot.json", async () => {
    expectUncacheableOutage(await snapshot.GET());
  });

  it("/atlas/atlas.json", async () => {
    expectUncacheableOutage(await atlas.GET());
  });

  it("/graf/p/[ref]/bundle keeps retry-after and adds no-store", async () => {
    const res = await bundle.GET(new Request("http://x/graf/p/g.x/bundle"), { params: Promise.resolve({ ref: "g.x" }) });
    expectUncacheableOutage(res);
    expect(res.headers.get("retry-after")).toBe("600");
  });

  it("/admin/loops.json — an unconfigured console is an outage of the same kind", async () => {
    delete process.env.ADMIN_TOKEN;
    const res = await loops.GET();
    expectUncacheableOutage(res);
  });
});
