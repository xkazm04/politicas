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

describe("ReceiptBody types its catalog maps by the closed enums they label", () => {
  const s = src("features/shared/provenance/ReceiptBody.tsx");
  it("the registry-tier map satisfies Record<SourceTier, string> and has no raw-token fallback", () => {
    expect(s).toMatch(/satisfies Record<SourceTier, string>/);
    expect(s).not.toMatch(/TIER_LABEL_KEY\[l\.tier\] \?/);
  });
  it("every audit decision is named; nothing falls through to „vráceno“", () => {
    expect(s).toMatch(/satisfies Record<ReceiptAuditEntry\["decision"\], string>/);
    expect(s).toMatch(/"needs-more": "receipt\.audit\.return"/);
    expect(s).not.toMatch(/\?\? "receipt\.audit\.return"/);
  });
});

describe("the case-file label map is defined once, in caseFileLink.ts", () => {
  it("caseFileLink exports it; ReceiptBody and ReceiptPage import it", () => {
    expect(src("features/shared/provenance/caseFileLink.ts")).toMatch(
      /export const CASE_FILE_LABEL_KEY = \{[\s\S]*?\} as const satisfies Record<CaseFileLink\["target"\], string>/,
    );
    for (const f of ["ReceiptBody.tsx", "ReceiptPage.tsx"]) {
      const s = src(`features/shared/provenance/${f}`);
      expect(s, f).not.toMatch(/const CASE_FILE_LABEL_KEY/);
      expect(s, f).toMatch(/import \{ CASE_FILE_LABEL_KEY, caseFileLinkFor \} from "\.\/caseFileLink"/);
    }
  });
});

describe("ProvenanceCapsule's panel is the modal dialog its header promises", () => {
  it('role="dialog" carries aria-modal', () => {
    expect(src("features/shared/provenance/ProvenanceCapsule.tsx")).toMatch(
      /role="dialog"\s+aria-modal="true"/,
    );
  });
});

describe("LeaderboardPosterData can carry an undated record", () => {
  it("retrievedAt admits null - the citation module already prints the reason", () => {
    expect(src("features/shared/poster/demo/LeaderboardPoster.tsx")).toMatch(/retrievedAt: string \| null;/);
  });
});
