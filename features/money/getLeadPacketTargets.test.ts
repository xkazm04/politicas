// Join kauza → poslanec (/penize/kauzy, tlačítko „sestavit důkazní paket").
//
// Spis nese IČO jako RUČNÍ ZÁPIS, graf klíčuje firmu na osmimístný tvar
// (memory/ico-node-id-canonical-form.md). Nekanonizovaný segment tu vyráběl
// TICHÝ FALEŠNÝ ZÁPOR: `company:ico:2867681` v grafu není, kgNeighbours vrátí
// prázdno a kauza mlčky přijde o odkaz — k nerozeznání od „na tu firmu žádný
// poslanec navázaný není". Tenhle test kontroluje, na jaké id se loader ptá.

import { beforeEach, describe, expect, it, vi } from "vitest";

const kgNeighbours = vi.fn();

vi.mock("@/lib/db/store", () => ({
  getStore: async () => ({ kgNeighbours }),
}));
vi.mock("@/lib/db/readiness", () => ({
  storeReady: async () => true,
}));

const { getLeadPacketTargets } = await import("./getLeadPacketTargets");

const oneTie = (companyId: string) => ({
  nodes: [{ id: "psp:person:6105", label: "Tomio Okamura" }],
  edges: [{ src: "psp:person:6105", rel: "linked_to", dst: companyId }],
});

describe("getLeadPacketTargets — adresa firmy v grafu", () => {
  beforeEach(() => kgNeighbours.mockReset());

  it("sedmimístné IČO ze spisu se doplní na kanonický osmimístný uzel", async () => {
    kgNeighbours.mockResolvedValue(oneTie("company:ico:02867681"));
    const out = await getLeadPacketTargets(["2867681"]);
    expect(kgNeighbours).toHaveBeenCalledTimes(1);
    expect(kgNeighbours.mock.calls[0][0].id).toBe("company:ico:02867681");
    // klíč zůstává ten, který nese SPIS — plocha se ptá jeho vlastním IČEM
    expect(out["2867681"]).toEqual([{ pspId: 6105, name: "Tomio Okamura" }]);
  });

  it("už kanonické IČO se nemění", async () => {
    kgNeighbours.mockResolvedValue(oneTie("company:ico:27145433"));
    await getLeadPacketTargets(["27145433"]);
    expect(kgNeighbours.mock.calls[0][0].id).toBe("company:ico:27145433");
  });

  it("segment, který IČO být nemůže, se přeskočí — nikdy „neopraví“ a nikdy nečte", async () => {
    const out = await getLeadPacketTargets(["nefirma", "123456789"]);
    expect(kgNeighbours).not.toHaveBeenCalled();
    expect(out).toEqual({});
  });

  it("firma bez linked_to hrany odkaz nedostane (drop-don't-guess)", async () => {
    kgNeighbours.mockResolvedValue({ nodes: [], edges: [] });
    expect(await getLeadPacketTargets(["27145433"])).toEqual({});
  });
});
