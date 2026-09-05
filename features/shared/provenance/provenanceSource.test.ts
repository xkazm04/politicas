import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the shared provenance catalog (scan-sweep 2026-09-07,
 * shared-provenance): the rules this catalog enforces read through the repo's single
 * definitions instead of carrying a second copy. */

const src = (p: string) => readFileSync(p, "utf8");

describe("caseFileLink reads the person-id grammar from lib/ingest/changeEvents", () => {
  const s = src("features/shared/provenance/caseFileLink.ts");
  it("imports pspIdFromNodeId and holds no second person-id regex", () => {
    expect(s).toMatch(/import \{ pspIdFromNodeId \} from "@\/lib\/ingest\/changeEvents"/);
    expect(s).not.toMatch(/const PERSON_ID/);
  });
});
