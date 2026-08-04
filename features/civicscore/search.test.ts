import { describe, expect, it } from "vitest";

import { asciiFold } from "@/lib/ingest/normalize";
import { foldQuery, nameMatches } from "./search";

const matches = (name: string, query: string) => nameMatches(asciiFold(name), foldQuery(query));

describe("leaderboard name search", () => {
  it("finds a diacritic name from an ASCII query — the bug this exists for", () => {
    expect(matches("Žáček", "zacek")).toBe(true);
    expect(matches("Řehoř Čížek", "rehor")).toBe(true);
    expect(matches("Nováková", "novakova")).toBe(true);
    expect(matches("Ďurišová", "durisova")).toBe(true);
  });

  it("still finds the same name typed WITH diacritics", () => {
    expect(matches("Žáček", "Žáček")).toBe(true);
    expect(matches("Řehoř Čížek", "Čížek")).toBe(true);
  });

  it("matches on any part of the name, case-insensitively", () => {
    expect(matches("Petra Nováková", "PETRA")).toBe(true);
    expect(matches("Petra Nováková", "ova")).toBe(true);
  });

  it("does not match an unrelated query", () => {
    expect(matches("Žáček", "novak")).toBe(false);
  });

  it("an empty or whitespace-only query matches everything", () => {
    expect(matches("Žáček", "")).toBe(true);
    expect(matches("Žáček", "   ")).toBe(true);
  });

  it("reuses the name_norm folding scheme, so a query folds to what ingest stored", () => {
    // asciiFold() is what fills person.name_norm at ingest (lib/ingest/sources/psp.ts).
    expect(foldQuery("Žáček")).toBe(asciiFold("Žáček"));
    expect(foldQuery("  Řehoř  ")).toBe("rehor");
  });
});
