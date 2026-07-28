// Politika čerstvosti se deklaruje na dvou místech, protože Next chce v route
// segmentu literál. Tenhle test je jediné, co brání tomu, aby se rozešla.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DASHBOARD_REVALIDATE_HOURS,
  DASHBOARD_REVALIDATE_SECONDS,
  MONEY_MEMO_TTL_MS,
} from "./freshness";

describe("politika čerstvosti velínu", () => {
  it("app/dashboard/page.tsx deklaruje TÉŽ okno revalidace", () => {
    const src = readFileSync("app/dashboard/page.tsx", "utf8");
    const m = src.match(/export const revalidate = ([\d_]+);/);
    expect(m, "app/dashboard/page.tsx neexportuje `revalidate`").not.toBeNull();
    expect(Number(m![1].replace(/_/g, ""))).toBe(DASHBOARD_REVALIDATE_SECONDS);
  });

  it("memo peněžní vrstvy nepřežije okno revalidace", () => {
    // Delší memo = přegenerovaná stránka se starými čísly pod novým datem.
    expect(MONEY_MEMO_TTL_MS).toBeLessThanOrEqual(DASHBOARD_REVALIDATE_SECONDS * 1000);
  });

  it("okno se dá vyslovit v celých hodinách (jde na plochu)", () => {
    expect(Number.isInteger(DASHBOARD_REVALIDATE_HOURS)).toBe(true);
  });
});
