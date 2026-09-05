import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* The collision scripts share their text pipeline and extractors with the census by IMPORT,
 * not by copy. collision-core.ts was extracted in batch-009 for exactly this reason and the live
 * collision-check.ts still carried its own byte copies of everything (pre-NFC pipeline included).
 * Source grep, no jsdom — the same instrument as the round's other parity tests. */

const check = readFileSync("scripts/case-loops/law/collision-check.ts", "utf8");

const verify = readFileSync("scripts/case-loops/law/verify-close-reads.ts", "utf8");

describe("verify-close-reads.ts — the cache is read through collision-core", () => {
  it("calls readCachedBillText and carries no cache path or readdir of its own", () => {
    expect(verify).toMatch(/import \{ readCachedBillText \} from "\.\/collision-core"/);
    expect(verify).toMatch(/readCachedBillText\(cislo\)/);
    expect(verify).not.toMatch(/^const CACHE = /m); // the path is named in prose only
    expect(verify).not.toMatch(/readdirSync\(dir\)/);
  });
});

describe("collision-check.ts — one definition each", () => {
  it("imports the tisk pipeline from tiskText.ts and defines none of it locally", () => {
    expect(check).toMatch(/from "\.\/tiskText"/);
    for (const fn of ["fetchWithRetry", "parseIndex", "fetchIndexHtml", "fetchPdf", "extractText"]) {
      expect(check, fn).not.toMatch(new RegExp(`^(async )?function ${fn}\\b`, "m"));
    }
    expect(check).not.toMatch(/^const CACHE_DIR = /m);
    expect(check).not.toMatch(/^const PDFTOTEXT_BIN = /m);
  });

  it("imports the §-extractors from collision-core.ts and defines none of them locally", () => {
    expect(check).toMatch(/from "\.\/collision-core"/);
    for (const fn of ["extractParagraphs", "partitionParagraphsByStatute"]) {
      expect(check, fn).not.toMatch(new RegExp(`^function ${fn}\\b`, "m"));
    }
    expect(check).not.toMatch(/^interface StatutePartition\b/m);
  });
});
