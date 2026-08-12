import { describe, expect, it } from "vitest";
import type { KgEdgeRow, KgNodeRow, ReviewAuditRow } from "@/lib/db/types";
import { decodeClaimRef } from "./claimRef";
import {
  deriveEdgeReceipt,
  deriveNodeReceipt,
  formatWeightCs,
  gateFromEdge,
  relLabelCs,
  toClaimReviewJsonLd,
  toDecodedClaim,
  toEndpoint,
  toProvenance,
} from "./receipt";

// ── Fixture řádky (tvary z lib/db/types.ts) ─────────────────────────────────

const person: KgNodeRow = {
  id: "psp:person:6202",
  kind: "person",
  label: "Jana Nováková",
  props: {},
  firstSeenPass: 1,
  provenance: { pass: 1, method: "deterministic", ref: "psp poslanci", computedAt: "2026-07-24T10:00:00Z" },
};

const company: KgNodeRow = {
  id: "company:ico:25841991",
  kind: "company",
  label: "STAVBY NOVÁK s.r.o.",
  props: { ico: "25841991" },
  firstSeenPass: 4,
  provenance: { pass: 4, method: "deterministic", ref: "ares", computedAt: "2026-07-24T10:00:00Z" },
};

const linkedTo = (props: Record<string, unknown>): KgEdgeRow => ({
  src: person.id,
  rel: "linked_to",
  dst: company.id,
  weight: null,
  props,
  provenance: { pass: 5, method: "deterministic", ref: "ares angažmá", computedAt: "2026-07-25T09:00:00Z" },
});

const coVotes: KgEdgeRow = {
  src: "psp:person:6202",
  rel: "co_votes_with",
  dst: "psp:person:7001",
  weight: 0.87,
  props: {},
  provenance: { pass: 3, method: "deterministic", ref: "hl2023s", computedAt: "2026-07-20T08:00:00Z" },
};

const audit: ReviewAuditRow[] = [
  {
    id: "a2",
    src: person.id,
    rel: "linked_to",
    dst: company.id,
    decision: "confirm",
    reviewer: "redakce",
    note: "doloženo v OR",
    decidedAt: "2026-07-26T12:00:00Z",
    priorState: "pending_review",
  },
];

// ── Lidská brána ────────────────────────────────────────────────────────────

describe("gateFromEdge — stav lidské brány", () => {
  it("verified doslova, s posledním kontrolorem z hrany", () => {
    const gate = gateFromEdge(
      linkedTo({ review_state: "verified", last_reviewer: "redakce", last_reviewed_at: "2026-07-26T12:00:00Z" }),
      audit,
    );
    expect(gate).not.toBeNull();
    expect(gate?.status).toBe("verified");
    expect(gate?.reviewer).toBe("redakce");
    expect(gate?.audit).toHaveLength(1);
    expect(gate?.audit[0].decision).toBe("confirm");
  });

  it("gated relace BEZ review_state je pending_review, nikdy verified", () => {
    const gate = gateFromEdge(linkedTo({}), []);
    expect(gate?.status).toBe("pending_review");
  });

  it("rejected je terminální stav a vypíše se doslova", () => {
    expect(gateFromEdge(linkedTo({ review_state: "rejected" }), [])?.status).toBe("rejected");
  });

  it("legacy klíč `state` se čte jako review_state (parita s moneyLoader)", () => {
    expect(gateFromEdge(linkedTo({ state: "verified" }), [])?.status).toBe("verified");
  });

  it("negated relace bez stavu nemá bránu (null) — deterministické odvození", () => {
    expect(gateFromEdge(coVotes, [])).toBeNull();
  });

  it("neznámá hodnota stavu se nikdy nepovýší na verified", () => {
    expect(gateFromEdge(linkedTo({ review_state: "cokoli" }), [])?.status).toBe("pending_review");
  });
});

// ── Koncové body a provenience ──────────────────────────────────────────────

describe("toEndpoint — registry jen z uložených identifikátorů", () => {
  it("firma s IČO dostane ARES/OR odkazy a citovatelné IČO", () => {
    const ep = toEndpoint(company.id, company);
    expect(ep.citable).toBe("IČO 25841991");
    expect(ep.links.some((l) => l.registry === "ARES")).toBe(true);
  });

  it("chybějící uzel = doslovné id, žádné hádané odkazy", () => {
    const ep = toEndpoint("company:ico:404", null);
    expect(ep.label).toBe("company:ico:404");
    expect(ep.kind).toBe("unknown");
    expect(ep.links).toEqual([]);
    expect(ep.citable).toBeNull();
  });

  it("neznámý druh uzlu nedostane vymyšlený odkaz", () => {
    const weird: KgNodeRow = { ...person, id: "x:1", kind: "planet", label: "X" };
    const ep = toEndpoint(weird.id, weird);
    expect(ep.links).toEqual([]);
    expect(ep.citable).toBeNull();
  });
});

