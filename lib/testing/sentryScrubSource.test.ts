import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Every Sentry runtime that can see a request must bind the follow-list scrub on BOTH hooks
 * (features/schranka/telemetryScrub.ts): the Občanská schránka has no accounts, so a reader's
 * follow list travels in the query of /schranka/novinky.json, and with tracing at 1.0 the SDK
 * copies that URL into several trace attributes - a 20-MP follow list is a fingerprint. The
 * server and client configs were pinned on 2026-08-12 (telemetryScrub.test.ts); the EDGE
 * config was the one runtime left without the scrub (scan-sweep 2026-09-07). */

describe("every Sentry runtime init binds scrubFollowTelemetry on both hooks", () => {
  it.each(["sentry.server.config.ts", "sentry.edge.config.ts", "instrumentation-client.ts"])("%s", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).toMatch(/import \{ scrubFollowTelemetry \} from "@\/features\/schranka\/telemetryScrub"/);
    expect(src).toMatch(/beforeSend:\s*scrubFollowTelemetry/);
    expect(src).toMatch(/beforeSendTransaction:\s*scrubFollowTelemetry/);
  });
});
