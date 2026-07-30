import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readZip, readZipMap } from "./zip";

interface FixtureEntry {
  name: string;
  data: Buffer;
  deflate?: boolean;
  /** Override the compression method written to the headers (default 0/8). */
  method?: number;
  /** General-purpose bit flags (bit 0 = encrypted). */
  flags?: number;
  /** Override the compressedSize written to the CENTRAL directory only. */
  centralCompressedSize?: number;
}

/**
 * Build a minimal but real ZIP archive in memory (local headers + central
 * directory + EOCD) so the reader is exercised against the actual byte format,
 * not a mock. Supports method 0 (stored) and 8 (deflate), plus deliberate
 * corruption knobs for the loud-failure tests.
 */
function buildZip(entries: FixtureEntry[]): Uint8Array {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const method = e.method ?? (e.deflate ? 8 : 0);
    const stored = e.deflate ? deflateRawSync(e.data) : e.data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(e.flags ?? 0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(0, 14); // crc (unchecked by the reader)
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    chunks.push(local, nameBuf, stored);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(e.flags ?? 0, 8);
    cen.writeUInt16LE(method, 10);
    cen.writeUInt32LE(e.centralCompressedSize ?? stored.length, 20);
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

  it("lower-cases and strips directories in readZipMap keys", () => {
    const zip = buildZip([{ name: "Dump/OSOBY.UNL", data: Buffer.from("1|") }]);
    const map = readZipMap(zip);
    expect([...map.keys()]).toEqual(["osoby.unl"]);
  });

  it("skips directory entries instead of reading them as members", () => {
    const zip = buildZip([
      { name: "dump/", data: Buffer.alloc(0) },
      { name: "dump/a.unl", data: Buffer.from("1|") },
    ]);
    expect(readZip(zip).map((e) => e.name)).toEqual(["dump/a.unl"]);
  });

  it("throws a named error on a non-ZIP input", () => {
    expect(() => readZip(new Uint8Array([1, 2, 3]))).toThrow(/not a ZIP/);
  });

  it("rejects an encrypted entry loudly", () => {
    const zip = buildZip([{ name: "secret.unl", data: Buffer.from("1|"), flags: 0x0001 }]);
    expect(() => readZip(zip)).toThrow(/encrypted/);
  });

  it("rejects an unsupported compression method loudly", () => {
    // Method 12 = bzip2 — never occurs in psp.cz dumps; must fail with a
    // named error instead of writing garbage into the corpus.
    const zip = buildZip([{ name: "weird.unl", data: Buffer.from("1|"), method: 12 }]);
    expect(() => readZip(zip)).toThrow(/unsupported ZIP compression method 12/);
  });

  it("rejects an entry whose declared data extends past the archive end", () => {
    // A truncated/tampered archive must not hand back a silently clamped
    // shorter-than-declared slice as if it were a complete member.
    const zip = buildZip([
      { name: "trunc.unl", data: Buffer.from("1|"), centralCompressedSize: 10_000 },
    ]);
    expect(() => readZip(zip)).toThrow(/extends past end of archive/);
  });

  it("rejects a ZIP64 archive loudly", () => {
    const zip = buildZip([{ name: "a.unl", data: Buffer.from("1|") }]);
    const buf = Buffer.from(zip);
    // Stamp the ZIP64 sentinel into the EOCD central-directory offset field.
    buf.writeUInt32LE(0xffffffff, buf.length - 22 + 16);
    expect(() => readZip(new Uint8Array(buf))).toThrow(/ZIP64/);
  });

  it("rejects a corrupt central-directory signature", () => {
    const zip = buildZip([{ name: "a.unl", data: Buffer.from("1|") }]);
    const buf = Buffer.from(zip);
    // The central directory starts right after the single local record.
    const centralOffset = buf.readUInt32LE(buf.length - 22 + 16);
    buf.writeUInt32LE(0xdeadbeef, centralOffset);
    expect(() => readZip(new Uint8Array(buf))).toThrow(/bad central-directory signature/);
  });
});
