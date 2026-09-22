import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));

// Five kg writers each carried a byte-identical `getDump` (cache dir, base URL,
// user-agent, 180 s timeout, warn-and-null) — one rule, five copies, and one of them
// already differed in what it logged on a non-ok status. kg-bill-roles-ingest also
// carried a fourth copy of the UNL member reader lib/ingest/unlMembers.ts centralised
// on 2026-09-06 (scan-sweep, parity-auditor).

const WRITERS = [
  "scripts/data-analysis/kg-contribution-ingest.ts",
  "scripts/data-analysis/kg-legislation-ingest.ts",
  "scripts/data-analysis/kg-bill-roles-ingest.ts",
  "scripts/data-analysis/kg-bill-engagement-ingest.ts",
  "scripts/data-analysis/kg-committee-routing.ts",
];

describe("the kg writers read psp.cz dumps through one helper (2026-09-06, parity-auditor)", () => {
  for (const file of WRITERS) {
    it(`${file} imports getDump from ./pspDump and defines none of its own`, () => {
      const src = read(file);
      expect(src).not.toMatch(/async function getDump\(/);
      expect(src).not.toMatch(/const PSP_BASE = /);
      expect(src).toMatch(/import \{ getDump \} from "\.\/pspDump"/);
    });
  }

  it("kg-bill-roles-ingest reads UNL members through lib/ingest/unlMembers, not a local copy", () => {
    const src = read("scripts/data-analysis/kg-bill-roles-ingest.ts");
    expect(src).not.toMatch(/const unlOf = /);
    expect(src).toMatch(/import \{ unlOf \} from "@\/lib\/ingest\/unlMembers"/);
  });

  it("pspDump.ts is the one definition (ingest.ts keeps its metadata-recording variant)", () => {
    expect(read("scripts/data-analysis/pspDump.ts")).toMatch(/export async function getDump\(/);
    expect(read("scripts/data-analysis/ingest.ts")).toMatch(/async function getDump\(fileName: string, refetch: boolean\): Promise<Dump>/);
  });
});
