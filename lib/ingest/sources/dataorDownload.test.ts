import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadResumable } from "./dataor";

/* `downloadResumable` resumes a `.part` file with an HTTP Range request and documents
 * "a 416 means the part is already complete". Until 2026-09-06 the 416 branch only
 * `break`-ed out of the attempt loop: the complete `.part` was never renamed to `dest`
 * and the post-loop check then threw "download failed after N attempts: unknown" over a
 * file that was, byte for byte, done — the exact state a run that died between the
 * last byte and the rename leaves behind (scan-sweep, error-handler). */

const dirs: string[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("downloadResumable — a 416 on resume is completion, not failure (2026-09-06)", () => {
  it("renames the complete .part to dest and returns", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dataor-416-"));
    dirs.push(dir);
    const dest = join(dir, "x.csv.gz");
    writeFileSync(`${dest}.part`, "complete-bytes");
    const ranges: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      ranges.push(String((init?.headers as Record<string, string> | undefined)?.Range ?? ""));
      return new Response(null, { status: 416 });
    });

    await expect(downloadResumable("https://x/x.csv.gz", dest, { attempts: 2, stallMs: 5_000 })).resolves.toBeUndefined();
    expect(readFileSync(dest, "utf8")).toBe("complete-bytes");
    expect(ranges).toEqual(["bytes=14-"]);
  });
});
