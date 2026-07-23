import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readZip, readZipMap } from "./zip";

/**
 * Build a minimal but real ZIP archive in memory (local headers + central
 * directory + EOCD) so the reader is exercised against the actual byte format,
 * not a mock. Supports method 0 (stored) and 8 (deflate).
 */
function buildZip(entries: { name: string; data: Buffer; deflate?: boolean }[]): Uint8Array {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const method = e.deflate ? 8 : 0;
    const stored = e.deflate ? deflateRawSync(e.data) : e.data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(0, 14); // crc (unchecked by the reader)
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    chunks.push(local, nameBuf, stored);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(method, 10);
    cen.writeUInt32LE(stored.length, 20);
    cen.writeUInt32LE(e.data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + stored.length;
  }
  const centralBuf = Buffer.concat(central);
  const centralOffset = offset;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  return new Uint8Array(Buffer.concat([...chunks, centralBuf, eocd]));
}

describe("readZip", () => {
  it("reads a stored (uncompressed) member", () => {
    const zip = buildZip([{ name: "a.unl", data: Buffer.from("1|x|\n") }]);
    const entries = readZip(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("a.unl");
    expect(Buffer.from(entries[0].bytes).toString()).toBe("1|x|\n");
  });

  it("inflates a deflated member", () => {
    const body = Buffer.from("row|value|\n".repeat(500));
    const zip = buildZip([{ name: "big.unl", data: body, deflate: true }]);
    const entries = readZip(zip);
    expect(Buffer.from(entries[0].bytes).equals(body)).toBe(true);
  });

  it("reads multiple members and indexes them by basename", () => {
    const zip = buildZip([
      { name: "osoby.unl", data: Buffer.from("1|") },
      { name: "organy.unl", data: Buffer.from("2|"), deflate: true },
    ]);
    const map = readZipMap(zip);
    expect([...map.keys()].sort()).toEqual(["organy.unl", "osoby.unl"]);
  });

  it("throws a named error on a non-ZIP input", () => {
    expect(() => readZip(new Uint8Array([1, 2, 3]))).toThrow(/not a ZIP/);
  });
});