describe("toProvenance — doslovný přepis, žádné dosazování", () => {
  it("čte pass/method/ref/computedAt", () => {
    const p = toProvenance({ pass: 5, method: "deterministic", ref: "ares", computedAt: "2026-07-25T09:00:00Z" });
    expect(p).toEqual({ pass: 5, method: "deterministic", ref: "ares", computedAt: "2026-07-25T09:00:00Z" });
  });

  it("chybějící pole jsou null, ne prázdné řetězce", () => {
    expect(toProvenance({})).toEqual({ pass: null, method: null, ref: null, computedAt: null });
    expect(toProvenance(undefined)).toEqual({ pass: null, method: null, ref: null, computedAt: null });
  });

  it("pass jako numerický řetězec se přečte jako číslo (jsonb tvar)", () => {
    expect(toProvenance({ pass: "5" }).pass).toBe(5);
  });
});

// ── Celé účtenky ────────────────────────────────────────────────────────────

describe("deriveEdgeReceipt", () => {
  it("sestaví účtenku vazby: ref je zpět rozluštitelný na touž trojici", () => {
    const r = deriveEdgeReceipt({
      edge: linkedTo({ review_state: "verified" }),
      srcNode: person,
      dstNode: company,
      audit,
    });
    expect(r.kind).toBe("edge");
    if (r.kind !== "edge") return;
    expect(r.subject.label).toBe("Jana Nováková");
    expect(r.object.citable).toBe("IČO 25841991");
    expect(r.relLabel).toBe("má vazbu na");
    expect(r.gate?.status).toBe("verified");
    expect(decodeClaimRef(r.ref)).toEqual({
      kind: "edge",
      src: person.id,
      rel: "linked_to",
      dst: company.id,
    });
  });

  it("deterministická hrana nese váhu a žádnou bránu", () => {
    const r = deriveEdgeReceipt({ edge: coVotes, srcNode: person, dstNode: undefined });
    if (r.kind !== "edge") return;
    expect(r.weight).toBe(0.87);
    expect(r.gate).toBeNull();
    expect(r.provenance.pass).toBe(3);
  });
});

describe("deriveNodeReceipt", () => {
  it("sestaví účtenku uzlu s proveniencí a registry", () => {
    const r = deriveNodeReceipt(company);
    expect(r.kind).toBe("node");
    expect(r.subject.links.length).toBeGreaterThan(0);
    expect(r.provenance.method).toBe("deterministic");
    expect(decodeClaimRef(r.ref)).toEqual({ kind: "node", id: company.id });
  });
});

// ── Sazba váhy a slovník relací ─────────────────────────────────────────────

describe("formatWeightCs — doklad nezaokrouhluje", () => {
  it("sází uloženou hodnotu přesně, jen s českou čárkou", () => {
    expect(formatWeightCs(0.87)).toBe("0,87");
    expect(formatWeightCs(153731)).toBe("153731");
    expect(formatWeightCs(-1.5)).toBe("-1,5");
  });

  it("nekonečno/NaN nikdy nedoteče do sazby", () => {
    expect(formatWeightCs(NaN)).toBe("—");
    expect(formatWeightCs(Infinity)).toBe("—");
  });
});

describe("relLabelCs", () => {
  it("známá relace má českou podobu, neznámá se vypíše doslova", () => {
    expect(relLabelCs("linked_to")).toBe("má vazbu na");
    expect(relLabelCs("mystery_rel")).toBe("mystery_rel");
  });
});

// ── Zaniklá adresa: co tvrdila ──────────────────────────────────────────────

describe("toDecodedClaim — adresa nese tvrzení i bez záznamu v grafu", () => {
  const nodes = new Map([
    [person.id, person],
    [company.id, company],
  ]);

  it("hrana: subjekt — relace — objekt, se štítky uzlů, které graf ještě nese", () => {
    const d = toDecodedClaim({ kind: "edge", src: person.id, rel: "linked_to", dst: company.id }, nodes);
    expect(d.kind).toBe("edge");
    expect(d.subject).toEqual({ id: person.id, kind: "person", label: "Jana Nováková" });
    expect(d.object).toEqual({ id: company.id, kind: "company", label: "STAVBY NOVÁK s.r.o." });
    expect(d.rel).toBe("linked_to");
    expect(d.relLabel).toBe("má vazbu na");
  });

  it("uzel, který v grafu není, dostane doslovné id a kind null — nikdy hádaný druh", () => {
    const d = toDecodedClaim(
      { kind: "edge", src: person.id, rel: "linked_to", dst: "company:ico:404" },
      nodes,
    );
    expect(d.object).toEqual({ id: "company:ico:404", kind: null, label: "company:ico:404" });
  });

  it("uzlová adresa nemá relaci ani protějšek", () => {
    const d = toDecodedClaim({ kind: "node", id: "psp:person:9999" }, new Map());
    expect(d).toEqual({
      kind: "node",
      subject: { id: "psp:person:9999", kind: null, label: "psp:person:9999" },
      rel: null,
      relLabel: null,
      object: null,
    });
  });

  it("neznámou relaci vypíše doslova, nepovýší ji na větu", () => {
    const d = toDecodedClaim({ kind: "edge", src: "a", rel: "mystery_rel", dst: "b" }, new Map());
    expect(d.relLabel).toBe("mystery_rel");
  });
});

