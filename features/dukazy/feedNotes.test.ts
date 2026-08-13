// Upozornění v popisu kanálu věstníku brány.
//
// Dvě věci, které se tady připíchávají: (1) sdílená klauzule o stropu odečtu se
// SKUTEČNĚ skládá sesterským `denikFeedNotice` a adaptér z nul žádnou vlastní
// větu nevyrobí; (2) mlčení znamená „nic se neztratilo", ne „nevíme".

import { describe, expect, it } from "vitest";
import { denikFeedNotice } from "@/features/denik/feedNotes";
import { dukazyFeedNotice } from "./feedNotes";
import type { DukazyLimits } from "./getDukazyData";

const limits = (over: Partial<DukazyLimits> = {}): DukazyLimits => ({
  auditTruncated: false,
  auditCap: 10_000,
  withheld: { total: 0, byState: [] },
  forensicRead: true,
  tieSourcesRead: true,
  labelsRead: true,
  ...over,
});

describe("dukazyFeedNotice — mlčení je závěr, ne mezera", () => {
  it("zdravé vydání nemá o čem upozorňovat", () => {
    expect(dukazyFeedNotice(limits())).toBeNull();
  });
});

describe("dukazyFeedNotice — strop odečtu se NEPÍŠE PODRUHÉ", () => {
  it("klauzuli o stropu brány skládá sesterský denikFeedNotice, doslova", () => {
    const l = limits({ auditTruncated: true });
    const notice = dukazyFeedNotice(l);
    expect(notice).not.toBeNull();
    // Adaptér plní deníkova měřidla jedinou hodnotou, kterou /dukazy provozuje —
    // výstup proto MUSÍ být totožný s tím, co by deník řekl o témže odečtu.
    const shared = denikFeedNotice(null, {
      contractCompanies: 0,
      companyCap: 0,
      companiesOverCap: 0,
      edgeCap: 0,
      companiesEdgeTruncated: 0,
      malformedIco: 0,
      changesFromGate: 0,
      changesUndisplayable: 0,
      auditCap: l.auditCap,
      auditTruncated: true,
      changeCap: 0,
      changesRead: 0,
      changesTruncated: false,
    });
    expect(shared).not.toBeNull();
    expect(notice).toBe(shared);
  });

  it("adaptér z nul NEVYROBÍ žádnou cizí větu (jediný kanál je strop brány)", () => {
    // Kdyby některá nula uměla klauzuli vyrobit, věstník by odběrateli tvrdil
    // ztrátu z čtení, které vůbec neprovozuje.
    expect(dukazyFeedNotice(limits({ auditTruncated: false }))).toBeNull();
  });
});

describe("dukazyFeedNotice — co má věstník navíc", () => {
  it("frontu posudků jmenuje počtem i verbatim stavem", () => {
    const notice = dukazyFeedNotice(
      limits({ withheld: { total: 141, byState: [{ state: "pending_review", count: 141 }] } }),
    );
    expect(notice).toContain("141");
    expect(notice).toContain("pending_review");
    expect(notice).toContain("nenese");
  });

  it("každá nečitelná vrstva má vlastní klauzuli", () => {
    expect(dukazyFeedNotice(limits({ forensicRead: false }))).toContain("bill.forensic_*");
    expect(dukazyFeedNotice(limits({ tieSourcesRead: false }))).toContain("kg_edge linked_to");
    expect(dukazyFeedNotice(limits({ labelsRead: false }))).toContain("urnami");
  });

  it("strop i vlastní ztráty se vysloví OBOJÍ, ne jen jedno", () => {
    const notice = dukazyFeedNotice(
      limits({
        auditTruncated: true,
        forensicRead: false,
        withheld: { total: 3, byState: [{ state: "pending_review", count: 3 }] },
      }),
    );
    expect(notice).toContain("stropu");
    expect(notice).toContain("Tenhle výpis dál nenese");
  });
});
