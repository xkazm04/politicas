import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import { makeExtractor, openCachedGunzip } from "./esbirkaStream";

const tmp = mkdtempSync(join(tmpdir(), "politicas-esbirka-stream-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const drain = (s: NodeJS.ReadableStream): Promise<string> =>
  new Promise((resolve, reject) => {
    let out = "";
    s.on("data", (d: Buffer) => (out += d.toString("utf8")));
    s.on("end", () => resolve(out));
    s.on("error", reject);
  });

describe("makeExtractor — top-level objects, braces inside strings ignored", () => {
  it("emits each object once, across chunk boundaries", () => {
    const seen: string[] = [];
    const feed = makeExtractor((o) => seen.push(o));
    feed('[{"a":"{not an object}"},{"b":');
    feed('{"c":1}},{"d":"\\"}"}]');
    expect(seen).toEqual(['{"a":"{not an object}"}', '{"b":{"c":1}}', '{"d":"\\"}"}']);
  });
});

describe("openCachedGunzip — the cache is written whole or not at all", () => {
  it("downloads whole, leaves a complete cache file and no .part, then streams it", async () => {
    const cache = join(tmp, "ok.json.gz");
    const gz = gzipSync(Buffer.from('[{"x":1}]'));
    const stream = await openCachedGunzip("https://esb.test/001", cache, async () => new Response(gz));
    expect(await drain(stream)).toBe('[{"x":1}]');
    expect(existsSync(cache)).toBe(true);
    expect(existsSync(`${cache}.part`)).toBe(false);
    expect(readFileSync(cache)).toEqual(gz);
  });

  it("a body that fails midway leaves NO cache file (the next run refetches instead of reading a truncated archive)", async () => {
    const cache = join(tmp, "broken.json.gz");
    const gz = gzipSync(Buffer.from('[{"x":1},{"y":2}]'));
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(gz.subarray(0, 8));
        c.error(new Error("connection reset"));
      },
    });
    await expect(openCachedGunzip("https://esb.test/001", cache, async () => new Response(body))).rejects.toThrow();
    // the .part is removed on error; nothing is renamed into place
    expect(existsSync(cache)).toBe(false);
    expect(existsSync(`${cache}.part`)).toBe(false);
  });

  it("reads an existing cache without calling fetch", async () => {
    const cache = join(tmp, "cached.json.gz");
    const gz = gzipSync(Buffer.from('[{"z":3}]'));
    await openCachedGunzip("https://esb.test/001", cache, async () => new Response(gz)).then(drain);
    let calls = 0;
    const stream = await openCachedGunzip("https://esb.test/001", cache, async () => {
      calls++;
      return new Response(gz);
    });
    expect(await drain(stream)).toBe('[{"z":3}]');
    expect(calls).toBe(0);
  });

  it("a non-2xx answer is an error naming the status, and writes nothing", async () => {
    const cache = join(tmp, "http500.json.gz");
    await expect(
      openCachedGunzip("https://esb.test/001", cache, async () => new Response("busy", { status: 503 })),
    ).rejects.toThrow(/503/);
    expect(existsSync(cache)).toBe(false);
    expect(existsSync(`${cache}.part`)).toBe(false);
  });
});
