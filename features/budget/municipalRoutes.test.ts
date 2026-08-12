/*
 * Seznam trvalých adres obcí — JEDEN pro build (`generateStaticParams`) i pro
 * sitemapu. Tenhle test hlídá to jediné, co u sitemapy skutečně bolí: nabídnout
 * robotovi adresu, která odpoví 404, nebo nabídnout pokaždé jiné pořadí.
 */

import { describe, expect, it } from "vitest";

import { getMunicipality } from "./mirrorData";
import { municipalRouteIcos, municipalRoutePath } from "./municipalRoutes";

describe("municipalRouteIcos", () => {
  const icos = municipalRouteIcos();

  it("kotevní kontrola — seznam není prázdný", () => {
    expect(icos.length).toBeGreaterThan(100);
  });

  it("každé IČO zná rejstřík obcí (jinak by sitemapa zvala na 404)", () => {
    expect(icos.filter((ico) => getMunicipality(ico) === null)).toEqual([]);
  });

  it("je deterministický a bez duplicit", () => {
    expect(icos).toEqual([...icos].sort());
    expect(new Set(icos).size).toBe(icos.length);
    expect(municipalRouteIcos()).toEqual(icos);
  });

  it("nese kanonické osmimístné IČO", () => {
    for (const ico of icos) expect(ico, ico).toMatch(/^\d{8}$/);
  });

  it("cesta má tvar, na který je routa /rozpocty/[ico] napsaná", () => {
    expect(municipalRoutePath("00064581")).toBe("/rozpocty/00064581");
  });
});
