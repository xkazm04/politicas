import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repairTornTail } from "./harvestJsonlTail";

const parseAll = (raw: string) =>
  raw.split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l) as { id: string }); // persist-contract-harvest's read

const dir = () => mkdtempSync(join(tmpdir(), "harvest-tail-"));
const row = (id: string) => JSON.stringify({ id, _month: "2026-01" }) + "\n";

describe("repairTornTail", () => {
  it("A: without repair, the next append fuses onto a torn line and the parse throws", () => {
    const p = join(dir(), "h.jsonl");
    writeFileSync(p, row("a") + '{"id":"b","_mo');
    writeFileSync(p, readFileSync(p, "utf8") + row("c"));
    expect(() => parseAll(readFileSync(p, "utf8"))).toThrow();
  });

  it("B: repair drops only the unterminated fragment, so the resumed append parses", async () => {
    const p = join(dir(), "h.jsonl");
    writeFileSync(p, row("a") + '{"id":"b","_mo');
    expect(await repairTornTail(p)).toBe('{"id":"b","_mo'.length);
    writeFileSync(p, readFileSync(p, "utf8") + row("c"));
    expect(parseAll(readFileSync(p, "utf8")).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("leaves a clean, empty or absent file alone", async () => {
    const d = dir();
    const clean = join(d, "c.jsonl");
    writeFileSync(clean, row("a"));
    expect(await repairTornTail(clean)).toBe(0);
    const empty = join(d, "e.jsonl");
    writeFileSync(empty, "");
    expect(await repairTornTail(empty)).toBe(0);
    expect(await repairTornTail(join(d, "none.jsonl"))).toBe(0);
    expect(readFileSync(clean, "utf8")).toBe(row("a"));
  });

  it("a fragment longer than one read block and a file that is only a fragment", async () => {
    const d = dir();
    const long = join(d, "l.jsonl");
    const frag = "x".repeat(200_000);
    writeFileSync(long, row("a") + frag);
    expect(await repairTornTail(long)).toBe(frag.length);
    expect(readFileSync(long, "utf8")).toBe(row("a"));
    const only = join(d, "o.jsonl");
    writeFileSync(only, '{"id":');
    expect(await repairTornTail(only)).toBe(6);
    expect(readFileSync(only, "utf8")).toBe("");
  });

  it("keeps a multibyte record intact when cutting at the boundary", async () => {
    const p = join(d2(), "m.jsonl");
    writeFileSync(p, row("Šíleně žluťoučký") + "{\"id\":\"ů");
    await repairTornTail(p);
    expect(parseAll(readFileSync(p, "utf8"))[0].id).toBe("Šíleně žluťoučký");
  });
});
function d2() { return dir(); }
