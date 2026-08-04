/*
 * DŮKAZNÍ PARITA: co vidí veřejný spis, musí vidět i ten, kdo rozhoduje.
 *
 * `mapLinkedToTie` je JEDINÉ místo, kde se z hrany `linked_to` stane vazba — od
 * 2026-08-04 i pro ověřovací konzoli (`getVerificationData.ts`), která si do té doby
 * zvedala z TÉŽE hrany vlastní, užší projekci. Tenhle soubor drží obojí: že mapper čte
 * důkaz, který hrana nese, a že typ konzole je nadmnožinou typu vazby, takže se ta dvojí
 * projekce nemůže znovu rozejít.
 */

import { describe, expect, it } from "vitest";
import { mapLinkedToTie } from "./moneyLoader";
import type { MoneyTie } from "./moneyTypes";
import type { ReviewTie } from "./reviewTypes";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";

const COMPANY: KgNodeRow = {
  id: "company:ico:06386237",
  kind: "company",
  label: "RAPAJA s.r.o.",
  props: { ico: "06386237", subsidies_count: 0, subsidies_total_czk: 0 },
  firstSeenPass: 1,
  provenance: {},
} as unknown as KgNodeRow;

const PERSON: KgNodeRow = {
  id: "psp:person:7031",
  kind: "person",
  label: "Testovací Poslanec",
  props: {},
  firstSeenPass: 1,
  provenance: {},
} as unknown as KgNodeRow;

/** An edge carrying every evidence prop the live graph is known to write. */
function edge(props: Record<string, unknown>): KgEdgeRow {
  return {
    src: PERSON.id,
    rel: "linked_to",
    dst: COMPANY.id,
    weight: null,
    props,
    provenance: { pass: 16 },
  } as unknown as KgEdgeRow;
}

const CONTRACTS = { count: 2, czk: 1_000_000, amounts: [600_000, 400_000] };

const FULL_PROPS = {
  role: "jednatel a společník",
  source: "hlidac:osoby/test · „RAPAJA s.r.o.“→IČO 06386237 · 2017-01-01–ongoing",
  tie_class: "owner-operator",
  review_state: "pending_review",
  corroboration: "registry-confirmed",
  corroboration_source: "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/06386237",
  corroboration_provenance: {
    pass: 16,
    method: "verdict",
    ref: "case-money/batch-002 · ARES VR full-population reconciliation (deterministic)",
    computedAt: "2026-07-24T18:44:54.334Z",
  },
  reviewer_note: "ARES VR: jednatel/společník 2017-08-29→trvá (25% podíl) · peníze: current",
  review_note: "doplnit výpis podílů",
  last_decision: "needs-more",
  last_reviewer: "recenzent",
  last_reviewed_at: "2026-07-30T09:00:00.000Z",
  owner_stake_pct: 25,
  prior_term: "2005-04-15..2011-02-21",
  false_edge_suspected: true,
  flags: ["stale-ongoing-in-graph", "sonnet-reviewed"],
  role_valid_from: "2017-08-29",
  role_valid_to: null,
  temporal_status: "current",
};

describe("mapLinkedToTie — the one tie projection", () => {
  const tie = mapLinkedToTie({
    edge: edge(FULL_PROPS),
    company: COMPANY,
    contracts: CONTRACTS,
    person: PERSON,
  });

  it("reads the evidence the edge carries — all of it, not a subset", () => {
    expect(tie.flags).toEqual(["stale-ongoing-in-graph", "sonnet-reviewed"]);
    expect(tie.reviewerNote).toBe(FULL_PROPS.reviewer_note);
    expect(tie.reviewNote).toBe("doplnit výpis podílů");
    expect(tie.lastDecision).toBe("needs-more");
    expect(tie.lastReviewer).toBe("recenzent");
    expect(tie.lastReviewedAt).toBe("2026-07-30T09:00:00.000Z");
    expect(tie.ownerStakePct).toBe(25);
    expect(tie.priorTerm).toBe("2005-04-15..2011-02-21");
    expect(tie.falseEdgeSuspected).toBe(true);
    expect(tie.corroboration).toBe("registry-confirmed");
  });

  it("carries the registry document and the note's own date and pass", () => {
    expect(tie.corroborationSource).toBe(FULL_PROPS.corroboration_source);
    expect(tie.corroborationProvenance).toEqual({
      pass: 16,
      method: "verdict",
      ref: FULL_PROPS.corroboration_provenance.ref,
      computedAt: "2026-07-24T18:44:54.334Z",
    });
  });

  it("says a field is absent instead of fabricating a zero or an empty string", () => {
    const bare = mapLinkedToTie({
      edge: edge({ role: "jednatel", source: "x · 2017-01-01–ongoing", review_state: "pending_review" }),
      company: COMPANY,
      contracts: CONTRACTS,
      person: PERSON,
    });
    expect(bare.reviewerNote).toBeNull();
    expect(bare.reviewNote).toBeNull();
    expect(bare.lastDecision).toBeNull();
    expect(bare.ownerStakePct).toBeNull(); // NOT 0 — "no stake recorded" ≠ "0 % stake"
    expect(bare.priorTerm).toBeNull();
    expect(bare.corroborationSource).toBeNull();
    expect(bare.corroborationProvenance).toEqual({ pass: null, method: null, ref: null, computedAt: null });
    expect(bare.flags).toEqual([]);
    expect(bare.falseEdgeSuspected).toBe(false);
  });

  it("keeps the review-order origin so a recomputed sort key can be disclosed", () => {
    // Nothing stored → derived; the console reports the recomputed count rather than
    // mixing two vintages of one sort key in one queue.
    expect(tie.reviewOrderOrigin).toBe("derived");
    const stored = mapLinkedToTie({
      // A pass-24 rank computed before the contract re-ingest: it no longer matches the
      // tie in front of the reader (153 of 208 stored ranks are in this state live).
      edge: edge({ ...FULL_PROPS, review_tier: 0, review_rank: 999_883_177_548.09 }),
      company: COMPANY,
      contracts: CONTRACTS,
      person: PERSON,
    });
    expect(stored.reviewOrderOrigin).toBe("stale-recomputed");
  });

  it("is a SUPERSET as seen by the console — no public field hidden from the decider", () => {
    // Compile-time half of the invariant: a ReviewTie is assignable to MoneyTie, so the
    // console can never again project fewer evidence fields than /penize/[pspId].
    const asReview = { ...tie, id: "tie:7031:06386237", src: PERSON.id, dst: COMPANY.id, pspId: 7031, mpName: "Testovací Poslanec", club: null, absenteeManagerLead: false, periodFrom: "2017-01-01", periodTo: null, links: { aresSubject: "", aresVr: "", justiceVr: "", hlidacSubjekt: "", hlidacPerson: null, registrSmluv: "" }, gate: null } satisfies ReviewTie;
    const backToMoney: MoneyTie = asReview;
    // Runtime half: every key of the shared projection survives the console's spread.
    for (const key of Object.keys(tie)) {
      expect(backToMoney, key).toHaveProperty(key);
    }
  });
});
