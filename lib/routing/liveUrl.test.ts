import { describe, expect, it } from "vitest";
import { liveUrlFrom } from "./liveUrl";

/* Two routes (/kraj/[kraj], /plakat/[view]) each spelled "host + x-forwarded-proto, else a
 * relative path" under the same comment. The pure half is pinned here; the async wrapper
 * only reads `headers()`. */
describe("liveUrlFrom", () => {
  it("builds an absolute URL from host and forwarded proto", () => {
    expect(liveUrlFrom("politicas.cz", "https", "/kraj/praha")).toBe("https://politicas.cz/kraj/praha");
  });
  it("defaults the scheme to http when no proxy header is present (dev)", () => {
    expect(liveUrlFrom("localhost:3000", null, "/zebricek")).toBe("http://localhost:3000/zebricek");
  });
  it("falls back to the relative path when the host header is missing - never an invented domain", () => {
    expect(liveUrlFrom(null, "https", "/zebricek")).toBe("/zebricek");
  });
});