// ── ClaimReview JSON-LD (strukturální tvar, viz koordinace s 2E) ────────────
//
// AKCEPTAČNÍ MEZ: fact-check značka jde ven POUZE za tvrzení, které prošlo
// lidskou branou — týž zákon, jaký vyhlašuje lib/claims/claim.ts §3. Test drží
// obě strany: ověřená hrana značku VYDÁ, nezkontrolovaná/zamítnutá/negated ji
// nedostane.

const verifiedReceipt = () =>
  deriveEdgeReceipt({
    edge: linkedTo({
      review_state: "verified",
      last_reviewer: "redakce",
      last_reviewed_at: "2026-07-26T12:00:00Z",
    }),
    srcNode: person,
    dstNode: company,
    audit,
  });

describe("toClaimReviewJsonLd — brána", () => {
  it("ověřená hrana vydá ClaimReview s numerickým hodnocením", () => {
    const ld = toClaimReviewJsonLd(verifiedReceipt(), "https://politicas.example/zdroj/abc");
    expect(ld).not.toBeNull();
    expect(ld?.["@type"]).toBe("ClaimReview");
    expect(ld?.claimReviewed).toContain("Jana Nováková");
    expect(ld?.reviewRating.ratingValue).toBe(5);
    expect(ld?.reviewRating.bestRating).toBe(5);
    expect(ld?.reviewRating.alternateName).toBe("ověřeno");
  });

  it("nezkontrolovaná vazba NEVYDÁ fact-check značku", () => {
    const r = deriveEdgeReceipt({ edge: linkedTo({}), srcNode: person, dstNode: company });
    expect(r.kind === "edge" && r.gate?.status).toBe("pending_review");
    expect(toClaimReviewJsonLd(r, "https://politicas.example/zdroj/abc")).toBeNull();
  });

  it("zamítnutá vazba NEVYDÁ fact-check značku", () => {
    const r = deriveEdgeReceipt({
      edge: linkedTo({ review_state: "rejected" }),
      srcNode: person,
      dstNode: company,
    });
    expect(toClaimReviewJsonLd(r, "https://politicas.example/zdroj/abc")).toBeNull();
  });

  it("deterministické odvození (bez brány) fact-check značku nedostane", () => {
    const r = deriveEdgeReceipt({ edge: coVotes, srcNode: person, dstNode: undefined });
    expect(toClaimReviewJsonLd(r, "https://politicas.example/zdroj/abc")).toBeNull();
  });

  it("uzlová účtenka fact-check značku nedostane", () => {
    expect(toClaimReviewJsonLd(deriveNodeReceipt(company), "https://politicas.example/zdroj/u")).toBeNull();
  });
});

describe("toClaimReviewJsonLd — tvar", () => {
  it("adresa je absolutní a jde do `url`; itemReviewed nese trvalý ref", () => {
    const r = verifiedReceipt();
    const ld = toClaimReviewJsonLd(r, "https://politicas.example/zdroj/abc");
    expect(ld?.url).toBe("https://politicas.example/zdroj/abc");
    expect(ld?.itemReviewed.name).toBe(r.ref);
  });

  it("bez poctivě zjistitelného základu adresy se `url` VYNECHÁ, nevymyslí", () => {
    const ld = toClaimReviewJsonLd(verifiedReceipt(), null);
    expect(ld).not.toBeNull();
    expect(ld && "url" in ld).toBe(false);
  });

  it("appearance je CreativeWork (ne holý řetězec) a nese registry obou stran", () => {
    const ld = toClaimReviewJsonLd(verifiedReceipt(), null);
    const appearance = ld?.itemReviewed.appearance ?? [];
    expect(appearance.length).toBeGreaterThan(0);
    for (const a of appearance) {
      expect(a["@type"]).toBe("CreativeWork");
      expect(a.url).toMatch(/^https?:\/\//);
    }
    // Bez duplicit — výstup musí být bajtově stabilní.
    expect(new Set(appearance.map((a) => a.url)).size).toBe(appearance.length);
  });

  it("datePublished je datum ROZHODNUTÍ brány, ne odvození", () => {
    const ld = toClaimReviewJsonLd(verifiedReceipt(), null);
    expect(ld?.datePublished).toBe("2026-07-26T12:00:00Z");
  });
});
