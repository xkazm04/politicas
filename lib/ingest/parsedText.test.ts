import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  currentParserStamp,
  deleteParsedText,
  parsedTextPath,
  readOrExtractText,
  SIDECAR_FORMAT,
} from "@/lib/ingest/parsedText";

// No PDF fixture and no unpdf here on purpose: the sidecar contract is about WHEN the
// extractor runs, not about what it returns, and this lane budgets 5 s per test.
const BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // "%PDF-1.7"

let dir: string;
let pdf: string;
let warn: (m: string) => void;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "parsed-text-"));
  pdf = join(dir, "likv.pdf");
  await writeFile(pdf, BYTES);
  warn = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readOrExtractText", () => {
  it("parses once, then a re-ingest hits the sidecar and never calls the extractor", async () => {
    const extract = vi.fn(async () => "Usnesení …");

    const first = await readOrExtractText(pdf, BYTES, { extract, parser: "unpdf@1.8.1", warn });
    expect(first).toEqual({ text: "Usnesení …", source: "parsed" });
    expect(extract).toHaveBeenCalledTimes(1);

    const sidecar = await readFile(parsedTextPath(pdf), "utf8");
    expect(sidecar.split("\n")[0]).toMatch(new RegExp(`^#${SIDECAR_FORMAT} unpdf@1\\.8\\.1 sha256:[0-9a-f]{16}$`));

    const second = await readOrExtractText(pdf, BYTES, { extract, parser: "unpdf@1.8.1", warn });
    expect(second).toEqual({ text: "Usnesení …", source: "sidecar" });
    expect(extract).toHaveBeenCalledTimes(1); // the measurable: zero parses on the warm run
    expect(warn).not.toHaveBeenCalled();
  });

  it("misses loudly on a parser-version change and re-stamps at the new version", async () => {
    const extract = vi.fn(async () => "old text");
    await readOrExtractText(pdf, BYTES, { extract, parser: "unpdf@1.8.1", warn });

    const bumped = vi.fn(async () => "new text");
    const after = await readOrExtractText(pdf, BYTES, { extract: bumped, parser: "unpdf@2.0.0", warn });

    expect(after).toEqual({ text: "new text", source: "parsed" });
    expect(bumped).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unpdf@1.8.1"));
    expect(await readFile(parsedTextPath(pdf), "utf8")).toContain("unpdf@2.0.0");
  });

  it("refuses an unstamped sidecar rather than silently reusing it", async () => {
    await writeFile(parsedTextPath(pdf), "bare text with no stamp\n");
    const extract = vi.fn(async () => "re-parsed");

    const result = await readOrExtractText(pdf, BYTES, { extract, parser: "unpdf@1.8.1", warn });

    expect(result.source).toBe("parsed");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("misses when the same filename carries different bytes", async () => {
    const extract = vi.fn(async () => "a");
    await readOrExtractText(pdf, BYTES, { extract, parser: "unpdf@1.8.1", warn });

    const other = await readOrExtractText(pdf, new Uint8Array([1, 2, 3]), { extract, parser: "unpdf@1.8.1", warn });
    expect(other.source).toBe("parsed");
  });

  it("disables the sidecar entirely when the parser version is unreadable", async () => {
    const extract = vi.fn(async () => "text");
    const result = await readOrExtractText(pdf, BYTES, { extract, parser: null, warn });

    expect(result.source).toBe("parsed");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("sidecar disabled"));
    await expect(readFile(parsedTextPath(pdf), "utf8")).rejects.toThrow();
  });

  it("--reparse overrides a valid sidecar", async () => {
    const extract = vi.fn(async () => "text");
    await readOrExtractText(pdf, BYTES, { extract, parser: "unpdf@1.8.1", warn });
    const forced = await readOrExtractText(pdf, BYTES, { extract, parser: "unpdf@1.8.1", warn, reparse: true });
    expect(forced.source).toBe("parsed");
    expect(extract).toHaveBeenCalledTimes(2);
  });

  it("deleteParsedText reaps the sidecar and tolerates an absent one", async () => {
    const extract = vi.fn(async () => "text");
    await readOrExtractText(pdf, BYTES, { extract, parser: "unpdf@1.8.1", warn });
    await deleteParsedText(pdf);
    await expect(readFile(parsedTextPath(pdf), "utf8")).rejects.toThrow();
    await expect(deleteParsedText(pdf)).resolves.toBeUndefined();
  });
});

describe("currentParserStamp", () => {
  it("reads the installed unpdf version so the guard is decidable", () => {
    expect(currentParserStamp()).toMatch(/^unpdf@\d+\.\d+\.\d+/);
  });
});
