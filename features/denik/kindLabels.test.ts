// Deník republiky — slovník druhů zápisu je DATA a testuje se jako data:
// úplnost (žádný druh bez názvu), jazyková brána, a pravidlo o neznámém druhu.

import { describe, expect, it } from "vitest";
import { czechGateErrors } from "@/lib/analysis/language-gate";
import { DENIK_KIND_LABELS, denikKindLabel, TIME_BASIS_TITLE } from "./kindLabels";
import { DENIK_CHANGE_TYPES } from "./deriveDenik";

describe("slovník druhů", () => {
  it("každý druh má český název a žádný nevypadá jako strojový token", () => {
    for (const [kind, label] of Object.entries(DENIK_KIND_LABELS)) {
      expect(label.length).toBeGreaterThan(3);
      expect(label).not.toBe(kind);
      // Žádné camelCase: název je česká fráze, ne token (vlastní jméno Sbírky
      // smí mít velké písmeno uvnitř, ale slovo nikdy nezačíná verzálkou).
      expect(label).toMatch(/^[a-záčďéěíňóřšťúůýž]/);
      expect(label).not.toMatch(/[a-z][A-Z]/);
    }
  });

  it("mandátové a orgánové proudy mají vlastní název, ne „zápis do grafu“", () => {
    // Devět change typů, tři druhy — a zánik mandátu se nesmí schovat pod
    // technickou událost úložiště.
    expect(DENIK_CHANGE_TYPES.length).toBe(9);
    expect(DENIK_KIND_LABELS.mandate).not.toBe(DENIK_KIND_LABELS.change);
    expect(DENIK_KIND_LABELS.organRole).not.toBe(DENIK_KIND_LABELS.change);
    expect(DENIK_KIND_LABELS.organRole).not.toBe(DENIK_KIND_LABELS.roleStart);
  });

  it("neznámý druh se vypíše DOSLOVA a označí jako nepřeložený — nikdy nezmizí", () => {
    expect(denikKindLabel("contract")).toEqual({ text: "smlouva", translated: true });
    expect(denikKindLabel("budouciDruh")).toEqual({ text: "budouciDruh", translated: false });
  });

  it("názvy i výklad obou časových os projdou českou jazykovou branou", () => {
    const fields = [
      ...Object.entries(DENIK_KIND_LABELS).map(([label, text]) => ({ label, text })),
      { label: "ucinne", text: TIME_BASIS_TITLE.ucinne },
      { label: "zaznamenano", text: TIME_BASIS_TITLE.zaznamenano },
    ];
    expect(czechGateErrors(fields)).toEqual([]);
  });

  it("výklad časové osy je věta, ne opakování štítku", () => {
    expect(TIME_BASIS_TITLE.ucinne).toContain("stala");
    expect(TIME_BASIS_TITLE.zaznamenano).toContain("vstoupil do záznamu");
  });
});
