import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));
import { COURT_CODE_TO_SLUG, KRAJ_CODE_TO_COURT_SLUG } from "./dataor";

const DATAOR = read("lib/ingest/sources/dataor.ts");

describe("KRAJ_CODE_TO_COURT_SLUG states its values in the literal (2026-09-06, documentation-auditor)", () => {
  it("Karlovarský (41) resolves to the Plzeň registry court", () => {
    expect(KRAJ_CODE_TO_COURT_SLUG[41]).toBe("plzen");
  });

  it("no post-literal override rewrites a table entry", () => {
    // The literal carried `41: "usti_nad_labem"` with a comment calling itself wrong, and a
    // statement fifteen lines later overwrote it. A reader of the table read a false fact.
    expect(DATAOR).not.toMatch(/KRAJ_CODE_TO_COURT_SLUG\[\d+\]\s*=/);
  });

  it("every kraj resolves to a court slug the spisová-značka table also knows", () => {
    const known = new Set(Object.values(COURT_CODE_TO_SLUG));
    for (const [kraj, slug] of Object.entries(KRAJ_CODE_TO_COURT_SLUG)) expect(known.has(slug), `kraj ${kraj} → ${slug}`).toBe(true);
  });
});
