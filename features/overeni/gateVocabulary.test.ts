import { describe, expect, it } from "vitest";
import { czechGateErrors } from "@/lib/analysis/language-gate";
import { gateHeadlineCs, gateStatusInfo, UNGATED_LABEL_CS } from "./gateVocabulary";

describe("slovník stavu lidské brány", () => {
  it("obě rodiny tokenů mají tutéž větu pro tentýž stav", () => {
    // ReviewStatus (účtenka) vs ClaimReviewStatus (figura) — dvě jména, jeden stav.
    expect(gateStatusInfo("pending").status).toBe("pending_review");
    expect(gateStatusInfo("pending").labelCs).toBe(gateStatusInfo("pending_review").labelCs);
    expect(gateStatusInfo("verified").status).toBe("verified");
    expect(gateStatusInfo("rejected").status).toBe("rejected");
  });

  it("neznámý token se vypíše DOSLOVA a označí se jako nepřeložený", () => {
    const info = gateStatusInfo("needs_second_reviewer");
    expect(info.known).toBe(false);
    expect(info.status).toBe("unmapped");
    expect(info.token).toBe("needs_second_reviewer");
    expect(info.labelCs).toContain("needs_second_reviewer");
    expect(info.labelCs).toContain("nepřeložený");
    // Nikdy prázdno: prázdná hodnota se také pojmenuje.
    expect(gateStatusInfo("").labelCs).toContain("prázdná hodnota");
  });

  it("titulek modifikátoru rozlišuje potvrzeno / čeká / zamítnuto", () => {
    expect(gateHeadlineCs(gateStatusInfo("verified"))).toContain("potvrzeno");
    expect(gateHeadlineCs(gateStatusInfo("pending"))).toContain("neproběhla");
    expect(gateHeadlineCs(gateStatusInfo("rejected"))).toContain("zamítnuto");
    expect(gateHeadlineCs(gateStatusInfo("xyz"))).toContain("xyz");
  });

  it("česká copy prochází jazykovou branou", () => {
    const copy = [
      UNGATED_LABEL_CS,
      ...["verified", "pending_review", "rejected"].flatMap((t) => [
        gateStatusInfo(t).labelCs,
        gateHeadlineCs(gateStatusInfo(t)),
      ]),
    ];
    expect(czechGateErrors(copy.map((text, i) => ({ label: `gate-${i}`, text })))).toEqual([]);
  });
});
