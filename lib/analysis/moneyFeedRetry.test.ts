import { describe, expect, it } from "vitest";
import { AresClient, HlidacClient } from "./money-feed";

/* `classify-before-you-respond` reached MONITOR (2026-09-04) and kiosek (2026-09-06);
 * the money clients kept the literal `429 || 503` loop refusal-class.ts names as what it
 * replaces: a BROKEN host (5xx) was answered once and read as a miss — an MP „unresolved"
 * because ARES had a bad minute — while the loop could not tell DECLINED from ABSENT in
 * the error it threw. Now: pressure and broken retry (Retry-After honoured), declined and
 * absent cost one request and throw a RefusedError that names its class
 * (2026-09-06, scan-sweep, parity-auditor). */

function countingFetch(status: number) {
  let calls = 0;
  const impl = (async () => {
    calls += 1;
    return new Response(status === 200 ? "{}" : "", { status });
  }) as unknown as typeof fetch;
  return { impl, calls: () => calls };
}

describe("money clients: request economy under refusal (2026-09-06, parity-auditor)", () => {
  it("Hlídač: an absent resource (404) costs ONE request and names its class", async () => {
    const f = countingFetch(404);
    const c = new HlidacClient({ token: "t", fetchImpl: f.impl, retries: 3 });
    await expect(c.firmaByIco("00000001")).rejects.toThrow(/absent/i);
    expect(f.calls()).toBe(1);
  });

  it("ARES: a declined request (403) costs ONE request", async () => {
    const f = countingFetch(403);
    const c = new AresClient({ fetchImpl: f.impl, retries: 3 });
    await expect(c.subject("00000001")).rejects.toThrow(/declined/i);
    expect(f.calls()).toBe(1);
  });

  it("a broken host (500) is retried — it was answered once and read as a miss", async () => {
    const f = countingFetch(500);
    const c = new AresClient({ fetchImpl: f.impl, retries: 1 });
    await expect(c.subject("00000001")).rejects.toThrow(/broken/i);
    expect(f.calls()).toBe(2);
  });

  it("an ok answer is returned on the first request", async () => {
    const f = countingFetch(200);
    const c = new HlidacClient({ token: "t", fetchImpl: f.impl });
    await expect(c.firmaByIco("00000001")).resolves.toEqual({});
    expect(f.calls()).toBe(1);
  });
});
