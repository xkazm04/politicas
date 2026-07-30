import { describe, expect, it } from "vitest";
import {
  claimDataAttributes,
  claimReviewJsonLd,
  claimStatus,
  makeClaimRef,
  parseClaimRef,
  serializeClaim,
  type Claim,
} from "./claim";
import { formatCitable, formatDecimal, formatInt, formattersFor } from "../format";

const VERIFIED: Claim = {
  ref: makeClaimRef({ dataset: "psp.cz — jmenovitá hlasování", metric: "prumerna-dochazka" }),
  dataset: "psp.cz — jmenovitá hlasování",
  metric: "prumerna-dochazka",
  unit: "%",
  sourceUrl: "https://www.psp.cz/sqw/hlasovani.sqw",
  retrievedAt: "2026-07-30",
  reviewStatus: "verified",
};

describe("claim ref codec", () => {
  it("round-trip zachová dataset/metric/subject včetně ':' a diakritiky", () => {
    const parts = { dataset: "registr smluv ⋈ ares", metric: "penize:napojene-firmy", subject: "mp-042" };
    expect(parseClaimRef(makeClaimRef(parts))).toEqual(parts);
  });

  it("round-trip bez subjektu subjekt nevymýšlí", () => {
    const parts = { dataset: "civicscore v1.4", metric: "prumerny-kompozit" };
    expect(parseClaimRef(makeClaimRef(parts))).toEqual(parts);
  });

  it("odmítne cizí i malformované řetězce", () => {
    expect(parseClaimRef("https://example.com")).toBeNull();
    expect(parseClaimRef("claim:jen-dataset")).toBeNull();
    expect(parseClaimRef("claim:a:b:c:d")).toBeNull();
    expect(parseClaimRef("claim:%zz:metric")).toBeNull();
  });
});

describe("serializeClaim — determinismus", () => {
  it("stejný claim serializuje identicky bez ohledu na pořadí vložení klíčů", () => {
    const shuffled: Claim = {
      reviewStatus: "verified",
      retrievedAt: VERIFIED.retrievedAt,
      unit: VERIFIED.unit,
      metric: VERIFIED.metric,
      sourceUrl: VERIFIED.sourceUrl,
      dataset: VERIFIED.dataset,
      ref: VERIFIED.ref,
    };
    expect(serializeClaim(shuffled)).toBe(serializeClaim(VERIFIED));
  });

  it("vynechá nedefinovaná pole a materializuje výchozí status pending", () => {
    const minimal: Claim = { ref: "claim:a:b", dataset: "a", metric: "b" };
    const parsed = JSON.parse(serializeClaim(minimal));
    expect(parsed).toEqual({ ref: "claim:a:b", dataset: "a", metric: "b", reviewStatus: "pending" });
    // Pořadí klíčů je kanonické (CLAIM_KEYS), ne pořadí vložení.
    expect(Object.keys(parsed)).toEqual(["ref", "dataset", "metric", "reviewStatus"]);
  });

  it("opakovaná serializace je byte-identická (stabilní hash-vstup)", () => {
    expect(serializeClaim(VERIFIED)).toBe(serializeClaim({ ...VERIFIED }));
  });
});

describe("claimDataAttributes", () => {
  it("emituje povinná pole + jen definovaná volitelná, hodnotu s desetinnou tečkou", () => {
    expect(claimDataAttributes(VERIFIED, 78.3)).toEqual({
      "data-claim-ref": VERIFIED.ref,
      "data-claim-dataset": "psp.cz — jmenovitá hlasování",
      "data-claim-metric": "prumerna-dochazka",
      "data-claim-value": "78.3",
      "data-claim-status": "verified",
      "data-claim-unit": "%",
      "data-claim-source-url": "https://www.psp.cz/sqw/hlasovani.sqw",
      "data-claim-retrieved": "2026-07-30",
    });
  });

  it("bez reviewStatus svědčí jako pending (bezpečný default)", () => {
    const minimal: Claim = { ref: "claim:a:b", dataset: "a", metric: "b" };
    expect(claimStatus(minimal)).toBe("pending");
    expect(claimDataAttributes(minimal, 1)["data-claim-status"]).toBe("pending");
  });
});

describe("formatCitable — nulová vizuální změna", () => {
  it("viditelný text je byte-identický s prostým formátovačem", () => {
    for (const locale of ["cs", "en"] as const) {
      expect(formatCitable(78.3, VERIFIED, locale, "dec").text).toBe(formatDecimal(78.3, locale));
      expect(formatCitable(5214, VERIFIED, locale, "int").text).toBe(formatInt(5214, locale));
    }
  });

  it("nefinální hodnota vrací placeholder BEZ atributů — pomlčka nesvědčí", () => {
    const { text, attrs } = formatCitable(Number.NaN, VERIFIED, "cs");
    expect(text).toBe("—");
    expect(attrs).toBeNull();
  });

  it("f.cite v bundle formátovačů deleguje na formatCitable", () => {
    const f = formattersFor("cs");
    expect(f.cite(78.3, VERIFIED)).toEqual(formatCitable(78.3, VERIFIED, "cs"));
  });
});

describe("claimReviewJsonLd — schema.org ClaimReview (strukturálně)", () => {
  it("ověřený claim dává validní ClaimReview tvar", () => {
    const jsonLd = claimReviewJsonLd(VERIFIED, "78,3");
    expect(jsonLd).not.toBeNull();
    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "ClaimReview",
      claimReviewed: "prumerna-dochazka: 78,3 % (psp.cz — jmenovitá hlasování)",
      itemReviewed: { "@type": "Claim", name: VERIFIED.ref },
      reviewRating: {
        "@type": "Rating",
        ratingValue: 5,
        bestRating: 5,
        worstRating: 1,
        alternateName: "ověřeno",
      },
      author: { "@type": "Organization", name: "Politicas" },
      datePublished: "2026-07-30",
      url: VERIFIED.sourceUrl,
    });
    // Serializace do <script> bloku musí být čistý JSON.
    expect(() => JSON.parse(JSON.stringify(jsonLd))).not.toThrow();
  });

  it("methodologyUrl se propíše jako appearance ověřovaného claimu", () => {
    const withMethod = { ...VERIFIED, methodologyUrl: "https://example.org/metodika" };
    expect(claimReviewJsonLd(withMethod, "78,3")?.itemReviewed.appearance).toEqual({
      "@type": "CreativeWork",
      url: "https://example.org/metodika",
    });
  });

  it("pending claim NIKDY nevydá ClaimReview — lidská brána platí i tady", () => {
    expect(claimReviewJsonLd({ ...VERIFIED, reviewStatus: "pending" }, "78,3")).toBeNull();
    const noStatus: Claim = { ref: "claim:a:b", dataset: "a", metric: "b" };
    expect(claimReviewJsonLd(noStatus, "1,0")).toBeNull();
  });
});
