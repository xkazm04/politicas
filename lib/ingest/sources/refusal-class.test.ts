import { describe, expect, it } from "vitest";
import { MonitorClient } from "./monitor";
import { classifyResponse } from "./refusal-class";

/* Probe for `classify-before-you-respond`
 * (software-engineering/integration/contested-acquisition).
 *
 * The seam: every ingest adapter keys its retry decision on two literal status
 * codes (429, 503) and treats every other non-ok response as "not a pressure
 * signal". That collapses two states the corpus says must stay apart — the
 * counterparty DECLINED (403), and the counterparty is BROKEN (500) — and it
 * leaves a third, the counterparty that never answers at all, indistinguishable
 * from a transient outage.
 *
 * MEASURABLE: requests issued upstream for one terminal refusal.
 * Arm A (pre-change) issued 1 + maxRetries, because `throw new Error(!res.ok)`
 * fires INSIDE the try and the catch retries it. Retrying a host that just said
 * no is what `web-scraping/scrape-scheduling` names as how a pause becomes a
 * ban. Arm B issues exactly one.
 */

function countingFetch(status: number) {
  let calls = 0;
  const impl = (async () => {
    calls += 1;
    return new Response(status === 200 ? "{}" : "", { status });
  }) as unknown as typeof fetch;
  return { impl, calls: () => calls };
}

describe("classifyResponse", () => {
  it("separates declined, absent, pressure and broken", () => {
    expect(classifyResponse(403).kind).toBe("declined");
    expect(classifyResponse(401).kind).toBe("declined");
    expect(classifyResponse(404).kind).toBe("absent");
    expect(classifyResponse(410).kind).toBe("absent");
    expect(classifyResponse(429).kind).toBe("pressure");
    expect(classifyResponse(503).kind).toBe("pressure");
    expect(classifyResponse(500).kind).toBe("broken");
    expect(classifyResponse(502).kind).toBe("broken");
  });

  it("retries only where another attempt can change the answer", () => {
    // pressure and broken are the counterparty's transient states — worth waiting out.
    expect(classifyResponse(429).retryable).toBe(true);
    expect(classifyResponse(503).retryable).toBe(true);
    expect(classifyResponse(500).retryable).toBe(true);
    // declined is a DECISION and absent is a FACT. Neither changes on retry, and
    // retrying the first is how a pause becomes a ban.
    expect(classifyResponse(403).retryable).toBe(false);
    expect(classifyResponse(404).retryable).toBe(false);
  });

  it("names the class in the error text, so a caller can route on it", () => {
    expect(classifyResponse(403).kind).not.toBe(classifyResponse(500).kind);
  });
});

describe("MonitorClient request economy under refusal", () => {
  it("issues ONE request when the counterparty declines (403)", async () => {
    const f = countingFetch(403);
    const c = new MonitorClient({ fetchImpl: f.impl });
    await expect(c.fetchPeriods()).rejects.toThrow(/declined/i);
    expect(f.calls()).toBe(1);
  });

  it("issues ONE request when the resource is absent (404)", async () => {
    const f = countingFetch(404);
    const c = new MonitorClient({ fetchImpl: f.impl });
    await expect(c.fetchPeriods()).rejects.toThrow(/absent/i);
    expect(f.calls()).toBe(1);
  });

  it("still retries the pressure class it was already right about", async () => {
    const f = countingFetch(503);
    const c = new MonitorClient({ fetchImpl: f.impl });
    await expect(c.fetchPeriods()).rejects.toThrow();
    expect(f.calls()).toBeGreaterThan(1);
  });

  it("still retries a counterparty that is broken rather than refusing", async () => {
    const f = countingFetch(500);
    const c = new MonitorClient({ fetchImpl: f.impl });
    await expect(c.fetchPeriods()).rejects.toThrow(/broken/i);
    expect(f.calls()).toBeGreaterThan(1);
  });
});
