import { describe, expect, it } from "vitest";
import { fetchWithThrottle } from "./kiosek";

/* `classify-before-you-respond` reached MONITOR on 2026-09-04 (refusal-class.ts) and
 * measured 3 → 1 requests per terminal refusal. The kiosek adapter kept its own loop:
 * every non-ok status — 404 for a board that does not exist, 403 for a host that said
 * no — was retried `retries` times with a linear back-off, so one absent institution
 * cost four requests against a host the discovery session already found fragile
 * (2026-09-06, scan-sweep, parity-auditor: one rule, two loops, one fixed). */

function countingFetch(status: number) {
  let calls = 0;
  const fetchOne = async () => {
    calls += 1;
    return new Response(status === 200 ? "{}" : "", { status });
  };
  return { fetchOne, calls: () => calls };
}

describe("kiosek request economy under refusal (2026-09-06, parity-auditor)", () => {
  it("issues ONE request when the board is absent (404)", async () => {
    const f = countingFetch(404);
    await expect(fetchWithThrottle(["https://x/404"], f.fetchOne, { delayMs: 0, retries: 3 })).rejects.toThrow(/absent/i);
    expect(f.calls()).toBe(1);
  });

  it("issues ONE request when the host declines (403)", async () => {
    const f = countingFetch(403);
    await expect(fetchWithThrottle(["https://x/403"], f.fetchOne, { delayMs: 0, retries: 3 })).rejects.toThrow(/declined/i);
    expect(f.calls()).toBe(1);
  });

  it("still retries pressure (503) — the half that was already right", async () => {
    const f = countingFetch(503);
    await expect(fetchWithThrottle(["https://x/503"], f.fetchOne, { delayMs: 0, retries: 3 })).rejects.toThrow(/pressure/i);
    expect(f.calls()).toBe(4);
  });

  it("returns the first ok response without a second request", async () => {
    const f = countingFetch(200);
    const [res] = await fetchWithThrottle(["https://x/ok"], f.fetchOne, { delayMs: 0, retries: 3 });
    expect(res.ok).toBe(true);
    expect(f.calls()).toBe(1);
  });
});
