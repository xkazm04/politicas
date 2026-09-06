// The operator console's machine document is internal state behind a cookie.
// machineRoutes503.test.ts pins that a REFUSED answer is uncacheable; this pins
// the other half — a SERVED answer must be too, or a shared cache between the
// operator and the server could hand the gated document to the next request.
// Over mocked loaders and a mocked cookie jar (the sibling test's pattern).

import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: process.env.ADMIN_TOKEN }) }),
}));
vi.mock("@/features/admin/loops/getLoopState", () => ({ getLoopsDoc: async () => ({}) }));
vi.mock("@/features/admin/loops/loopsJson", () => ({ encodeLoopsDoc: () => "{}" }));

const loops = await import("@/app/admin/loops.json/route");

const savedToken = process.env.ADMIN_TOKEN;
afterEach(() => {
  if (savedToken === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = savedToken;
});

describe("/admin/loops.json — a SERVED console document is uncacheable too (2026-09-08, security-auditor)", () => {
  it("answers 200 with cache-control: no-store when the cookie matches ADMIN_TOKEN", async () => {
    process.env.ADMIN_TOKEN = "test-operator-token";
    const res = await loops.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control") ?? "").toMatch(/no-store/);
    expect(res.headers.get("content-type") ?? "").toMatch(/application\/json/);
  });
});
describe("the OG card's font fetch is bounded (2026-09-08, error-handler)", () => {
  it("opengraph-image.tsx passes an AbortSignal.timeout to both Google Fonts fetches", () => {
    const s = readFileSync("app/graf/p/[ref]/opengraph-image.tsx", "utf8");
    const bounded = s.match(/fetch\([^)]*signal: AbortSignal\.timeout\(/g) ?? [];
    expect(bounded.length).toBe(2);
  });
});
