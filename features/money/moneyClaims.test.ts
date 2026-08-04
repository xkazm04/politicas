// Peněžní claim je ADRESA — a adresu musí umět složit i rozložit obě strany
// rovnice (plocha, která číslo vydá, a brána, která ho znovu odvodí). Test drží
// právě tenhle kontrakt: ref se dá rozparsovat zpátky na dataset/metriku/předmět,
// hodnota jde ze sdílené aritmetiky a stav brány nesplácne zamítnutí do „pending".

import { describe, expect, it } from "vitest";

import { claimStatus, parseClaimRef } from "@/lib/claims/claim";
import { decodeClaimRef, edgeClaimRef } from "@/features/shared/provenance/claimRef";
import { icoFromEntityId, pspIdFromEntityId } from "@/features/shared/provenance/caseFileLink";
import {
  aggregateClaimStatus,
  companyReachClaim,
  mpBucketClaim,
  tieClaimStatus,
  tieReachClaim,
  MONEY_CLAIM_DATASET,
  MONEY_METRIC,
  type ClaimableTie,
} from "./moneyClaims";
import { bucketReachCzk, reachableMoney, tieReach } from "./reachableMoney";

const RECEIPT = edgeClaimRef("psp:person:6881", "linked_to", "company:ico:46347534");

const tie = (over: Partial<ClaimableTie> = {}): ClaimableTie => ({
  companyId: "company:ico:46347534",
  tieClass: "owner-operator",
  contractCount: 3,
  contractCzk: 412_000_000,
  subsidiesCzk: 1_500_000,
  donatedToPartyCzk: null,
  receiptRef: RECEIPT,
  reviewState: "pending_review",
  ...over,
});

describe("adresa peněžního claimu", () => {
  it("ref se rozparsuje zpátky na dataset, metriku a předmět", () => {
    const { claim } = tieReachClaim(tie(), 42);
    const parts = parseClaimRef(claim.ref);
    expect(parts).toEqual({
      dataset: MONEY_CLAIM_DATASET,
      metric: MONEY_METRIC.tieReach,
      subject: RECEIPT,
    });
  });

  it("předmět claimu vazby JE její účtenka — dekóduje se na tutéž hranu", () => {
    const { claim } = tieReachClaim(tie(), 42);
    const parts = parseClaimRef(claim.ref)!;
    expect(decodeClaimRef(parts.subject!)).toEqual({
      kind: "edge",
      src: "psp:person:6881",
      rel: "linked_to",
      dst: "company:ico:46347534",
    });
  });

  it("předmět agregátů je id uzlu, které umí přečíst sdílený dekodér tvarů", () => {
    const mp = parseClaimRef(mpBucketClaim(6881, "owned", EMPTY_BUCKET, [], 42).claim.ref)!;
    expect(pspIdFromEntityId(mp.subject!)).toBe(6881);
    const co = parseClaimRef(companyReachClaim("46347534", EMPTY_BUCKET, [], 42).claim.ref)!;
    expect(icoFromEntityId(co.subject!)).toBe("46347534");
  });

  it("obě strany rozdělení mají RŮZNOU metriku — jsou to dvě různá tvrzení", () => {
    const owned = mpBucketClaim(6881, "owned", EMPTY_BUCKET, [], 42).claim;
    const steward = mpBucketClaim(6881, "steward", EMPTY_BUCKET, [], 42).claim;
    expect(owned.metric).not.toBe(steward.metric);
    expect(owned.ref).not.toBe(steward.ref);
  });

  it("základ odvození nese průchod grafu", () => {
    expect(tieReachClaim(tie(), 42).claim.derivation).toBe("kg-pass:42");
  });
});

const EMPTY_BUCKET = {
  companies: 0,
  contractCount: 0,
  contractCzk: 0,
  subsidiesCzk: 0,
  donatedToPartyCzk: 0,
};

describe("hodnota jde ze sdílené aritmetiky, ne z vlastního součtu", () => {
  it("dosah vazby JE tieReach()", () => {
    const t = tie();
    expect(tieReachClaim(t, 42).value).toBe(tieReach(t).czk);
    // a to je smlouvy + dotace, ne jen smlouvy
    expect(tieReachClaim(t, 42).value).toBe(413_500_000);
  });

  it("dosah firmy JE bucketReachCzk() nad sdílenou definicí", () => {
    const money = reachableMoney([tie()]);
    expect(companyReachClaim("46347534", money.attributable, [], 42).value).toBe(
      bucketReachCzk(money.attributable),
    );
  });

  it("dlaždice spisu razí přesně to, co sází — Σ hodnot smluv té třídy", () => {
    const money = reachableMoney([tie()]);
    expect(mpBucketClaim(6881, "owned", money.attributable, [], 42).value).toBe(412_000_000);
  });
});

describe("stav lidské brány je součást tvrzení", () => {
  it("zamítnutá vazba se nevydává za nezkontrolovanou", () => {
    expect(tieClaimStatus("rejected")).toBe("rejected");
    expect(tieClaimStatus("pending_review")).toBe("pending");
    expect(tieClaimStatus("verified")).toBe("verified");
    expect(claimStatus(tieReachClaim(tie({ reviewState: "rejected" }), 42).claim)).toBe("rejected");
  });

  it("agregát je ověřený, jen když jsou ověřené VŠECHNY jeho vazby", () => {
    expect(aggregateClaimStatus(["verified", "verified"])).toBe("verified");
    expect(aggregateClaimStatus(["verified", "pending_review"])).toBe("pending");
    expect(aggregateClaimStatus(["rejected"])).toBe("pending");
    // prázdný agregát netvrdí potvrzení
    expect(aggregateClaimStatus([])).toBe("pending");
  });
});
