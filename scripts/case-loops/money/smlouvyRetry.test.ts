import { describe, expect, it, vi } from "vitest";
import { retryableSmlouvyFailure, withBackoff } from "./smlouvyRetry";

describe("retryableSmlouvyFailure", () => {
  it.each([
    "smlouvy.gov.cz search → 429 (https://smlouvy.gov.cz/vyhledavani?party_idnum=25130072)",
    "smlouvy.gov.cz setOffset → 503 (https://…)",
    "fetch failed",
  ])("retries %s", (msg) => {
    expect(retryableSmlouvyFailure(msg)).toBe(true);
  });
  it.each([
    /* an IČO containing the digits 429 is not a rate limit - parent-contract-sweep's
       `msg.includes("429")` would have retried this 404 three times */
    "smlouvy.gov.cz search → 404 (https://smlouvy.gov.cz/vyhledavani?party_idnum=00042900)",
    "header drift: expected 12 columns, got 11",
    "smlouvy.gov.cz search → 403 (https://…)",
  ])("does not retry %s", (msg) => {
    expect(retryableSmlouvyFailure(msg)).toBe(false);
  });
});

describe("withBackoff", () => {
  it("retries a transient failure through the ladder and returns the success", async () => {
    let calls = 0;
    const run = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error("smlouvy.gov.cz search → 429 (x)");
      return "ok";
    });
    await expect(withBackoff("x", run, [1, 1, 1])).resolves.toBe("ok");
    expect(calls).toBe(3);
  });
  it("throws a non-retryable failure at once", async () => {
    const run = vi.fn(async () => {
      throw new Error("smlouvy.gov.cz search → 404 (x)");
    });
    await expect(withBackoff("x", run, [1, 1])).rejects.toThrow("404");
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("gives up after the ladder is spent, rethrowing the last error", async () => {
    const run = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    await expect(withBackoff("x", run, [1, 1])).rejects.toThrow("fetch failed");
    expect(run).toHaveBeenCalledTimes(3);
  });
});
