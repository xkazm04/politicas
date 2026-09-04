import { describe, expect, it } from "vitest";

import { decideAdminGate } from "./adminGate";

/**
 * All four verdicts of the /admin gate. Before the cookie jar was mirrored down
 * to `submitted`, three of these could not be written at all: the decision sat
 * behind `await cookies()`, which throws outside a request scope, so only the
 * branch that returns before the cookie read was reachable from this lane.
 */
describe("decideAdminGate", () => {
  it("denies and says so when the environment has no token", () => {
    expect(decideAdminGate({ expected: undefined, submitted: "anything" })).toBe("not-configured");
  });

  it("treats a blank token as unconfigured, not as a secret", () => {
    expect(decideAdminGate({ expected: "   ", submitted: "   " })).toBe("not-configured");
  });

  it("reports a locked door when no cookie was presented", () => {
    expect(decideAdminGate({ expected: "s3cret", submitted: undefined })).toBe("locked");
  });

  it("separates locked from unauthorized so a first visit is not told it mistyped", () => {
    expect(decideAdminGate({ expected: "s3cret", submitted: "" })).toBe("locked");
    expect(decideAdminGate({ expected: "s3cret", submitted: "wrong" })).toBe("unauthorized");
  });

  it("admits only an exact match", () => {
    expect(decideAdminGate({ expected: "s3cret", submitted: "s3cret" })).toBe("ok");
  });

  it("does not admit a prefix of the token", () => {
    expect(decideAdminGate({ expected: "s3cret", submitted: "s3cre" })).toBe("unauthorized");
  });
});
