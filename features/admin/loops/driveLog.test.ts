// IO test akčního žurnálu (6E) — skutečný soubor v temp adresáři přes
// LOOP_DRIVE_PATH: append → read round-trip, řetěz drží, nic se nemaže.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "politicas-drivelog-"));
process.env.LOOP_DRIVE_PATH = join(dir, "loop-drive.jsonl");

// Env se musí nastavit PŘED importem modulu, který cestu čte za běhu.
const { appendDriveEntry, readDriveLog } = await import("./driveLog");

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("driveLog — souborový okraj", () => {
  it("prázdný žurnál čte jako prázdný stav s platným řetězem", () => {
    const read = readDriveLog();
    expect(read.entries).toEqual([]);
    expect(read.chain.ok).toBe(true);
    expect(read.state.pending).toEqual([]);
  });

  it("append → read: záznamy na disku, řetěz sedí, fronta odvozená", () => {
    const a = appendDriveEntry({ actor: "operátor (ADMIN_TOKEN)", action: "requeue", target: "case:money", note: "po selhání" });
    const b = appendDriveEntry({ actor: "operátor (ADMIN_TOKEN)", action: "requeue", target: "case:law", note: null });
    expect(a.ok && b.ok).toBe(true);

    const read = readDriveLog();
    expect(read.entries).toHaveLength(2);
    expect(read.chain.ok).toBe(true);
    expect(read.state.pending.map((p) => p.target)).toEqual(["case:money", "case:law"]);

    // Soubor je opravdu append-only JSONL: dva řádky, každý validní JSON.
    const lines = readFileSync(process.env.LOOP_DRIVE_PATH!, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(() => lines.map((l) => JSON.parse(l))).not.toThrow();
  });

  it("resolve nic nemaže — soubor roste, fronta se zmenšuje", () => {
    const first = readDriveLog().state.pending[0];
    const res = appendDriveEntry({ actor: "operátor (ADMIN_TOKEN)", action: "resolve", target: String(first.seq), note: null });
    expect(res.ok).toBe(true);
    const read = readDriveLog();
    expect(read.entries).toHaveLength(3); // žurnál drží všechno
    expect(read.state.pending.map((p) => p.target)).toEqual(["case:law"]);
    expect(read.state.resolvedCount).toBe(1);
  });
});
