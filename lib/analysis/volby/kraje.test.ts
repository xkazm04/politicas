import { describe, expect, it } from "vitest";
import { KRAJE } from "@/features/budget/data/registryData.generated";
import { krajSlug } from "@/features/civicscore/kraj";
import { VOLKRAJ_NAME } from "@/lib/ingest/sources/volby";
import {
  KRAJ_CROSSWALK,
  krajByIco,
  krajByNuts,
  krajByPspLabel,
  krajBySlug,
  krajByVolkraj,
  regionLabelFromPspName,
} from "./kraje";

const unique = <T>(xs: readonly T[]) => new Set(xs).size === xs.length;

describe("KRAJ_CROSSWALK", () => {
  it("has 14 rows with unique slug, NUTS, VOLKRAJ and kraj IČO", () => {
    expect(KRAJ_CROSSWALK).toHaveLength(14);
    expect(unique(KRAJ_CROSSWALK.map((k) => k.slug))).toBe(true);
    expect(unique(KRAJ_CROSSWALK.map((k) => k.nuts))).toBe(true);
    expect(unique(KRAJ_CROSSWALK.map((k) => k.volkraj))).toBe(true);
    expect(unique(KRAJ_CROSSWALK.map((k) => k.krajIco))).toBe(true);
    expect(unique(KRAJ_CROSSWALK.map((k) => k.pspLabel))).toBe(true);
    for (const k of KRAJ_CROSSWALK) expect(k.krajIco).toMatch(/^\d{8}$/);
  });

  it("slug = krajSlug(regionLabel(pspLabel)) — the /kraj/[kraj] address", () => {
    for (const k of KRAJ_CROSSWALK) expect(k.slug).toBe(krajSlug(regionLabelFromPspName(k.pspLabel)));
    expect(krajBySlug("praha")?.pspLabel).toBe("Hlavní město Praha");
    expect(krajBySlug("stredocesky")?.nuts).toBe("CZ020");
    expect(krajBySlug("vysocina")?.volkraj).toBe(10);
    expect(krajBySlug("jihomoravsky")?.krajIco).toBe("70888337");
  });

  it("regionLabelFromPspName mirrors the leaderboard's three shapes", () => {
    expect(regionLabelFromPspName("Hlavní město Praha")).toBe("Praha");
    expect(regionLabelFromPspName("Vysočina")).toBe("Vysočina");
    expect(regionLabelFromPspName("Zlínský")).toBe("Zlínský kraj");
  });

  it("VOLKRAJ codes and labels match lib/ingest/sources/volby.ts exactly", () => {
    for (const k of KRAJ_CROSSWALK) expect(VOLKRAJ_NAME[k.volkraj]).toBe(k.pspLabel);
    expect(Object.keys(VOLKRAJ_NAME)).toHaveLength(14);
  });

  it("NUTS codes are exactly the MONITOR KRAJE set", () => {
    expect(new Set(KRAJ_CROSSWALK.map((k) => k.nuts))).toEqual(new Set(KRAJE.map((k) => k.nuts)));
    for (const k of KRAJ_CROSSWALK) expect(krajByNuts(k.nuts)?.slug).toBe(k.slug);
  });

  it("lookups return null for unknown keys", () => {
    expect(krajBySlug("neuveden")).toBeNull();
    expect(krajByPspLabel("Praha")).toBeNull();
    expect(krajByNuts("CZ000")).toBeNull();
    expect(krajByVolkraj(15)).toBeNull();
    expect(krajByIco("00000000")).toBeNull();
    expect(krajByPspLabel("Vysočina")?.slug).toBe("vysocina");
    expect(krajByVolkraj(1)?.slug).toBe("praha");
    expect(krajByIco("00064581")?.slug).toBe("praha");
  });
});
