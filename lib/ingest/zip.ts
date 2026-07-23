// Minimal ZIP reader for the psp.cz bulk dumps.
//
// The dumps are plain single-disk ZIPs holding a handful of UNL members
// (deflate or stored). Node already ships the inflate implementation, so a
// central-directory walk is all that is missing — about 70 lines against a
// third-party archive dependency in a civic-data supply chain. Deliberate
// trade: fewer moving parts in the ingest path we have to trust.
//
// Not supported (and rejected loudly rather than silently mis-read): ZIP64,
// encrypted entries, and compression methods other than 0 (stored) and 8
// (deflate). None occur in the psp.cz dumps; if one ever does, the ingest fails
// with a named error instead of writing garbage into the corpus.

import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

function findEocd(buf: Buffer): number {
  // The end-of-central-directory record is at most 22 + 65535 bytes from the end.
  const start = Math.max(0, buf.length - (22 + 0xffff));
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new Error("not a ZIP archive: end-of-central-directory record not found");
}

/** Read every member of a ZIP archive into memory, keyed by member name. */
export function readZip(data: Uint8Array): ZipEntry[] {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const eocd = findEocd(buf);
  const entryCount = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  if (offset === 0xffffffff) throw new Error("ZIP64 archives are not supported");

  const entries: ZipEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error(`corrupt ZIP: bad central-directory signature at entry ${i}`);
    }
    const method = buf.readUInt16LE(offset + 10);
    const flags = buf.readUInt16LE(offset + 8);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLen);
    offset += 46 + nameLen + extraLen + commentLen;

    if (flags & 0x0001) throw new Error(`encrypted ZIP entry is not supported: ${name}`);
    if (name.endsWith("/")) continue;

    // Local header: the name/extra lengths there can differ from the central ones.
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compressedSize);

    let bytes: Uint8Array;
    if (method === 0) bytes = new Uint8Array(raw);
    else if (method === 8) bytes = new Uint8Array(inflateRawSync(raw));
    else throw new Error(`unsupported ZIP compression method ${method} for entry ${name}`);

    entries.push({ name, bytes });
  }
  return entries;
}

/** Index a ZIP by lower-cased member basename. */
export function readZipMap(data: Uint8Array): Map<string, Uint8Array> {
  const map = new Map<string, Uint8Array>();
  for (const e of readZip(data)) {
    map.set(e.name.split("/").pop()!.toLowerCase(), e.bytes);
  }
  return map;
}
