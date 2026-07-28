// The classification-precedence contract for a `linked_to` tie.
//
// A human review gate is only a gate if the human's judgement becomes the product's
// truth. Both /penize consumers used to RECOMPUTE the tie class at read time from two
// free-text strings, so every `props.tie_class` an analyst had written — 211 of 211 on
// the live store — was dead data, and the five ties where the two disagree rendered the
// guess. `resolveTieClass` is the one place that decides; these tests pin it, including
// the real divergences measured on the store (2026-07-29).

import { describe, expect, it } from "vitest";
import { classifyTie, resolveReviewOrder, resolveTieClass, reviewRank, reviewTier } from "./reviewTypes";

describe("resolveTieClass — stored beats the heuristic", () => {
  it("reads a stored class and reports it as stored", () => {
    const r = resolveTieClass("steward", "jednatel", "Alfa s.r.o.");
    expect(r.tieClass).toBe("steward");
    expect(r.origin).toBe("stored");
  });

  it("falls back to the heuristic when nothing is stored — and says it is derived", () => {
    const r = resolveTieClass(undefined, "jednatel", "Alfa s.r.o.");
    expect(r.tieClass).toBe("owner-operator");
    expect(r.origin).toBe("derived");
    expect(r.disagrees).toBe(false);
    expect(resolveTieClass(null, "jednatel", "Alfa s.r.o.").origin).toBe("derived");
  });

  it("treats an unrecognised stored value as absent (the graph is not a type system)", () => {
    const r = resolveTieClass("vlastník-něčeho", "jednatel", "Alfa s.r.o.");
    expect(r.tieClass).toBe("owner-operator");
    expect(r.origin).toBe("derived");
  });

  it("keeps the heuristic's answer alongside the stored one, so a disagreement is visible", () => {
    const r = resolveTieClass("steward", "jednatel", "Alfa s.r.o.");
    expect(r.heuristic).toBe("owner-operator");
    expect(r.disagrees).toBe(true);
    // agreeing values are not a disagreement
    expect(resolveTieClass("owner-operator", "jednatel", "Alfa s.r.o.").disagrees).toBe(false);
  });

  // The five ties measured on the live store where props.tie_class contradicts
  // classifyTie(). The stored value is the investigated one and must win every time.
  it.each([
    // IČO 24227901 — the MP's OWN residential owners' association (SVJ). The heuristic
    // reads "pověřený vlastník" as ownership of a private supplier and the product
    // captioned it "poslanec vlastní nebo řídí soukromou firmu, která dodává státu".
    ["Společenství vlastníků Vlastislavova 605/20, Praha 4", "pověřený vlastník", "steward", "owner-operator"],
    ["Komwag, podnik čistoty a údržby města, a.s.", "člen představenstva", "steward", "manager"],
    ["Pojišťovna VZP, a.s.", "člen představenstva", "steward", "manager"],
    ["Vodovody a kanalizace Vsetín, a.s.", "předseda představenstva", "manager", "steward"],
    ["Vodovody a kanalizace Vyškov,a.s.", "člen představenstva", "manager", "steward"],
  ] as const)("resolves %s to the stored class, not the guess", (company, role, stored, heuristic) => {
    expect(classifyTie(role, company)).toBe(heuristic); // the heuristic really does differ
    const r = resolveTieClass(stored, role, company);
    expect(r.tieClass).toBe(stored);
    expect(r.origin).toBe("stored");
    expect(r.disagrees).toBe(true);
  });

  it("the SVJ case loses the owner-operator reading entirely", () => {
    const r = resolveTieClass("steward", "pověřený vlastník", "Společenství vlastníků Vlastislavova 605/20, Praha 4");
    expect(r.tieClass).not.toBe("owner-operator");
  });
});

describe("resolveReviewOrder — a stored ORDER key is a cache, not a judgement", () => {
  const base = {
    tieClass: "owner-operator" as const,
    corroboration: "registry-confirmed" as const,
    contractCzk: 5_000_000,
    subsidiesCzk: 0,
  };

  it("reports 'stored' when the graph's value still matches the tie in front of the reader", () => {
    const r = resolveReviewOrder({
      ...base,
      storedTier: reviewTier(base),
      storedRank: reviewRank(base),
    });
    expect(r.origin).toBe("stored");
    expect(r.reviewTier).toBe(reviewTier(base));
    expect(r.reviewRank).toBe(reviewRank(base));
  });

  it("reports 'derived' when the edge carries none (3 of 211 on the live store)", () => {
    const r = resolveReviewOrder({ ...base, storedTier: undefined, storedRank: undefined });
    expect(r.origin).toBe("derived");
    expect(r.reviewRank).toBe(reviewRank(base));
  });

  it("recomputes — and SAYS so — when the stored key predates the money it encodes", () => {
    // The batch-012 re-ingest grew `supplies` 2 290 → 153 731 rows, so 153 of 208 stored
    // ranks encode a contract corpus that no longer exists. Mixing those with current
    // ranks in one sort is not an order at all: the queue must use one vintage.
    const stale = reviewRank({ ...base, contractCzk: 100_000 });
    const r = resolveReviewOrder({ ...base, storedTier: reviewTier(base), storedRank: stale });
    expect(r.origin).toBe("stale-recomputed");
    expect(r.reviewRank).toBe(reviewRank(base));
    expect(r.reviewRank).not.toBe(stale);
  });

  it("recomputes when corroboration was written after the tier (batch-006 dataor sweep)", () => {
    // Komwag/Pojišťovna VZP: corroboration landed at pass 27, the tier at pass 24, so the
    // card renders "potvrzeno OR" while the stored tier still says "nepotvrzeno" (3).
    const r = resolveReviewOrder({ ...base, storedTier: 3, storedRank: reviewRank(base) });
    expect(r.origin).toBe("stale-recomputed");
    expect(r.reviewTier).toBe(0);
  });

  it("the resolved order still tracks the RESOLVED class, not the heuristic", () => {
    // Vodovody a kanalizace Vsetín: stored `manager`, heuristic `steward`. Honouring the
    // stored class must move the tie from review tier 2 into tier 1.
    const cls = resolveTieClass("manager", "předseda představenstva", "Vodovody a kanalizace Vsetín, a.s.");
    const r = resolveReviewOrder({
      storedTier: undefined,
      storedRank: undefined,
      tieClass: cls.tieClass,
      corroboration: "registry-confirmed",
      contractCzk: 1_000_000,
      subsidiesCzk: 0,
    });
    expect(r.reviewTier).toBe(1);
  });
});
