import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));

const DATAOR = read("lib/ingest/sources/dataor.ts");

describe("dataor has one read path — the streaming one (2026-09-06, tech-debt-tracker)", () => {
  it("no whole-file fetch/read of a dataset survives beside the streaming finder", () => {
    // `fetchDatasetCsv` read a whole dataset into one V8 string (capped at ~512 MiB, so
    // sro-full-praha at 2 452 MB threw "Invalid string length" — the module's own header
    // records it) and `findRecordByIcoInCsvText` scanned that string. Zero consumers of
    // either outside this module (grep 2026-09-06; one script COMMENT names the former).
    expect(DATAOR).not.toMatch(/export async function fetchDatasetCsv/);
    expect(DATAOR).not.toMatch(/export function findRecordByIcoInCsvText/);
    expect(DATAOR).not.toMatch(/gunzipSync/);
    expect(DATAOR).not.toMatch(/fs\.readFile\(cachePath/);
    expect(DATAOR).toMatch(/export async function findRecordsByIcosInFile/);
  });
});
