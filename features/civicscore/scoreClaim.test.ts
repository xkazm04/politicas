// Citace indexu musí nést vlastní původ — a musí umět MLČET, když ho data
// nemají. Pass 42 (2026-07-29 → 08-04) je přesně ten případ: opravená formule,
// šest dní neopravená data, a nic v produktu ten rozdíl neumělo pojmenovat.

import { describe, expect, it } from "vitest";

import { claimStatus, parseClaimRef } from "@/lib/claims/claim";
import { CONTRIBUTION_FORMULA_REF } from "@/lib/analysis/contribution";
import { pspIdFromEntityId } from "@/features/shared/provenance/caseFileLink";
import { summarizeContributionProvenance } from "./provenance";
import { contributionScoreClaim, scoreDerivation, SCORE_CLAIM_DATASET, SCORE_METRIC } from "./scoreClaim";

const prov = (variants: Array<{ pass: number; ref: string; count: number }>) =>
  summarizeContributionProvenance(
    variants.flatMap((v) =>
      Array.from({ length: v.count }, () => ({
        contribution_provenance: { pass: v.pass, ref: v.ref },
      })),
    ),
  );

const UNIFORM = prov([{ pass: 42, ref: CONTRIBUTION_FORMULA_REF, count: 207 }]);
const MIXED = prov([
  { pass: 42, ref: CONTRIBUTION_FORMULA_REF, count: 120 },
  { pass: 11, ref: "contribution", count: 87 },
]);
const ABSENT = summarizeContributionProvenance([{}, {}]);

describe("adresa citace skóre", () => {
  it("ref se rozparsuje na dataset, metriku a poslance", () => {
    const { claim } = contributionScoreClaim(6881, 71.4, UNIFORM);
    const parts = parseClaimRef(claim.ref)!;
    expect(parts.dataset).toBe(SCORE_CLAIM_DATASET);
    expect(parts.metric).toBe(SCORE_METRIC.contribution);
    expect(pspIdFromEntityId(parts.subject!)).toBe(6881);
  });

  it("razí se KOMPOZIT tak, jak ho nese žebříček — modul nic nepočítá", () => {
    expect(contributionScoreClaim(6881, 71.4, UNIFORM).value).toBe(71.4);
  });

  it("adresa nezávisí na průchodu — přepočet nesmí zneplatnit vydané citace", () => {
    const a = contributionScoreClaim(6881, 71.4, UNIFORM).claim.ref;
    const b = contributionScoreClaim(6881, 68.2, prov([{ pass: 43, ref: CONTRIBUTION_FORMULA_REF, count: 207 }]))
      .claim.ref;
    expect(a).toBe(b);
  });

  it("citace odkazuje na metodiku", () => {
    expect(contributionScoreClaim(6881, 71.4, UNIFORM).claim.methodologyUrl).toBe("/metodika");
  });
});

describe("citace nese vlastní provenienci", () => {
  it("jednotná komora → `<ref formule>@<pass>`", () => {
    expect(scoreDerivation(UNIFORM)).toBe(`${CONTRIBUTION_FORMULA_REF}@42`);
    expect(contributionScoreClaim(6881, 71.4, UNIFORM).claim.derivation).toBe(
      `${CONTRIBUTION_FORMULA_REF}@42`,
    );
  });

  it("poloviční přepočet NEMÁ jeden základ — citace si žádný nevybere", () => {
    expect(scoreDerivation(MIXED)).toBeNull();
    expect(contributionScoreClaim(6881, 71.4, MIXED).claim.derivation).toBeUndefined();
  });

  it("chybějící provenience se nedomýšlí", () => {
    expect(scoreDerivation(ABSENT)).toBeNull();
    expect(contributionScoreClaim(6881, 71.4, ABSENT).claim.derivation).toBeUndefined();
  });
});

describe("index lidskou branou neprochází", () => {
  it("stav claimu je `ungated`, nikdy „čeká na kontrolu“", () => {
    expect(claimStatus(contributionScoreClaim(6881, 71.4, UNIFORM).claim)).toBe("ungated");
  });
});
