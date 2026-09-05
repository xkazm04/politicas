import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));
import { corpusName, datasetUrn, PLATFORM } from "@/lib/analysis/context-model";

describe("both DataHub scripts spell urns and aspects once (2026-09-06, parity-auditor)", () => {
  it("kg-datahub-sync no longer carries its own PLATFORM / clean / datasetUrn / corpusName", () => {
    // Its header promises to „reference the SAME corpus dataset urns datahub-sync.ts
    // publishes, so lineage joins up" — with a local copy of each helper, that promise
    // held only while nobody edited either side.
    const src = read("scripts/data-analysis/kg-datahub-sync.ts");
    expect(src).not.toMatch(/urn:li:dataPlatform:politicas/);
    expect(src).not.toMatch(/const clean = /);
    expect(src).toMatch(/from "@\/lib\/analysis\/context-model"/);
    expect(src).toMatch(/from "\.\/datahubAspects"/);
  });

  it("the aspect envelope helpers are defined once, in datahubAspects.ts", () => {
    for (const f of ["scripts/data-analysis/datahub-sync.ts", "scripts/data-analysis/kg-datahub-sync.ts"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/const envelope = /);
      expect(src, f).not.toMatch(/function schemaOf\(/);
      expect(src, f).not.toMatch(/async function post\(/);
    }
    expect(read("scripts/data-analysis/datahubAspects.ts")).toMatch(/export async function postAspects\(/);
  });

  it("the shared model's corpus urn is what kg-datahub-sync used to build by hand", () => {
    expect(datasetUrn(corpusName("psp-hlasovani", "vote_ballot"), "PROD")).toBe(`urn:li:dataset:(${PLATFORM},corpus.psp_hlasovani.vote_ballot,PROD)`);
  });
});
