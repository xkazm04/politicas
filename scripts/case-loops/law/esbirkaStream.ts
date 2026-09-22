/* e-Sbírka bulk-dump streaming primitives (extracted from esbirka-versions.ts, scan-sweep
 * 2026-09-06).
 *
 * `openCachedGunzip` caches the raw .gz beside the run and returns the gunzipped stream. The
 * cache is written to `<path>.part` and renamed into place on `finish` — until now the file was
 * written under its final name WHILE streaming, so an aborted run (the 176 MB dump at ~1 MB/min
 * is exactly where a run aborts) left a truncated archive that the next run greeted with "using
 * cached" and fed to gunzip, which then failed on every run until someone deleted the file by
 * hand. Same rule as lib/ingest/sources/dataor.ts's `.part` download.
 *
 * `makeExtractor` is the brace-depth object splitter, unchanged — moved so it can be tested.
 */
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

/** Brace-depth streaming extractor: emit each top-level object inside the array, ignoring braces in strings. */
export function makeExtractor(onObject: (obj: string) => void) {
  let buf = "";
  let depth = 0;
  let inStr = false;
  let esc = false;
  let started = false;
  let objStart = -1;
  return (chunk: string) => {
    buf += chunk;
    for (let i = buf.length - chunk.length; i < buf.length; i++) {
      const c = buf[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === "{") {
        if (depth === 0) { objStart = i; started = true; }
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0 && started) {
          onObject(buf.slice(objStart, i + 1));
          // compact the buffer
          buf = buf.slice(i + 1);
          i = -1;
          objStart = -1;
        }
      }
    }
    // guard against unbounded growth when between objects
    if (depth === 0 && buf.length > 2_000_000) buf = buf.slice(-1000);
  };
}

/**
 * The gunzipped stream of `url`, served from `cachePath`. A missing cache is downloaded IN FULL
 * to `<cachePath>.part` and renamed into place before anything is parsed; a failed download
 * removes the part file, so the cache never holds a truncated archive. The archive is then read
 * back from disk as a stream (the old code held the whole 176 MB in memory via readFileSync).
 */
export async function openCachedGunzip(
  url: string,
  cachePath: string,
  fetchOne: (url: string) => Promise<Response> = (u) => fetch(u, { signal: AbortSignal.timeout(600_000) }),
): Promise<NodeJS.ReadableStream> {
  if (existsSync(cachePath)) {
    console.log(`using cached ${cachePath}`);
  } else {
    console.log(`streaming ${url} …`);
    const res = await fetchOne(url);
    if (!res.ok || !res.body) throw new Error(`GET ${url} → HTTP ${res.status}`);
    mkdirSync(dirname(cachePath), { recursive: true });
    const part = `${cachePath}.part`;
    try {
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(part));
      renameSync(part, cachePath);
    } catch (e) {
      rmSync(part, { force: true });
      throw e;
    }
  }
  return createReadStream(cachePath).pipe(createGunzip());
}
